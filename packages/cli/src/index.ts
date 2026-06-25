#!/usr/bin/env node

import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerWatchCommand } from './commands/watch.js';
import { registerQueryCommand } from './commands/query.js';
import { registerFindCommand } from './commands/find.js';
import { registerStatusCommand } from './commands/status.js';
import { registerCostsCommand } from './commands/costs.js';
import { registerConfigCommand, registerExcludeCommand } from './commands/config.js';
import { registerPrivacyCommand } from './commands/privacy.js';
import { registerContradictionsCommand } from './commands/contradictions.js';
import { registerResolveCommand } from './commands/resolve.js';
import { registerProjectsCommand } from './commands/projects.js';
import { registerIngestCommand } from './commands/ingest.js';
import { registerReindexCommand } from './commands/reindex.js';
import { registerModelsCommand } from './commands/models.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerDbCommand } from './commands/db.js';
import { registerReportCommand } from './commands/report.js';
import { registerServeCommand } from './commands/serve.js';
import { registerStopCommand, registerRestartCommand } from './commands/stop.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Router } from '@cortex/llm';
import type { SQLiteStore } from '@cortex/graph';

/** Wire token tracking persistence: each LLM call is saved to SQLite.
 *  Also hydrates the tracker with this month's existing spend so budget
 *  enforcement works correctly across separate CLI processes. */
export function wireTokenPersistence(router: Router, store: SQLiteStore): void {
  // Hydrate with existing spend from SQLite so budget checks work
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01T00:00:00.000Z';
  const summary = store.getTokenUsageSummary(currentMonth);
  router.getTracker().hydrateSpend(summary.totalCostUsd);

  // Persist each new record to SQLite
  router.getTracker().setPersist((record) => {
    store.insertTokenUsage(record);
  });
}

declare const CORTEX_VERSION: string | undefined;

export function getVersion(): string {
  if (typeof CORTEX_VERSION !== 'undefined') return CORTEX_VERSION;
  let dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'));
      if ((pkg.name === '@gzoo/cortex' || pkg.name === 'gzoo-cortex') && pkg.version) return pkg.version;
    } catch { /* not here */ }
    dir = resolve(dir, '..');
  }
  return 'unknown';
}

const program = new Command();

program
  .name('cortex')
  .description('Local-first knowledge orchestrator — remembers what you decided, why, and where.')
  .version(getVersion())
  .option('--config <path>', 'Config file path')
  .option('--verbose', 'Show debug-level output', false)
  .option('--quiet', 'Suppress all non-error output', false)
  .option('--json', 'Output as JSON (for scripting)', false)
  .option('--no-color', 'Disable color output');

export interface GlobalOptions {
  config?: string;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  color: boolean;
}

registerInitCommand(program);
registerDoctorCommand(program);
registerWatchCommand(program);
registerQueryCommand(program);
registerFindCommand(program);
registerStatusCommand(program);
registerCostsCommand(program);
registerConfigCommand(program);
registerExcludeCommand(program);
registerPrivacyCommand(program);
registerContradictionsCommand(program);
registerResolveCommand(program);
registerProjectsCommand(program);
registerIngestCommand(program);
registerReindexCommand(program);
registerModelsCommand(program);
registerMcpCommand(program);
registerDbCommand(program);
registerReportCommand(program);
registerServeCommand(program);
registerStopCommand(program);
registerRestartCommand(program);

program.parse(process.argv);
