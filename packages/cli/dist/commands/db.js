import { resolve } from 'node:path';
import chalk from 'chalk';
import { loadConfig, createLogger } from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
const logger = createLogger('cli:db');
export function registerDbCommand(program) {
    const dbCmd = program
        .command('db')
        .description('Database maintenance');
    dbCmd
        .command('clean <path>')
        .description('Hard-delete all entities, relationships, and files under a source path')
        .option('--force', 'Skip confirmation prompt')
        .action(async (sourcePath, opts) => {
        const globals = program.opts();
        await runDbClean(sourcePath, opts.force ?? false, globals);
    });
    dbCmd
        .command('reset')
        .description('Wipe all entities, relationships, and files (keeps projects)')
        .option('--force', 'Skip confirmation prompt')
        .action(async (opts) => {
        const globals = program.opts();
        await runDbReset(opts.force ?? false, globals);
    });
    dbCmd
        .command('prune')
        .description('Remove soft-deleted entities and relationships that reference them')
        .option('--force', 'Skip confirmation prompt')
        .action(async (opts) => {
        const globals = program.opts();
        await runDbPrune(opts.force ?? false, globals);
    });
}
async function confirm(message, force) {
    if (force || !process.stdin.isTTY)
        return true;
    const { createInterface } = await import('node:readline');
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const answer = await new Promise((resolve) => {
        rl.question(chalk.yellow(message + ' [y/N] '), resolve);
    });
    rl.close();
    return answer.toLowerCase() === 'y';
}
async function runDbClean(sourcePath, force, globals) {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });
    try {
        const ok = await confirm(`Hard-delete all entities, relationships, and file records under "${sourcePath}"?`, force);
        if (!ok) {
            console.log('Aborted.');
            return;
        }
        const result = store.deleteBySourcePath(sourcePath);
        if (globals.json) {
            console.log(JSON.stringify(result));
        }
        else if (result.deletedEntities === 0) {
            console.log(chalk.yellow(`No entities found matching path: ${sourcePath}`));
        }
        else {
            console.log(chalk.green(`✓ Deleted ${result.deletedEntities} entities, ${result.deletedRelationships} relationships, ${result.deletedFiles} file records`));
        }
    }
    catch (err) {
        logger.error('db clean failed', { error: err instanceof Error ? err.message : String(err) });
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
    finally {
        store.close();
    }
}
async function runDbReset(force, globals) {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });
    try {
        const stats = await store.getStats();
        if (stats.entityCount === 0 && stats.fileCount === 0) {
            if (globals.json) {
                console.log(JSON.stringify({ reset: true, message: 'Database was already empty' }));
            }
            else {
                console.log(chalk.dim('Database is already empty.'));
            }
            return;
        }
        const ok = await confirm(`Reset database? This will delete ${stats.entityCount} entities, ${stats.relationshipCount} relationships, and ${stats.fileCount} file records. Projects will be kept.`, force);
        if (!ok) {
            console.log('Aborted.');
            return;
        }
        store.resetDatabase();
        if (globals.json) {
            console.log(JSON.stringify({ reset: true }));
        }
        else {
            console.log(chalk.green('✓ Database reset. All entities, relationships, and files removed. Projects preserved.'));
        }
    }
    catch (err) {
        logger.error('db reset failed', { error: err instanceof Error ? err.message : String(err) });
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
    finally {
        store.close();
    }
}
async function runDbPrune(force, globals) {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });
    try {
        const ok = await confirm('Remove all soft-deleted entities and their relationships?', force);
        if (!ok) {
            console.log('Aborted.');
            return;
        }
        const result = store.pruneSoftDeleted();
        if (globals.json) {
            console.log(JSON.stringify(result));
        }
        else {
            if (result.deletedEntities === 0) {
                console.log(chalk.dim('Nothing to prune — no soft-deleted entities found.'));
            }
            else {
                console.log(chalk.green(`✓ Pruned ${result.deletedEntities} entities and ${result.deletedRelationships} relationships`));
            }
        }
    }
    catch (err) {
        logger.error('db prune failed', { error: err instanceof Error ? err.message : String(err) });
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
    finally {
        store.close();
    }
}
//# sourceMappingURL=db.js.map