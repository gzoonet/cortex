import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import type { GlobalOptions } from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start the Cortex MCP server (stdio transport for Claude Code)')
    .option('--config-dir <path>', 'Directory containing cortex.config.json')
    .action(async (opts: { configDir?: string }) => {
      const globals = program.opts<GlobalOptions>();
      const mcpEntry = resolve(__dirname, '../../mcp/dist/index.js');

      if (!existsSync(mcpEntry)) {
        console.error(chalk.red('Error: MCP server not built.'));
        console.error(chalk.dim(`Expected: ${mcpEntry}`));
        console.error(chalk.dim('Run `npm run build` from cortex-dev-package/ first.'));
        process.exit(1);
      }

      // Warn if running interactively — MCP servers are meant to be launched by Claude Code
      if (process.stdout.isTTY) {
        process.stderr.write(
          chalk.yellow('\n[cortex mcp] Starting MCP server on stdio.\n') +
          chalk.dim('This process blocks — it is meant to be launched by Claude Code, not run manually.\n') +
          chalk.dim('Register it with: claude mcp add cortex --scope user -- node ' + mcpEntry + '\n\n'),
        );
      }

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        CORTEX_LOG_LEVEL: 'error',
      };
      if (opts.configDir) {
        env['CORTEX_CONFIG_DIR'] = resolve(opts.configDir);
      }
      if (globals.config) {
        env['CORTEX_CONFIG_DIR'] = resolve(globals.config);
      }

      const child = spawn(process.execPath, [mcpEntry], {
        stdio: 'inherit',
        env,
      });

      child.on('exit', (code) => process.exit(code ?? 0));
      child.on('error', (err) => {
        process.stderr.write(`[cortex mcp] Error: ${err.message}\n`);
        process.exit(1);
      });
    });
}
