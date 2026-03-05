#!/usr/bin/env node

import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
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
import { registerModelsCommand } from './commands/models.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerDbCommand } from './commands/db.js';
import { registerReportCommand } from './commands/report.js';
import { registerServeCommand } from './commands/serve.js';

const program = new Command();

program
  .name('cortex')
  .description('Local-first knowledge orchestrator — remembers what you decided, why, and where.')
  .version('0.2.9')
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
registerModelsCommand(program);
registerMcpCommand(program);
registerDbCommand(program);
registerReportCommand(program);
registerServeCommand(program);

program.parse(process.argv);
