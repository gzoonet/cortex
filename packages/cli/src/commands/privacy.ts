import { Command } from 'commander';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { loadConfig, createLogger } from '@cortex/core';
import type { PrivacyLevel } from '@cortex/core';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:privacy');

export function registerPrivacyCommand(program: Command): void {
  const privacyCmd = program
    .command('privacy')
    .description('Manage privacy classifications');

  privacyCmd
    .command('set <directory> <level>')
    .description('Set privacy level: standard, sensitive, restricted')
    .action(async (directory: string, level: string) => {
      const globals = program.opts<GlobalOptions>();
      await runPrivacySet(directory, level, globals);
    });

  privacyCmd
    .command('list')
    .description('Show all directory classifications')
    .action(async () => {
      const globals = program.opts<GlobalOptions>();
      await runPrivacyList(globals);
    });

  privacyCmd
    .command('log')
    .description('Show transmission audit log')
    .option('--last <n>', 'Number of entries to show', '20')
    .action(async (opts: { last: string }) => {
      const globals = program.opts<GlobalOptions>();
      await runPrivacyLog(parseInt(opts.last, 10) || 20, globals);
    });
}

function getConfigFilePath(globals: GlobalOptions): string {
  if (globals.config) {
    return resolve(globals.config, 'cortex.config.json');
  }
  return resolve(process.cwd(), 'cortex.config.json');
}

function readConfigFile(path: string): Record<string, unknown> {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function runPrivacySet(
  directory: string,
  level: string,
  globals: GlobalOptions,
): Promise<void> {
  const validLevels = ['standard', 'sensitive', 'restricted'];
  if (!validLevels.includes(level)) {
    if (globals.json) {
      console.log(JSON.stringify({ error: `Invalid level: ${level}. Must be: ${validLevels.join(', ')}` }));
    } else {
      console.error(chalk.red(`Invalid privacy level: ${level}`));
      console.log(chalk.dim(`Valid levels: ${validLevels.join(', ')}`));
    }
    return;
  }

  try {
    const configPath = getConfigFilePath(globals);
    const raw = readConfigFile(configPath);

    // Ensure privacy.directoryOverrides exists
    if (!raw['privacy'] || typeof raw['privacy'] !== 'object') {
      raw['privacy'] = {};
    }
    const privacy = raw['privacy'] as Record<string, unknown>;

    if (!privacy['directoryOverrides'] || typeof privacy['directoryOverrides'] !== 'object') {
      privacy['directoryOverrides'] = {};
    }

    const overrides = privacy['directoryOverrides'] as Record<string, string>;
    const resolvedDir = resolve(directory);

    overrides[resolvedDir] = level;

    writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');

    if (globals.json) {
      console.log(JSON.stringify({ directory: resolvedDir, level, saved: true }));
    } else {
      console.log(chalk.green(`✓ Set ${resolvedDir} → ${level}`));
    }
  } catch (err) {
    logger.error('Privacy set failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function runPrivacyList(globals: GlobalOptions): Promise<void> {
  try {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const overrides = config.privacy.directoryOverrides;
    const entries = Object.entries(overrides) as [string, PrivacyLevel][];

    if (globals.json) {
      console.log(JSON.stringify({
        defaultLevel: config.privacy.defaultLevel,
        directoryOverrides: overrides,
      }));
      return;
    }

    console.log('');
    console.log(chalk.bold.cyan('PRIVACY CLASSIFICATIONS'));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.white(`Default level: ${config.privacy.defaultLevel}`));
    console.log('');

    if (entries.length === 0) {
      console.log(chalk.dim('  No directory-specific overrides set.'));
      console.log(chalk.dim('  Use `cortex privacy set <directory> <level>` to add one.'));
    } else {
      for (const [dir, level] of entries) {
        const levelColor = level === 'restricted'
          ? chalk.red
          : level === 'sensitive' ? chalk.yellow : chalk.green;
        console.log(`  ${levelColor(level.padEnd(12))} ${dir}`);
      }
    }

    console.log('');
  } catch (err) {
    logger.error('Privacy list failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function runPrivacyLog(lastN: number, globals: GlobalOptions): Promise<void> {
  // In Phase 1, the transmission log is not yet persisted to DB.
  // This is a placeholder that will be populated when the privacy
  // pre-transmission pipeline writes audit entries.
  void lastN;

  if (globals.json) {
    console.log(JSON.stringify({ entries: [], message: 'No transmission log entries yet.' }));
  } else {
    console.log('');
    console.log(chalk.bold.cyan('TRANSMISSION AUDIT LOG'));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.dim('  No transmission log entries yet.'));
    console.log(chalk.dim('  Entries will appear after LLM queries are made.'));
    console.log('');
  }
}
