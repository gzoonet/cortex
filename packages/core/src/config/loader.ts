import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { cortexConfigSchema, type CortexConfigInput } from './schema.js';
import type { CortexConfig } from '../types/config.js';
import { CortexError, CONFIG_INVALID, CONFIG_MISSING } from '../errors/cortex-error.js';
import { deepMerge } from './deep-merge.js';

/**
 * Load ~/.cortex/.env file into process.env (does not override existing vars).
 * Supports KEY=value, KEY="value", KEY='value', comments (#), and blank lines.
 */
function loadDotEnv(): void {
  const envPath = join(homedir(), '.cortex', '.env');
  if (!existsSync(envPath)) return;

  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Don't override existing environment variables
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Silently ignore — .env is optional
  }
}

const CONFIG_FILENAME = 'cortex.config.json';

function getGlobalConfigPath(): string {
  return join(homedir(), '.cortex', CONFIG_FILENAME);
}

function getProjectConfigCandidates(startDir?: string): string[] {
  const envPath = process.env['CORTEX_CONFIG_PATH'];
  if (envPath) {
    return [resolve(envPath)];
  }

  return [
    startDir ? resolve(startDir, CONFIG_FILENAME) : null,
    resolve(process.cwd(), CONFIG_FILENAME),
  ].filter((p): p is string => p !== null);
}

function findProjectConfigFile(startDir?: string): string | null {
  for (const candidate of getProjectConfigCandidates(startDir)) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Return the most specific config file path (project overrides global for display). */
export function findConfigFile(startDir?: string): string | null {
  const projectPath = findProjectConfigFile(startDir);
  if (projectPath) return projectPath;

  const globalPath = getGlobalConfigPath();
  if (existsSync(globalPath)) return globalPath;

  return null;
}

function readConfigFile(filePath: string): Record<string, unknown> {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    throw new CortexError(
      CONFIG_INVALID,
      'critical',
      'config',
      `Failed to read config file: ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      { filePath },
    );
  }
}

function loadLayeredFileConfig(configDir?: string): Record<string, unknown> {
  let merged: Record<string, unknown> = {};

  const globalPath = getGlobalConfigPath();
  if (existsSync(globalPath)) {
    merged = deepMerge(merged, readConfigFile(globalPath));
  }

  const projectPath = findProjectConfigFile(configDir);
  if (projectPath && projectPath !== globalPath) {
    merged = deepMerge(merged, readConfigFile(projectPath));
  }

  return merged;
}

function applyEnvOverrides(config: CortexConfigInput): CortexConfigInput {
  const env = process.env;

  if (env['CORTEX_LLM_MODE']) {
    config.llm = { ...config.llm, mode: env['CORTEX_LLM_MODE'] as 'cloud-first' | 'hybrid' | 'local-first' | 'local-only' };
  }
  if (env['CORTEX_SERVER_PORT']) {
    config.server = { ...config.server, port: parseInt(env['CORTEX_SERVER_PORT'], 10) };
  }
  if (env['CORTEX_DB_PATH']) {
    config.graph = { ...config.graph, dbPath: env['CORTEX_DB_PATH'] };
  }
  if (env['CORTEX_LOG_LEVEL']) {
    config.logging = { ...config.logging, level: env['CORTEX_LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error' };
  }
  if (env['CORTEX_BUDGET_LIMIT']) {
    const budget = { ...config.llm?.budget, monthlyLimitUsd: parseFloat(env['CORTEX_BUDGET_LIMIT']) };
    config.llm = { ...config.llm, budget };
  }
  if (env['CORTEX_OLLAMA_HOST']) {
    const local = { ...config.llm?.local, host: env['CORTEX_OLLAMA_HOST'] };
    config.llm = { ...config.llm, local };
  }
  if (env['CORTEX_SERVER_AUTH_TOKEN']) {
    config.server = {
      ...config.server,
      auth: { ...config.server?.auth, enabled: true, token: env['CORTEX_SERVER_AUTH_TOKEN'] },
    };
  }

  return config;
}

export interface LoadConfigOptions {
  configDir?: string;
  overrides?: Partial<CortexConfigInput>;
  requireFile?: boolean;
}

export function loadConfig(options: LoadConfigOptions = {}): CortexConfig {
  // Load ~/.cortex/.env before anything reads process.env
  loadDotEnv();

  const { configDir, overrides, requireFile = false } = options;

  let fileConfig: Record<string, unknown> = {};

  if (requireFile && configDir) {
    const candidate = resolve(configDir, CONFIG_FILENAME);
    if (existsSync(candidate)) {
      fileConfig = readConfigFile(candidate);
    } else if (!existsSync(getGlobalConfigPath())) {
      throw new CortexError(
        CONFIG_MISSING,
        'critical',
        'config',
        `No cortex.config.json found in ${configDir} or ~/.cortex/. Run \`cortex init\` to create one.`,
        undefined,
        'Run `cortex init` to create a configuration file.',
      );
    } else {
      fileConfig = loadLayeredFileConfig(configDir);
    }
  } else {
    fileConfig = loadLayeredFileConfig(configDir);
    if (requireFile && Object.keys(fileConfig).length === 0) {
      throw new CortexError(
        CONFIG_MISSING,
        'critical',
        'config',
        'No cortex.config.json found. Run `cortex init` to create one.',
        undefined,
        'Run `cortex init` to create a configuration file.',
      );
    }
  }

  // Layer: global + project merge → env overrides → explicit overrides
  let merged: CortexConfigInput = { ...fileConfig } as CortexConfigInput;
  merged = applyEnvOverrides(merged);

  if (overrides) {
    merged = deepMerge(
      merged as Record<string, unknown>,
      overrides as Record<string, unknown>,
    ) as CortexConfigInput;
  }

  // Validate with Zod (fills in defaults)
  const result = cortexConfigSchema.safeParse(merged);

  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new CortexError(
      CONFIG_INVALID,
      'critical',
      'config',
      `Invalid configuration:\n${messages.join('\n')}`,
      { issues: result.error.issues },
    );
  }

  return result.data as CortexConfig;
}

export function getDefaultConfig(): CortexConfig {
  return cortexConfigSchema.parse({}) as CortexConfig;
}

export { deepMerge } from './deep-merge.js';
