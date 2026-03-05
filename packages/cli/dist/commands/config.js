import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import chalk from 'chalk';
import { loadConfig, getDefaultConfig, cortexConfigSchema, createLogger } from '@cortex/core';
const logger = createLogger('cli:config');
export function registerConfigCommand(program) {
    const configCmd = program
        .command('config')
        .description('Read/write/validate configuration (includes exclude subcommand)');
    configCmd
        .command('get <key>')
        .description('Get a configuration value')
        .action(async (key) => {
        const globals = program.opts();
        await runConfigGet(key, globals);
    });
    configCmd
        .command('set <key> <value>')
        .description('Set a configuration value')
        .action(async (key, value) => {
        const globals = program.opts();
        await runConfigSet(key, value, globals);
    });
    configCmd
        .command('list')
        .description('Show all non-default values')
        .action(async () => {
        const globals = program.opts();
        await runConfigList(globals);
    });
    configCmd
        .command('reset [key]')
        .description('Reset to default (all if no key)')
        .action(async (key) => {
        const globals = program.opts();
        await runConfigReset(key, globals);
    });
    configCmd
        .command('validate')
        .description('Validate configuration')
        .action(async () => {
        const globals = program.opts();
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
        const globals = program.opts();
        await runExcludeList(globals);
    });
    excludeCmd
        .command('add <pattern>')
        .description('Add an exclude pattern (file name, directory name, or glob like *.min.js)')
        .action(async (pattern) => {
        const globals = program.opts();
        await runExcludeAdd(pattern, globals);
    });
    excludeCmd
        .command('remove <pattern>')
        .description('Remove an exclude pattern')
        .action(async (pattern) => {
        const globals = program.opts();
        await runExcludeRemove(pattern, globals);
    });
}
function getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
function setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined || typeof current[part] !== 'object') {
            current[part] = {};
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
}
function parseValue(value) {
    // Try JSON first (handles booleans, numbers, arrays, objects)
    try {
        return JSON.parse(value);
    }
    catch {
        // Return as string
        return value;
    }
}
function getConfigFilePath(globals) {
    if (globals.config) {
        return resolve(globals.config, 'cortex.config.json');
    }
    // Search the same locations loadConfig uses: CWD first, then global ~/.cortex/
    const cwdPath = resolve(process.cwd(), 'cortex.config.json');
    try {
        readFileSync(cwdPath);
        return cwdPath;
    }
    catch {
        // Fall back to global config
        return resolve(homedir(), '.cortex', 'cortex.config.json');
    }
}
function readConfigFile(path) {
    try {
        const content = readFileSync(path, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return {};
    }
}
async function runConfigGet(key, globals) {
    try {
        const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
        const value = getNestedValue(config, key);
        if (value === undefined) {
            if (globals.json) {
                console.log(JSON.stringify({ error: `Key not found: ${key}` }));
            }
            else {
                console.log(chalk.yellow(`Key not found: ${key}`));
            }
            return;
        }
        if (globals.json) {
            console.log(JSON.stringify({ key, value }));
        }
        else {
            const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
            console.log(display);
        }
    }
    catch (err) {
        logger.error('Config get failed', { error: err instanceof Error ? err.message : String(err) });
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
}
async function runConfigSet(key, value, globals) {
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
            }
            else {
                console.error(chalk.red('Validation failed:\n') + chalk.yellow(issues));
            }
            return;
        }
        // Write back
        mkdirSync(dirname(configPath), { recursive: true });
        writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
        if (globals.json) {
            console.log(JSON.stringify({ key, value: parsed, saved: true }));
        }
        else {
            console.log(chalk.green(`✓ Set ${key} = ${JSON.stringify(parsed)}`));
        }
    }
    catch (err) {
        logger.error('Config set failed', { error: err instanceof Error ? err.message : String(err) });
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
}
async function runConfigList(globals) {
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
        const configFlat = flattenObject(config);
        const defaultFlat = flattenObject(defaults);
        let hasNonDefault = false;
        for (const [key, value] of Object.entries(configFlat)) {
            const defaultValue = defaultFlat[key];
            const isDefault = JSON.stringify(value) === JSON.stringify(defaultValue);
            if (!isDefault) {
                hasNonDefault = true;
                console.log(chalk.white(`  ${key}: `) +
                    chalk.bold(JSON.stringify(value)) +
                    chalk.dim(` (default: ${JSON.stringify(defaultValue)})`));
            }
        }
        if (!hasNonDefault) {
            console.log(chalk.dim('  All values are at defaults.'));
        }
        console.log('');
    }
    catch (err) {
        logger.error('Config list failed', { error: err instanceof Error ? err.message : String(err) });
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
}
async function runConfigReset(key, globals) {
    try {
        const configPath = getConfigFilePath(globals);
        const defaults = getDefaultConfig();
        if (key) {
            // Reset a single key
            const raw = readConfigFile(configPath);
            const defaultValue = getNestedValue(defaults, key);
            if (defaultValue === undefined) {
                if (globals.json) {
                    console.log(JSON.stringify({ error: `Key not found: ${key}` }));
                }
                else {
                    console.log(chalk.yellow(`Key not found: ${key}`));
                }
                return;
            }
            setNestedValue(raw, key, defaultValue);
            writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
            if (globals.json) {
                console.log(JSON.stringify({ key, value: defaultValue, reset: true }));
            }
            else {
                console.log(chalk.green(`✓ Reset ${key} to default: ${JSON.stringify(defaultValue)}`));
            }
        }
        else {
            // Reset all — write defaults
            writeFileSync(configPath, JSON.stringify(defaults, null, 2) + '\n', 'utf-8');
            if (globals.json) {
                console.log(JSON.stringify({ reset: 'all', saved: true }));
            }
            else {
                console.log(chalk.green('✓ All configuration reset to defaults.'));
            }
        }
    }
    catch (err) {
        logger.error('Config reset failed', { error: err instanceof Error ? err.message : String(err) });
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
}
async function runConfigValidate(globals) {
    try {
        const configPath = getConfigFilePath(globals);
        const raw = readConfigFile(configPath);
        const result = cortexConfigSchema.safeParse(raw);
        if (result.success) {
            if (globals.json) {
                console.log(JSON.stringify({ valid: true }));
            }
            else {
                console.log(chalk.green('✓ Configuration is valid.'));
            }
        }
        else {
            const issues = result.error.issues;
            if (globals.json) {
                console.log(JSON.stringify({ valid: false, issues }));
            }
            else {
                console.log(chalk.red('✗ Configuration has errors:\n'));
                for (const issue of issues) {
                    console.log(chalk.yellow(`  ${issue.path.join('.')}: ${issue.message}`));
                }
            }
        }
    }
    catch (err) {
        logger.error('Config validate failed', { error: err instanceof Error ? err.message : String(err) });
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
}
async function runExcludeList(globals) {
    try {
        const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
        const patterns = config.ingest.exclude;
        if (globals.json) {
            console.log(JSON.stringify(patterns));
        }
        else {
            if (patterns.length === 0) {
                console.log(chalk.dim('No exclude patterns configured.'));
            }
            else {
                console.log(chalk.bold('Excluded patterns:'));
                for (const p of patterns)
                    console.log(`  ${p}`);
            }
        }
    }
    catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
}
async function runExcludeAdd(pattern, globals) {
    try {
        const configPath = getConfigFilePath(globals);
        const raw = readConfigFile(configPath);
        const ingest = (raw['ingest'] ?? {});
        const current = Array.isArray(ingest['exclude']) ? ingest['exclude'] : [];
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
        }
        else {
            console.log(chalk.green(`✓ Added exclude: ${pattern}`));
        }
    }
    catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
}
async function runExcludeRemove(pattern, globals) {
    try {
        const configPath = getConfigFilePath(globals);
        const raw = readConfigFile(configPath);
        const ingest = (raw['ingest'] ?? {});
        const current = Array.isArray(ingest['exclude']) ? ingest['exclude'] : [];
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
        }
        else {
            console.log(chalk.green(`✓ Removed exclude: ${pattern}`));
        }
    }
    catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
}
export function registerExcludeCommand(program) {
    const excludeCmd = program
        .command('exclude')
        .description('Manage which files and directories are ignored during watching');
    excludeCmd
        .command('add <pattern>')
        .description('Add an exclude pattern (directory name, file name, or glob like *.log)')
        .action(async (pattern) => {
        const globals = program.opts();
        await runExcludeAdd(pattern, globals);
    });
    excludeCmd
        .command('remove <pattern>')
        .description('Remove an exclude pattern')
        .action(async (pattern) => {
        const globals = program.opts();
        await runExcludeRemove(pattern, globals);
    });
    excludeCmd
        .command('list')
        .description('Show all exclude patterns')
        .action(async () => {
        const globals = program.opts();
        await runExcludeList(globals);
    });
}
function flattenObject(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, fullKey));
        }
        else {
            result[fullKey] = value;
        }
    }
    return result;
}
//# sourceMappingURL=config.js.map