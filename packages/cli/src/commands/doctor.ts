import { Command } from 'commander';
import { resolve } from 'node:path';
import { accessSync, constants, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import chalk from 'chalk';
import {
  loadConfig,
  cortexConfigSchema,
  findConfigFile,
  listProjects,
  createLogger,
} from '@cortex/core';
import { compileSecretPatterns } from '@cortex/ingest';
import { SQLiteStore } from '@cortex/graph';
import { Router } from '@cortex/llm';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:doctor');

interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
  hint?: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Validate Cortex setup — config, providers, projects, secrets, database')
    .action(async () => {
      const globals = program.opts<GlobalOptions>();
      await runDoctor(globals);
    });
}

async function checkOllama(host: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${host}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

function resolveApiKey(source: string): boolean {
  if (source.startsWith('env:')) {
    return Boolean(process.env[source.slice(4)]);
  }
  return Boolean(source);
}

async function runDoctor(globals: GlobalOptions): Promise<void> {
  const checks: CheckResult[] = [];
  let exitCode = 0;

  const configDir = globals.config ? resolve(globals.config) : undefined;
  const configPath = findConfigFile(configDir);

  // Config file
  if (configPath) {
    checks.push({ name: 'Config file', ok: true, message: configPath });
  } else {
    checks.push({
      name: 'Config file',
      ok: false,
      message: 'No cortex.config.json found',
      hint: 'Run `cortex init` to create ~/.cortex/cortex.config.json',
    });
    exitCode = 1;
  }

  // Config validation
  try {
    const config = loadConfig({ configDir });
    const revalidated = cortexConfigSchema.safeParse(config);
    if (revalidated.success) {
      checks.push({ name: 'Config schema', ok: true, message: `Valid (${config.llm.mode} mode)` });
    } else {
      checks.push({
        name: 'Config schema',
        ok: false,
        message: revalidated.error.issues.map((i) => i.path.join('.')).join(', '),
      });
      exitCode = 1;
    }

    // Secret patterns
    const compiled = compileSecretPatterns(config.privacy.secretPatterns);
    if (compiled.length === config.privacy.secretPatterns.length) {
      checks.push({
        name: 'Secret patterns',
        ok: true,
        message: `${compiled.length} pattern(s) compile OK`,
      });
    } else {
      checks.push({
        name: 'Secret patterns',
        ok: false,
        message: `${config.privacy.secretPatterns.length - compiled.length} invalid pattern(s)`,
        hint: 'Fix privacy.secretPatterns in cortex.config.json',
      });
      exitCode = 1;
    }

    // API key (when cloud involved)
    if (config.llm.mode !== 'local-only') {
      const hasKey = resolveApiKey(config.llm.cloud.apiKeySource);
      checks.push({
        name: 'Cloud API key',
        ok: hasKey,
        message: hasKey
          ? config.llm.cloud.apiKeySource
          : `Missing: ${config.llm.cloud.apiKeySource}`,
        hint: hasKey ? undefined : 'Set the key in ~/.cortex/.env',
      });
      if (!hasKey) exitCode = 1;
    }

    // Provider reachability
    const router = new Router({ config });
    if (config.llm.mode !== 'cloud-first') {
      const local = router.getLocalProvider();
      if (local) {
        const reachable = await checkOllama(local.getHost());
        checks.push({
          name: 'Ollama',
          ok: reachable,
          message: reachable ? local.getHost() : `Unreachable at ${local.getHost()}`,
          hint: reachable ? undefined : 'Start with: ollama serve',
        });
        if (!reachable && config.llm.mode === 'local-only') exitCode = 1;
      }
    }

    if (config.llm.mode !== 'local-only') {
      const cloudAvailable = await router.isAvailable();
      checks.push({
        name: 'Cloud provider',
        ok: cloudAvailable,
        message: cloudAvailable
          ? `${config.llm.cloud.provider} (${config.llm.cloud.models.primary})`
          : 'Not reachable or missing API key',
        hint: cloudAvailable ? undefined : 'Check API key and network connectivity',
      });
      if (!cloudAvailable && config.llm.mode === 'cloud-first') exitCode = 1;
    }

    // Projects registered
    const registryProjects = listProjects();
    checks.push({
      name: 'Registered projects',
      ok: registryProjects.length > 0,
      message: registryProjects.length > 0
        ? `${registryProjects.length} project(s): ${registryProjects.map((p) => p.name).join(', ')}`
        : 'No projects in ~/.cortex/projects.json',
      hint: registryProjects.length > 0 ? undefined : 'Run: cortex projects add <name> <path>',
    });

    // DB writable
    const dbPath = config.graph.dbPath.replace(/^~/, homedir());
    try {
      const dbDir = resolve(dbPath, '..');
      accessSync(dbDir, constants.W_OK);
      if (existsSync(dbPath)) {
        accessSync(dbPath, constants.R_OK | constants.W_OK);
      }
      const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });
      const stats = await store.getStats();
      store.close();
      checks.push({
        name: 'Database',
        ok: true,
        message: `${dbPath} (${stats.entityCount} entities)`,
      });
    } catch (err) {
      checks.push({
        name: 'Database',
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        hint: 'Check graph.dbPath permissions',
      });
      exitCode = 1;
    }
  } catch (err) {
    checks.push({
      name: 'Config load',
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
    exitCode = 1;
  }

  if (globals.json) {
    console.log(JSON.stringify({ checks, ok: exitCode === 0 }));
  } else if (!globals.quiet) {
    console.log(chalk.bold('\nCortex Doctor\n'));
    for (const check of checks) {
      const icon = check.ok ? chalk.green('✓') : chalk.red('✗');
      console.log(`${icon} ${chalk.bold(check.name)}: ${check.message}`);
      if (check.hint) {
        console.log(chalk.dim(`    → ${check.hint}`));
      }
    }
    console.log(exitCode === 0
      ? chalk.green('\nAll checks passed.\n')
      : chalk.yellow('\nSome checks failed. See hints above.\n'));
  }

  if (exitCode !== 0) {
    logger.debug('Doctor found issues', { checkCount: checks.length });
    process.exit(exitCode);
  }
}
