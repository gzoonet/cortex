import { Command } from 'commander';
import { resolve, isAbsolute, extname, join, relative } from 'node:path';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import chalk from 'chalk';
import { loadConfig, createLogger, getProject } from '@cortex/core';
import { SQLiteStore, VectorStore } from '@cortex/graph';
import { Router } from '@cortex/llm';
import { IngestionPipeline, getParser } from '@cortex/ingest';
import { wireTokenPersistence } from '../index.js';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:ingest');

// Directories to always skip (no need for .gitignore for these)
const ALWAYS_SKIP_DIRS = new Set([
  'node_modules', '.next', '.nuxt', 'dist', 'build', '.git',
  'coverage', '.nyc_output', '.turbo', '.cache', '.parcel-cache',
  '__pycache__', '.venv', 'venv', '.tox',
]);

// File patterns to always skip
const ALWAYS_SKIP_FILES = /\.(min\.js|min\.css|map|lock|d\.ts)$/;

interface IngestOpts {
  project?: string;
  dryRun: boolean;
  yes: boolean;
  estimate: boolean;
}

export function registerIngestCommand(program: Command): void {
  program
    .command('ingest <file-or-glob>')
    .description('Ingest files into the knowledge graph. Supports files, globs, and directories.')
    .option('--project <name>', 'Project to attach entities to')
    .option('--dry-run', 'Show what would be extracted without writing to DB', false)
    .option('--yes', 'Skip cost confirmation prompt for batch operations', false)
    .option('--estimate', 'Show cost estimate without ingesting', false)
    .action(async (pattern: string, opts: IngestOpts) => {
      const globals = program.opts<GlobalOptions>();
      await runIngest(pattern, opts, globals);
    });
}

/**
 * Parse a .gitignore file and return a filter function.
 * Simple implementation: supports basic glob patterns, comments, negation (!) ignored.
 */
function loadGitignorePatterns(projectRoot: string): ((relPath: string) => boolean) {
  const gitignorePath = join(projectRoot, '.gitignore');
  if (!existsSync(gitignorePath)) return () => false;

  try {
    const lines = readFileSync(gitignorePath, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'));

    const patterns = lines.map((line) => {
      // Remove trailing slash (directory indicator) — we check both files and dirs
      const clean = line.replace(/\/$/, '');
      // Convert gitignore glob to regex
      const escaped = clean
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '{{GLOBSTAR}}')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\{\{GLOBSTAR\}\}/g, '.*');
      // Match anywhere in path if no slash in pattern, else from root
      if (clean.includes('/')) {
        return new RegExp('^' + escaped);
      }
      return new RegExp('(^|/)' + escaped + '(/|$)');
    });

    return (relPath: string) => patterns.some((re) => re.test(relPath));
  } catch {
    return () => false;
  }
}

/**
 * Recursively collect files from a directory, respecting .gitignore and skip lists.
 */
function collectFiles(
  dir: string,
  projectRoot: string,
  isIgnored: (relPath: string) => boolean,
): string[] {
  const files: string[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    const rel = relative(projectRoot, full);

    // Skip always-ignored directories
    if (ALWAYS_SKIP_DIRS.has(entry)) continue;

    // Skip .gitignore matches
    if (isIgnored(rel)) continue;

    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        files.push(...collectFiles(full, projectRoot, isIgnored));
      } else if (st.isFile()) {
        // Skip known non-source files
        if (ALWAYS_SKIP_FILES.test(entry)) continue;
        files.push(full);
      }
    } catch { /* skip inaccessible */ }
  }

  return files;
}

/**
 * Estimate cost for ingesting a set of files.
 * Based on observed averages: ~2 LLM calls per file (entity extraction + relationship inference),
 * average ~1500 input tokens and ~800 output tokens per call using Haiku.
 */
function estimateBatchCost(
  filePaths: string[],
  store: SQLiteStore,
): { newFiles: number; cachedFiles: number; estimatedCostUsd: number; totalFiles: number } {
  let newFiles = 0;
  let cachedFiles = 0;

  for (const filePath of filePaths) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const contentHash = createHash('sha256').update(content).digest('hex');

      if (store.isFileCached(filePath, contentHash)) {
        cachedFiles++;
      } else {
        newFiles++;
      }
    } catch {
      newFiles++; // Assume new if we can't read
    }
  }

  // Average cost per file: ~2 LLM calls (extraction + relationship)
  // Haiku: ~1500 input tokens @ $0.80/M + ~800 output tokens @ $4.0/M per call
  // = ~$0.0044 per call * 2 calls = ~$0.009 per file
  // Add 50% margin for retries, merge/contradiction detection
  const costPerFile = 0.014;
  const estimatedCostUsd = newFiles * costPerFile;

  return { newFiles, cachedFiles, estimatedCostUsd, totalFiles: filePaths.length };
}

async function runIngest(
  pattern: string,
  opts: IngestOpts,
  globals: GlobalOptions,
): Promise<void> {
  // Resolve project root
  let projectRoot: string | undefined;
  if (opts.project) {
    const reg = getProject(opts.project);
    if (!reg) {
      console.error(chalk.red(`Error: Project "${opts.project}" is not registered.`));
      console.log(chalk.dim('Register it with: cortex projects add <name> <path>'));
      process.exit(1);
    }
    projectRoot = reg.path;
  }

  const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : projectRoot });

  // Resolve file paths from pattern
  const resolvedPattern = isAbsolute(pattern) ? pattern : resolve(process.cwd(), pattern);
  let filePaths: string[] = [];

  // Check if it's a directory — if so, recursively collect files
  let isDirectory = false;
  try {
    isDirectory = statSync(resolvedPattern).isDirectory();
  } catch { /* not a directory */ }

  if (isDirectory) {
    const dirRoot = projectRoot ?? resolvedPattern;
    const isIgnored = loadGitignorePatterns(dirRoot);
    filePaths = collectFiles(resolvedPattern, dirRoot, isIgnored);
    // Filter to only supported extensions
    filePaths = filePaths.filter((f) => {
      const ext = extname(f).slice(1).toLowerCase();
      return !!getParser(ext);
    });
  } else if (resolvedPattern.includes('*')) {
    // Simple glob: split into dir + file pattern
    const lastSep = Math.max(resolvedPattern.lastIndexOf('/'), resolvedPattern.lastIndexOf('\\'));
    const dir = lastSep >= 0 ? resolvedPattern.slice(0, lastSep) : process.cwd();
    const filePattern = lastSep >= 0 ? resolvedPattern.slice(lastSep + 1) : resolvedPattern;
    const escaped = filePattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$');
    if (existsSync(dir)) {
      for (const entry of readdirSync(dir)) {
        if (regex.test(entry)) {
          const full = join(dir, entry);
          try {
            if (statSync(full).isFile()) filePaths.push(full);
          } catch { /* skip inaccessible */ }
        }
      }
    }
  } else {
    if (!existsSync(resolvedPattern)) {
      console.error(chalk.red(`Error: File not found: ${resolvedPattern}`));
      process.exit(1);
    }
    filePaths.push(resolvedPattern);
  }

  if (filePaths.length === 0) {
    console.log(chalk.yellow('No files matched the pattern.'));
    process.exit(0);
  }

  // --- Cost estimation / estimate mode ---
  if (opts.estimate || (filePaths.length > 1 && !opts.dryRun && !opts.yes)) {
    const store = new SQLiteStore({
      dbPath: config.graph.dbPath,
      walMode: config.graph.walMode,
      backupOnStartup: false,
    });

    const estimate = estimateBatchCost(filePaths, store);

    // Also show current budget usage
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01T00:00:00.000Z';
    const currentSpend = store.getTokenUsageSummary(currentMonth).totalCostUsd;
    const budgetLimit = config.llm.budget.monthlyLimitUsd;
    const budgetRemaining = Math.max(0, budgetLimit - currentSpend);

    console.log('');
    console.log(chalk.bold('Cost Estimate'));
    console.log(chalk.dim('─'.repeat(40)));
    console.log(`  Files found:      ${estimate.totalFiles}`);
    console.log(`  Already cached:   ${estimate.cachedFiles} (no cost)`);
    console.log(`  Need processing:  ${estimate.newFiles}`);
    console.log(`  Estimated cost:   ${chalk.yellow('~$' + estimate.estimatedCostUsd.toFixed(2))}`);
    console.log('');
    console.log(`  Budget this month: $${currentSpend.toFixed(2)} / $${budgetLimit.toFixed(2)}`);
    console.log(`  Budget remaining:  $${budgetRemaining.toFixed(2)}`);

    if (estimate.estimatedCostUsd > budgetRemaining) {
      console.log('');
      console.log(chalk.red(`  WARNING: Estimated cost exceeds remaining budget!`));
      console.log(chalk.red(`  Ingestion will stop when budget is exhausted.`));
    }

    console.log('');

    store.close();

    if (opts.estimate) {
      // --estimate mode: just show the estimate and exit
      console.log(chalk.dim('Run with --yes to proceed without confirmation.'));
      return;
    }

    if (estimate.newFiles === 0) {
      console.log(chalk.green('All files are already cached. Nothing to do.'));
      return;
    }

    // Interactive confirmation for multi-file batches
    if (!opts.yes && process.stdin.isTTY) {
      process.stdout.write(chalk.bold('Proceed? [y/N] '));
      const answer = await new Promise<string>((res) => {
        process.stdin.setEncoding('utf-8');
        process.stdin.once('data', (data) => res(data.toString().trim().toLowerCase()));
        // Auto-reject after 30s
        setTimeout(() => res(''), 30_000);
      });
      if (answer !== 'y' && answer !== 'yes') {
        console.log(chalk.dim('Aborted.'));
        process.exit(0);
      }
    } else if (!opts.yes) {
      // Non-interactive and no --yes flag
      console.log(chalk.yellow('Use --yes to confirm batch operations in non-interactive mode.'));
      process.exit(1);
    }
  }

  if (!globals.quiet) {
    if (opts.dryRun) {
      console.log(chalk.bold(`\n🔍 Cortex Ingest (dry run) — ${filePaths.length} file(s)\n`));
    } else {
      console.log(chalk.bold(`\n⚡ Cortex Ingest — ${filePaths.length} file(s)\n`));
    }
  }

  if (opts.dryRun) {
    // Dry run: parse files and count sections without writing to DB
    let totalSections = 0;
    for (const filePath of filePaths) {
      try {
        const ext = extname(filePath).slice(1).toLowerCase();
        const content = readFileSync(filePath, 'utf-8');
        const parser = getParser(ext, filePath, content);
        if (!parser) {
          console.log(chalk.dim(`  − ${filePath} — unsupported type`));
          continue;
        }
        const result = await parser.parse(content, filePath);
        totalSections += result.sections.length;
        console.log(chalk.dim(`  ~ ${filePath} → ${result.sections.length} sections (est. ${result.sections.length * 3} entities)`));
      } catch (err) {
        console.log(chalk.red(`  ✗ ${filePath} — ${err instanceof Error ? err.message : String(err)}`));
      }
    }
    console.log(chalk.dim(`\nDry run complete: ~${totalSections * 3} entities estimated across ${filePaths.length} file(s)`));
    return;
  }

  // Real ingestion
  const store = new SQLiteStore({
    dbPath: config.graph.dbPath,
    walMode: config.graph.walMode,
    backupOnStartup: false,
  });

  const router = new Router({ config });
  wireTokenPersistence(router, store);

  // Check budget before starting
  const tracker = router.getTracker();
  const startingSpend = tracker.getCurrentMonthSpend();
  if (tracker.isBudgetExhausted()) {
    console.error(chalk.red('Monthly budget exhausted. Increase budget in config or wait for next month.'));
    console.log(chalk.dim(`  Spent: $${tracker.getCurrentMonthSpend().toFixed(2)} / $${config.llm.budget.monthlyLimitUsd.toFixed(2)}`));
    store.close();
    process.exit(1);
  }

  // Resolve project record
  const projects = await store.listProjects();
  let project = projects.find((p) => opts.project ? p.name === opts.project : true);
  if (!project) {
    project = await store.createProject({
      name: opts.project ?? 'default',
      rootPath: projectRoot ?? resolve(config.ingest.watchDirs[0] ?? '.'),
      privacyLevel: config.privacy.defaultLevel,
      fileCount: 0,
      entityCount: 0,
    });
  }

  const vectorStore = new VectorStore({
    dbPath: config.graph.vectorDbPath,
    dimensions: config.llm.embeddings?.dimensions ?? 384,
  });
  await vectorStore.initialize();

  const pipeline = new IngestionPipeline(router, store, {
    projectId: project.id,
    projectName: project.name,
    projectRoot: project.rootPath,
    maxFileSize: config.ingest.maxFileSize,
    batchSize: config.ingest.batchSize,
    projectPrivacyLevel: project.privacyLevel,
    mergeConfidenceThreshold: config.graph.mergeConfidenceThreshold,
    secretPatterns: config.privacy.secretPatterns,
  }, vectorStore);

  let totalEntities = 0;
  let totalRelationships = 0;
  let errorCount = 0;
  let skippedCount = 0;
  let costSoFar = 0;

  if (globals.json) {
    const results: Array<{ file: string; entities: number; relationships: number; status: string }> = [];
    for (const filePath of filePaths) {
      // Check budget before each file
      if (tracker.isBudgetExhausted()) {
        results.push({ file: filePath, entities: 0, relationships: 0, status: 'budget_exhausted' });
        continue;
      }
      const result = await pipeline.ingestFile(filePath);
      results.push({
        file: filePath,
        entities: result.entityIds.length,
        relationships: result.relationshipIds.length,
        status: result.status,
      });
      totalEntities += result.entityIds.length;
      totalRelationships += result.relationshipIds.length;
      if (result.status === 'failed') errorCount++;
    }
    console.log(JSON.stringify({ files: results, total: { entities: totalEntities, relationships: totalRelationships } }));
    store.close();
    return;
  }

  console.log(chalk.dim(`Ingesting ${filePaths.length} file(s)...\n`));
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i]!;

    // Check budget before each file
    if (tracker.isBudgetExhausted()) {
      console.log('');
      console.log(chalk.red.bold(`Budget exhausted after ${i} files. Stopping.`));
      console.log(chalk.dim(`  ${filePaths.length - i} file(s) remaining`));
      console.log(chalk.dim(`  Increase budget with: cortex config set llm.budget.monthlyLimitUsd <amount>`));
      break;
    }

    try {
      const result = await pipeline.ingestFile(filePath);
      if (result.status === 'ingested') {
        totalEntities += result.entityIds.length;
        totalRelationships += result.relationshipIds.length;
        console.log(chalk.green(`  ✓ ${filePath}`) + chalk.dim(` → ${result.entityIds.length} entities, ${result.relationshipIds.length} relationships`));
      } else if (result.status === 'skipped') {
        skippedCount++;
        console.log(chalk.dim(`  − ${filePath} — skipped${result.error ? ` (${result.error})` : ''}`));
      } else {
        errorCount++;
        console.log(chalk.red(`  ✗ ${filePath} — failed: ${result.error}`));
      }
    } catch (err) {
      errorCount++;
      logger.error('Ingest failed', { filePath, error: err instanceof Error ? err.message : String(err) });
      console.log(chalk.red(`  ✗ ${filePath} — error: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  // Final summary
  const sessionCost = tracker.getCurrentMonthSpend() - startingSpend;
  console.log('');
  console.log(chalk.bold(`Total: ${totalEntities} entities, ${totalRelationships} relationships ingested`) +
    (opts.project ? chalk.dim(` into project "${opts.project}"`) : ''));
  if (skippedCount > 0) {
    console.log(chalk.dim(`  ${skippedCount} file(s) skipped (cached/unchanged)`));
  }
  if (errorCount > 0) {
    console.log(chalk.yellow(`  ${errorCount} file(s) failed`));
  }
  console.log(chalk.dim(`  Session cost: ~$${sessionCost.toFixed(4)}`));

  store.close();
  process.exit(errorCount > 0 ? 1 : 0);
}
