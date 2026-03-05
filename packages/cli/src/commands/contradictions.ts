import { Command } from 'commander';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { loadConfig, createLogger } from '@cortex/core';
import type { Contradiction } from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:contradictions');


export function registerContradictionsCommand(program: Command): void {
  program
    .command('contradictions')
    .description('List active contradictions')
    .option('--all', 'Include resolved/dismissed', false)
    .option('--severity <level>', 'Filter by severity: low, medium, high')
    .action(async (opts: { all: boolean; severity?: string }) => {
      const globals = program.opts<GlobalOptions>();
      await runContradictions(opts, globals);
    });
}

async function runContradictions(
  opts: { all: boolean; severity?: string },
  globals: GlobalOptions,
): Promise<void> {
  const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
  const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });

  try {
    // Query contradictions table
    const contradictions = await getContradictions(store, opts.all, opts.severity);

    if (globals.json) {
      console.log(JSON.stringify({ contradictions }));
      store.close();
      return;
    }

    console.log('');
    console.log(chalk.bold.cyan('CONTRADICTIONS'));
    console.log(chalk.dim('─'.repeat(60)));

    if (contradictions.length === 0) {
      console.log(chalk.dim('  No contradictions found.'));
      console.log('');
      store.close();
      return;
    }

    for (const c of contradictions) {
      const severityColor = c.severity === 'high'
        ? chalk.red
        : c.severity === 'medium' ? chalk.yellow : chalk.dim;
      const statusIcon = c.status === 'active' ? '⚠' : '✓';

      console.log('');
      console.log(
        `${statusIcon} ${chalk.bold(c.id.slice(0, 8))}  ${severityColor(`[${c.severity}]`)}  ${chalk.dim(c.status)}`,
      );
      console.log(`  ${c.description}`);

      // Show entity names
      const entity1 = await store.getEntity(c.entityIds[0]);
      const entity2 = await store.getEntity(c.entityIds[1]);
      const name1 = entity1 ? entity1.name : c.entityIds[0].slice(0, 8);
      const name2 = entity2 ? entity2.name : c.entityIds[1].slice(0, 8);
      console.log(chalk.dim(`  Between: ${name1} ↔ ${name2}`));

      if (c.suggestedResolution) {
        console.log(chalk.dim(`  Suggested: ${c.suggestedResolution}`));
      }

      if (c.status === 'active') {
        console.log(chalk.dim(`  Resolve: cortex resolve ${c.id.slice(0, 8)} --action <supersede|dismiss|keep-old|both-valid>`));
      }
    }

    console.log('');
    console.log(chalk.dim(`Total: ${contradictions.length} contradiction(s)`));
    console.log('');
  } catch (err) {
    logger.error('Contradictions listing failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }

  store.close();
}

async function getContradictions(
  store: SQLiteStore,
  includeResolved: boolean,
  severity?: string,
): Promise<Contradiction[]> {
  const results = await store.findContradictions(
    includeResolved ? {} : { status: 'active' },
  );
  if (severity) return results.filter((c) => c.severity === severity);
  return results;
}
