import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig, createLogger } from '@cortex/core';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:serve');

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start the Cortex API server + web dashboard')
    .option('--port <port>', 'Port to listen on (default: 3710)', '3710')
    .option('--host <host>', 'Host to bind to (default: 127.0.0.1)', '127.0.0.1')
    .option('--no-watch', 'Disable file watcher')
    .action(async (opts: { port: string; host: string; watch: boolean }) => {
      const globals = program.opts<GlobalOptions>();
      await runServe(opts, globals);
    });
}

async function runServe(
  opts: { port: string; host: string; watch: boolean },
  globals: GlobalOptions,
): Promise<void> {
  try {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });

    // Try to find the web dashboard dist
    let webDistPath: string | undefined;
    try {
      const webPkgPath = resolve(import.meta.dirname, '../../..', 'web', 'dist');
      const { existsSync } = await import('node:fs');
      if (existsSync(webPkgPath)) {
        webDistPath = webPkgPath;
      }
    } catch {
      // Web dashboard not built yet — that's fine
    }

    const { startServer } = await import('@cortex/server');
    await startServer({
      config,
      port: Number(opts.port),
      host: opts.host,
      enableWatch: opts.watch,
      webDistPath,
    });
  } catch (err) {
    logger.error('Server failed to start', { error: err instanceof Error ? err.message : String(err) });
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
