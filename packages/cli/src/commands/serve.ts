import { Command } from 'commander';
import { resolve, dirname } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { loadConfig, createLogger } from '@cortex/core';
import type { GlobalOptions } from '../index.js';

function findPkgRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    try {
      const pkgPath = resolve(dir, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name === 'gzoo-cortex') return dir;
    } catch { /* keep looking */ }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const logger = createLogger('cli:serve');

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start the Cortex API server + web dashboard')
    .option('--port <port>', 'Port to listen on (default: 3710)', '3710')
    .option('--host <host>', 'Host to bind to (default: 127.0.0.1)', '127.0.0.1')
    .option('--auth-token <token>', 'API authentication token (enables auth)')
    .option('--no-watch', 'Disable file watcher')
    .action(async (opts: { port: string; host: string; authToken?: string; watch: boolean }) => {
      const globals = program.opts<GlobalOptions>();
      await runServe(opts, globals);
    });
}

const LOCALHOST_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function ensureAuthToken(host: string, config: ReturnType<typeof loadConfig>): void {
  const isLocal = LOCALHOST_HOSTS.has(host);
  if (isLocal && !config.server.auth.enabled) return;

  // Auth is needed — check if token already exists
  if (config.server.auth.token) return;

  // Auto-generate a token and persist to ~/.cortex/.env
  const token = randomBytes(32).toString('hex');
  const envDir = resolve(homedir(), '.cortex');
  const envPath = resolve(envDir, '.env');
  mkdirSync(envDir, { recursive: true });

  const line = `CORTEX_SERVER_AUTH_TOKEN=${token}`;
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    if (!content.includes('CORTEX_SERVER_AUTH_TOKEN')) {
      appendFileSync(envPath, `\n${line}\n`);
    }
  } else {
    writeFileSync(envPath, `${line}\n`);
  }

  // Apply to current config so the server picks it up
  config.server.auth.enabled = true;
  config.server.auth.token = token;

  console.log(`\n  Auth token generated and saved to ${envPath}`);
  console.log(`  Token: ${token}\n`);
}

async function runServe(
  opts: { port: string; host: string; authToken?: string; watch: boolean },
  globals: GlobalOptions,
): Promise<void> {
  try {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });

    // CLI --auth-token overrides config
    if (opts.authToken) {
      config.server.auth.enabled = true;
      config.server.auth.token = opts.authToken;
    }

    // Auto-generate token for non-localhost if needed
    ensureAuthToken(opts.host, config);

    // Try to find the web dashboard dist
    let webDistPath: string | undefined;
    const pkgRoot = findPkgRoot(import.meta.dirname);
    try {
      const webPkgPath = resolve(pkgRoot, 'packages/web/dist');
      const { existsSync } = await import('node:fs');
      if (existsSync(webPkgPath)) {
        webDistPath = webPkgPath;
      }
    } catch {
      // Web dashboard not built yet — that's fine
    }

    const { startServer } = await import('@cortex/server');
    // Write PID file for stop/restart
    const pidDir = resolve(homedir(), '.cortex');
    mkdirSync(pidDir, { recursive: true });
    writeFileSync(resolve(pidDir, 'cortex.pid'), String(process.pid));

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
