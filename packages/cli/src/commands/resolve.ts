import { Command } from 'commander';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { loadConfig, createLogger } from '@cortex/core';
import type { Contradiction } from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:resolve');

const VALID_ACTIONS = ['supersede', 'dismiss', 'keep-old', 'both-valid'] as const;
type ResolveAction = typeof VALID_ACTIONS[number];

export function registerResolveCommand(program: Command): void {
  program
    .command('resolve <contradiction-id>')
    .description('Resolve a contradiction')
    .requiredOption('--action <action>', 'Resolution action: supersede, dismiss, keep-old, both-valid')
    .action(async (contradictionId: string, opts: { action: string }) => {
      const globals = program.opts<GlobalOptions>();
      await runResolve(contradictionId, opts.action, globals);
    });
}

function isValidAction(action: string): action is ResolveAction {
  return (VALID_ACTIONS as readonly string[]).includes(action);
}

function actionToDbValue(action: ResolveAction): string {
  switch (action) {
    case 'supersede': return 'supersede';
    case 'dismiss': return 'dismiss';
    case 'keep-old': return 'keep_old';
    case 'both-valid': return 'both_valid';
  }
}

async function runResolve(
  contradictionId: string,
  action: string,
  globals: GlobalOptions,
): Promise<void> {
  if (!isValidAction(action)) {
    if (globals.json) {
      console.log(JSON.stringify({
        error: `Invalid action: ${action}`,
        validActions: [...VALID_ACTIONS],
      }));
    } else {
      console.error(chalk.red(`Invalid action: ${action}`));
      console.log(chalk.dim(`Valid actions: ${VALID_ACTIONS.join(', ')}`));
    }
    return;
  }

  const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
  const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });

  try {
    // Look up contradiction (may be a partial ID)
    const contradiction = await findContradiction(store, contradictionId);

    if (!contradiction) {
      if (globals.json) {
        console.log(JSON.stringify({ error: `Contradiction not found: ${contradictionId}` }));
      } else {
        console.log(chalk.yellow(`Contradiction not found: ${contradictionId}`));
      }
      store.close();
      return;
    }

    if (contradiction.status !== 'active') {
      if (globals.json) {
        console.log(JSON.stringify({
          error: 'Contradiction already resolved',
          status: contradiction.status,
          resolvedAction: contradiction.resolvedAction,
        }));
      } else {
        console.log(chalk.yellow(`Contradiction already resolved (${contradiction.status}).`));
      }
      store.close();
      return;
    }

    // Apply resolution
    const resolvedAction = actionToDbValue(action);
    const resolvedAt = new Date().toISOString();
    const newStatus: Contradiction['status'] = action === 'dismiss' ? 'dismissed' : 'resolved';

    await store.updateContradiction(contradiction.id, {
      status: newStatus,
      resolvedAction: resolvedAction as Contradiction['resolvedAction'],
      resolvedAt,
    });

    logger.info('Contradiction resolved', {
      id: contradiction.id,
      action: resolvedAction,
      resolvedAt,
    });

    if (globals.json) {
      console.log(JSON.stringify({
        id: contradiction.id,
        action: resolvedAction,
        resolvedAt,
        resolved: true,
      }));
    } else {
      console.log(chalk.green(`✓ Resolved contradiction ${contradiction.id.slice(0, 8)} → ${action}`));

      if (action === 'supersede') {
        console.log(chalk.dim('  The newer entity will take precedence.'));
      } else if (action === 'dismiss') {
        console.log(chalk.dim('  Contradiction dismissed.'));
      } else if (action === 'keep-old') {
        console.log(chalk.dim('  The older entity will be preserved.'));
      } else if (action === 'both-valid') {
        console.log(chalk.dim('  Both entities marked as valid.'));
      }
    }
  } catch (err) {
    logger.error('Resolve failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }

  store.close();
}

async function findContradiction(
  store: SQLiteStore,
  id: string,
): Promise<Contradiction | null> {
  const all = await store.findContradictions({});
  return all.find((c) => c.id === id || c.id.startsWith(id)) ?? null;
}
