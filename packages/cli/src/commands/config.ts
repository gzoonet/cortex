import { Command } from 'commander';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import chalk from 'chalk';
import { loadConfig, getDefaultConfig, cortexConfigSchema, createLogger } from '@cortex/core';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:config');

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Read/write/validate configuration (includes exclude subcommand)');

  configCmd
    .command('get <key>')
    .description('Get a configuration value')
    .action(async (key: string) => {
      const globals = program.opts<GlobalOptions>();
      await runConfigGet(key, globals);
    });

  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async (key: string, value: string) => {
      const globals = program.opts<GlobalOptions>();
      await runConfigSet(key, value, globals);
    });

  configCmd
    .command('list')
    .description('Show all non-default values')
    .action(async () => {
      const globals = program.opts<GlobalOptions>();
      await runConfigList(globals);
    });

  configCmd
    .command('reset [key]')
    .description('Reset to default (all if no key)')
    .action(async (key?: string) => {
      const globals = program.opts<GlobalOptions>();
      await runConfigReset(key, globals);
    });

  configCmd
    .command('validate')
    .description('Validate configuration')
    .action(async () => {
      const globals = program.opts<GlobalOptions>();
      await runConfigValidate(globals);
    });

  // ── exclude subcommands ────────────────────────────────────────────────────
  const excludeCmd = configCmd
    .command('exclude')
    .description('Manage which files and directories are ignored during watching');

  excludeCmd
    .command('list')
    .description('Show all exclude patterns')
    .action(async () => {
      const globals = program.opts<GlobalOptions>();
      await runExcludeList(globals);
    });

  excludeCmd
    .command('add <pattern>')
    .description('Add an exclude pattern (file name, directory name, or glob like *.min.js)')
    .action(async (pattern: string) => {
      const globals = program.opts<GlobalOptions>();
      await runExcludeAdd(pattern, globals);
    });

  excludeCmd
    .command('remove <pattern>')
    .description('Remove an exclude pattern')
    .action(async (pattern: string) => {
      const globals = program.opts<GlobalOptions>();
      await runExcludeRemove(pattern, globals);
    });
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (DANGEROUS_KEYS.has(part)) return undefined;
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (DANGEROUS_KEYS.has(part)) throw new Error(`Invalid config key: ${part}`);
    if (current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1]!;
  if (lastKey === '__proto__' || lastKey === 'constructor' || lastKey === 'prototype') {
    throw new Error(`Invalid config key: ${lastKey}`);
  }
  Object.defineProperty(current, lastKey, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function parseValue(value: string): unknown {
  // Try JSON first (handles booleans, numbers, arrays, objects)
  try {
    return JSON.parse(value);
  } catch {
    // Return as string
    return value;
  }
}

function getConfigFilePath(globals: GlobalOptions): string {
  if (globals.config) {
    return resolve(globals.config, 'cortex.config.json');
  }
  // Search the same locations loadConfig uses: CWD first, then global ~/.cortex/
  const cwdPath = resolve(process.cwd(), 'cortex.config.json');
  try {
    readFileSync(cwdPath);
    return cwdPath;
  } catch {
    // Fall back to global config
    return resolve(homedir(), '.cortex', 'cortex.config.json');
  }
}

function readConfigFile(path: string): Record<string, unknown> {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function runConfigGet(key: string, globals: GlobalOptions): Promise<void> {
  try {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const value = getNestedValue(config as unknown as Record<string, unknown>, key);

    if (value === undefined) {
      if (globals.json) {
        console.log(JSON.stringify({ error: `Key not found: ${key}` }));
      } else {
        console.log(chalk.yellow(`Key not found: ${key}`));
      }
      return;
    }

    if (globals.json) {
      console.log(JSON.stringify({ key, value }));
    } else {
      const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      console.log(display);
    }
  } catch (err) {
    logger.error('Config get failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function runConfigSet(key: string, value: string, globals: GlobalOptions): Promise<void> {
  try {
    const configPath = getConfigFilePath(globals);
    const raw = readConfigFile(configPath);
    const parsed = parseValue(value);

    setNestedValue(raw, key, parsed);

    // Validate the new config
    const result = cortexConfigSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
      if (globals.json) {
        console.log(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }));
      } else {
        console.error(chalk.red('Validation failed:\n') + chalk.yellow(issues));
      }
      return;
    }

    // Write back
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');

    if (globals.json) {
      console.log(JSON.stringify({ key, value: parsed, saved: true }));
    } else {
      console.log(chalk.green(`✓ Set ${key} = ${JSON.stringify(parsed)}`));
    }
  } catch (err) {
    logger.error('Config set failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function runConfigList(globals: GlobalOptions): Promise<void> {
  try {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const defaults = getDefaultConfig();

    if (globals.json) {
      console.log(JSON.stringify(config));
      return;
    }

    console.log('');
    console.log(chalk.bold.cyan('CORTEX CONFIGURATION'));
    console.log(chalk.dim('─'.repeat(50)));

    // Flatten and compare with defaults
    const configFlat = flattenObject(config as unknown as Record<string, unknown>);
    const defaultFlat = flattenObject(defaults as unknown as Record<string, unknown>);

    let hasNonDefault = false;
    for (const [key, value] of Object.entries(configFlat)) {
      const defaultValue = defaultFlat[key];
      const isDefault = JSON.stringify(value) === JSON.stringify(defaultValue);

      if (!isDefault) {
        hasNonDefault = true;
        console.log(
          chalk.white(`  ${key}: `) +
          chalk.bold(JSON.stringify(value)) +
          chalk.dim(` (default: ${JSON.stringify(defaultValue)})`),
        );
      }
    }

    if (!hasNonDefault) {
      console.log(chalk.dim('  All values are at defaults.'));
    }

    console.log('');
  } catch (err) {
    logger.error('Config list failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function runConfigReset(key: string | undefined, globals: GlobalOptions): Promise<void> {
  try {
    const configPath = getConfigFilePath(globals);
    const defaults = getDefaultConfig();

    if (key) {
      // Reset a single key
      const raw = readConfigFile(configPath);
      const defaultValue = getNestedValue(defaults as unknown as Record<string, unknown>, key);

      if (defaultValue === undefined) {
        if (globals.json) {
          console.log(JSON.stringify({ error: `Key not found: ${key}` }));
        } else {
          console.log(chalk.yellow(`Key not found: ${key}`));
        }
        return;
      }

      setNestedValue(raw, key, defaultValue);
      writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');

      if (globals.json) {
        console.log(JSON.stringify({ key, value: defaultValue, reset: true }));
      } else {
        console.log(chalk.green(`✓ Reset ${key} to default: ${JSON.stringify(defaultValue)}`));
      }
    } else {
      // Reset all — write defaults
      writeFileSync(configPath, JSON.stringify(defaults, null, 2) + '\n', 'utf-8');

      if (globals.json) {
        console.log(JSON.stringify({ reset: 'all', saved: true }));
      } else {
        console.log(chalk.green('✓ All configuration reset to defaults.'));
      }
    }
  } catch (err) {
    logger.error('Config reset failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function runConfigValidate(globals: GlobalOptions): Promise<void> {
  try {
    const configPath = getConfigFilePath(globals);
    const raw = readConfigFile(configPath);

    const result = cortexConfigSchema.safeParse(raw);

    if (result.success) {
      if (globals.json) {
        console.log(JSON.stringify({ valid: true }));
      } else {
        console.log(chalk.green('✓ Configuration is valid.'));
      }
    } else {
      const issues = result.error.issues;
      if (globals.json) {
        console.log(JSON.stringify({ valid: false, issues }));
      } else {
        console.log(chalk.red('✗ Configuration has errors:\n'));
        for (const issue of issues) {
          console.log(chalk.yellow(`  ${issue.path.join('.')}: ${issue.message}`));
        }
      }
    }
  } catch (err) {
    logger.error('Config validate failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function runExcludeList(globals: GlobalOptions): Promise<void> {
  try {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const patterns = config.ingest.exclude;
    if (globals.json) {
      console.log(JSON.stringify(patterns));
    } else {
      if (patterns.length === 0) {
        console.log(chalk.dim('No exclude patterns configured.'));
      } else {
        console.log(chalk.bold('Excluded patterns:'));
        for (const p of patterns) console.log(`  ${p}`);
      }
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function runExcludeAdd(pattern: string, globals: GlobalOptions): Promise<void> {
  try {
    const configPath = getConfigFilePath(globals);
    const raw = readConfigFile(configPath);
    const ingest = (raw['ingest'] ?? {}) as Record<string, unknown>;
    const current = Array.isArray(ingest['exclude']) ? (ingest['exclude'] as string[]) : [];

    if (current.includes(pattern)) {
      console.log(chalk.yellow(`Already excluded: ${pattern}`));
      return;
    }

    ingest['exclude'] = [...current, pattern];
    raw['ingest'] = ingest;

    const result = cortexConfigSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
      console.error(chalk.red('Validation failed:\n') + chalk.yellow(issues));
      return;
    }

    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');

    if (globals.json) {
      console.log(JSON.stringify({ added: pattern }));
    } else {
      console.log(chalk.green(`✓ Added exclude: ${pattern}`));
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function runExcludeRemove(pattern: string, globals: GlobalOptions): Promise<void> {
  try {
    const configPath = getConfigFilePath(globals);
    const raw = readConfigFile(configPath);
    const ingest = (raw['ingest'] ?? {}) as Record<string, unknown>;
    const current = Array.isArray(ingest['exclude']) ? (ingest['exclude'] as string[]) : [];

    if (!current.includes(pattern)) {
      console.log(chalk.yellow(`Pattern not found: ${pattern}`));
      return;
    }

    ingest['exclude'] = current.filter((p) => p !== pattern);
    raw['ingest'] = ingest;

    const result = cortexConfigSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
      console.error(chalk.red('Validation failed:\n') + chalk.yellow(issues));
      return;
    }

    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');

    if (globals.json) {
      console.log(JSON.stringify({ removed: pattern }));
    } else {
      console.log(chalk.green(`✓ Removed exclude: ${pattern}`));
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}



export function registerExcludeCommand(program: Command): void {
  const excludeCmd = program
    .command('exclude')
    .description('Manage which files and directories are ignored during watching');

  excludeCmd
    .command('add <pattern>')
    .description('Add an exclude pattern (directory name, file name, or glob like *.log)')
    .action(async (pattern: string) => {
      const globals = program.opts<GlobalOptions>();
      await runExcludeAdd(pattern, globals);
    });

  excludeCmd
    .command('remove <pattern>')
    .description('Remove an exclude pattern')
    .action(async (pattern: string) => {
      const globals = program.opts<GlobalOptions>();
      await runExcludeRemove(pattern, globals);
    });

  excludeCmd
    .command('list')
    .description('Show all exclude patterns')
    .action(async () => {
      const globals = program.opts<GlobalOptions>();
      await runExcludeList(globals);
    });
}
function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}
