import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, findConfigFile, createLogger, eventBus, getProject, updateProjectLastWatched } from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
import { Router } from '@cortex/llm';
import { FileWatcher, IngestionPipeline } from '@cortex/ingest';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:watch');

export function registerWatchCommand(program: Command): void {
  program
    .command('watch [project]')
    .description('Start file watcher + ingestion pipeline. Optionally specify a registered project name.')
    .option('--no-confirm', 'Skip cost confirmation for bulk ingestion')
    .action(async (projectName: string | undefined, opts: { confirm: boolean }) => {
      const globals = program.opts<GlobalOptions>();
      await runWatch(projectName, opts, globals);
    });
}

async function runWatch(
  projectName: string | undefined,
  opts: { confirm: boolean },
  globals: GlobalOptions,
): Promise<void> {
  let projectRoot: string | undefined;
  let projectDisplayName = projectName;

  // If project name provided, look it up in the registry
  if (projectName) {
    const registeredProject = getProject(projectName);
    if (!registeredProject) {
      console.error(chalk.red(`Error: Project "${projectName}" is not registered.`));
      console.log(chalk.dim('Register it with: cortex projects add <name> <path>'));
      console.log(chalk.dim('Or list registered projects: cortex projects list'));
      process.exit(1);
    }

    projectRoot = registeredProject.path;
    
    // Check config exists
    const configPath = join(projectRoot, 'cortex.config.json');
    if (!existsSync(configPath)) {
      console.error(chalk.red(`Error: No cortex.config.json found in ${projectRoot}`));
      console.log(chalk.dim(`Run 'cd ${projectRoot} && cortex init' to create one.`));
      process.exit(1);
    }

    // Update last watched timestamp
    updateProjectLastWatched(projectName);
  }

  const configDir = globals.config ? resolve(globals.config) : projectRoot;
  const configPath = findConfigFile(configDir);
  if (!globals.quiet) {
    console.log(chalk.dim(`Config: ${configPath ?? '(none found — using defaults)'}`));
  }

  const config = loadConfig({ configDir });

  if (!globals.quiet) {
    if (projectDisplayName) {
      console.log(chalk.bold(`\n⚡ Cortex Watch: ${chalk.cyan(projectDisplayName)}\n`));
    } else {
      console.log(chalk.bold('\n⚡ Cortex Watch\n'));
    }
  }

  // Initialize stores
  const store = new SQLiteStore({
    dbPath: config.graph.dbPath,
    walMode: config.graph.walMode,
    backupOnStartup: config.graph.backupOnStartup,
  });

  // Initialize router
  const router = new Router({ config });

  // Ensure project exists
  const projects = await store.listProjects();
  let project = projects[0];
  if (!project) {
    project = await store.createProject({
      name: 'default',
      rootPath: resolve(config.ingest.watchDirs[0] ?? '.'),
      privacyLevel: config.privacy.defaultLevel,
      fileCount: 0,
      entityCount: 0,
    });
  }

  // Create pipeline
  const pipeline = new IngestionPipeline(router, store, {
    projectId: project.id,
    projectName: project.name,
    projectRoot: project.rootPath,
    maxFileSize: config.ingest.maxFileSize,
    batchSize: config.ingest.batchSize,
    projectPrivacyLevel: project.privacyLevel,
    mergeConfidenceThreshold: config.graph.mergeConfidenceThreshold,
  });

  // Create watcher
  const watcher = FileWatcher.fromConfig(config.ingest);

  let ingestedCount = 0;
  let entityCount = 0;
  let errorCount = 0;
  let shuttingDown = false;

  // Concurrency-limited work queue
  const MAX_CONCURRENT = config.ingest.batchSize;
  let activeJobs = 0;
  const queue: Array<{ path: string; changeType: 'add' | 'change' | 'unlink' }> = [];

  const spinner = ora({ isSilent: globals.quiet });

  async function processFile(path: string): Promise<void> {
    if (shuttingDown) return;

    spinner.start(`Ingesting ${path}...`);
    try {
      const result = await pipeline.ingestFile(path);
      if (shuttingDown) return;

      if (result.status === 'ingested') {
        ingestedCount++;
        entityCount += result.entityIds.length;
        spinner.succeed(
          `${path} → ${result.entityIds.length} entities, ${result.relationshipIds.length} relationships`,
        );
      } else if (result.status === 'skipped') {
        spinner.info(`${path} — skipped${result.error ? ` (${result.error})` : ''}`);
      } else {
        errorCount++;
        spinner.fail(`${path} — failed: ${result.error}`);
      }
    } catch (err) {
      if (shuttingDown) return;
      errorCount++;
      spinner.fail(`${path} — error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function drainQueue(): void {
    while (queue.length > 0 && activeJobs < MAX_CONCURRENT && !shuttingDown) {
      const item = queue.shift();
      if (!item) break;

      activeJobs++;
      processFile(item.path)
        .catch(() => {})
        .finally(() => {
          activeJobs--;
          drainQueue();
        });
    }
  }

  watcher.onFileChange((path, changeType) => {
    if (shuttingDown) return;
    if (changeType === 'unlink') {
      logger.debug('File deleted', { path });
      return;
    }

    queue.push({ path, changeType });
    drainQueue();
  });

  watcher.start();

  // Step 5: Subscribe to live alerts
  eventBus.on('contradiction.detected', (event) => {
    if (globals.quiet) return;
    spinner.stop();
    const { contradiction: c } = event.payload as {
      contradiction: { id: string; severity: string; description: string; suggestedResolution?: string };
    };
    const severityColor = c.severity === 'critical' ? chalk.red : c.severity === 'high' ? chalk.yellow : chalk.dim;
    console.log(severityColor(`\n⚠ Contradiction [${c.severity}]: ${c.description}`));
    if (c.suggestedResolution) {
      console.log(chalk.dim(`  Suggestion: ${c.suggestedResolution}`));
    }
    console.log(chalk.dim(`  Resolve with: cortex resolve ${c.id} --action <action>\n`));
  });

  // Step 5b: Budget warning and exhaustion alerts
  eventBus.on('budget.warning', (event) => {
    if (globals.quiet) return;
    spinner.stop();
    const { usedPercent, remainingUsd } = event.payload as { usedPercent: number; remainingUsd: number };
    const color = usedPercent >= 90 ? chalk.red : chalk.yellow;
    console.log(color(`\n💸 Budget: ${usedPercent}% used ($${remainingUsd.toFixed(2)} remaining)\n`));
  });

  eventBus.on('budget.exhausted', (event) => {
    if (globals.quiet) return;
    spinner.stop();
    const { totalSpentUsd } = event.payload as { totalSpentUsd: number };
    console.log(chalk.red(`\n⛔ Monthly budget exhausted ($${totalSpentUsd.toFixed(2)} spent)`));
    console.log(chalk.dim('   All tasks are now routing to local Ollama. Run `cortex costs` for details.\n'));
  });

  if (!globals.quiet) {
    console.log(chalk.dim(`Watching ${config.ingest.watchDirs.join(', ')} (Ctrl+C to stop)\n`));
  }

  // Handle shutdown — force exit on signal
  const shutdown = (): void => {
    if (shuttingDown) {
      // Second Ctrl+C — force exit immediately
      process.exit(1);
    }
    shuttingDown = true;
    queue.length = 0; // Clear pending queue

    if (!globals.quiet) {
      spinner.stop();
      console.log(chalk.dim('\n\nShutting down...'));
      console.log(
        chalk.green(`\n✓ Session: ${ingestedCount} files, ${entityCount} entities, ${errorCount} errors`),
      );
    }

    // Stop the watcher, close the store, then exit
    watcher.stop()
      .catch(() => {})
      .finally(() => {
        try { store.close(); } catch { /* ignore close errors */ }
        process.exit(0);
      });

    // Force exit after 3 seconds if graceful shutdown hangs
    // (e.g. in-flight API calls not completing)
    const forceTimer = setTimeout(() => {
      process.exit(0);
    }, 3000);
    forceTimer.unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Ensure raw Ctrl+C works even if ora or other libs intercept SIGINT
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data: Buffer) => {
      // Ctrl+C is byte 0x03
      if (data[0] === 0x03) {
        shutdown();
      }
    });
  }

  // Keep process alive — this promise never resolves;
  // the process exits via signal handlers calling process.exit()
  await new Promise<void>(() => {});
}
