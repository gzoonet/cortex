import { Command } from 'commander';
import { resolve, isAbsolute, extname, join } from 'node:path';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import chalk from 'chalk';
import { loadConfig, createLogger, getProject } from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
import { Router } from '@cortex/llm';
import { IngestionPipeline, getParser } from '@cortex/ingest';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:ingest');

export function registerIngestCommand(program: Command): void {
  program
    .command('ingest <file-or-glob>')
    .description('One-shot ingestion of a file or glob pattern into the knowledge graph')
    .option('--project <name>', 'Project to attach entities to')
    .option('--dry-run', 'Show what would be extracted without writing to DB', false)
    .action(async (pattern: string, opts: { project?: string; dryRun: boolean }) => {
      const globals = program.opts<GlobalOptions>();
      await runIngest(pattern, opts, globals);
    });
}

async function runIngest(
  pattern: string,
  opts: { project?: string; dryRun: boolean },
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
  const filePaths: string[] = [];

  if (resolvedPattern.includes('*')) {
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

  const pipeline = new IngestionPipeline(router, store, {
    projectId: project.id,
    projectName: project.name,
    projectRoot: project.rootPath,
    maxFileSize: config.ingest.maxFileSize,
    batchSize: config.ingest.batchSize,
    projectPrivacyLevel: project.privacyLevel,
    mergeConfidenceThreshold: config.graph.mergeConfidenceThreshold,
    secretPatterns: config.privacy.secretPatterns,
  });

  let totalEntities = 0;
  let totalRelationships = 0;
  let errorCount = 0;

  if (globals.json) {
    const results: Array<{ file: string; entities: number; relationships: number; status: string }> = [];
    for (const filePath of filePaths) {
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
  for (const filePath of filePaths) {
    try {
      const result = await pipeline.ingestFile(filePath);
      if (result.status === 'ingested') {
        totalEntities += result.entityIds.length;
        totalRelationships += result.relationshipIds.length;
        console.log(chalk.green(`  ✓ ${filePath}`) + chalk.dim(` → ${result.entityIds.length} entities, ${result.relationshipIds.length} relationships`));
      } else if (result.status === 'skipped') {
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

  console.log('');
  console.log(chalk.bold(`Total: ${totalEntities} entities, ${totalRelationships} relationships ingested`) +
    (opts.project ? chalk.dim(` into project "${opts.project}"`) : ''));
  if (errorCount > 0) {
    console.log(chalk.yellow(`  ${errorCount} file(s) failed`));
  }

  store.close();
  process.exit(errorCount > 0 ? 1 : 0);
}
