import { resolve } from 'node:path';
import chalk from 'chalk';
import { loadConfig, createLogger } from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
const logger = createLogger('cli:find');
export function registerFindCommand(program) {
    program
        .command('find <name>')
        .description('Direct entity lookup with relationship expansion')
        .option('--expand <depth>', 'Show N hops of relationships', '0')
        .option('--type <type>', 'Filter entity type')
        .action(async (name, opts) => {
        const globals = program.opts();
        await runFind(name, opts, globals);
    });
}
async function runFind(name, opts, globals) {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });
    const depth = parseInt(opts.expand, 10) || 0;
    try {
        // Try to find by ID first
        let entity = await store.getEntity(name);
        // If not found by ID, search by name
        if (!entity) {
            const results = await store.searchEntities(name, 20);
            const filtered = opts.type
                ? results.filter((e) => e.type === opts.type)
                : results;
            if (filtered.length === 0) {
                if (globals.json) {
                    console.log(JSON.stringify({ error: 'No entities found', query: name }));
                }
                else {
                    console.log(chalk.yellow(`No entities found matching "${name}".`));
                }
                store.close();
                return;
            }
            if (filtered.length === 1) {
                entity = filtered[0];
            }
            else {
                // Multiple matches — show list
                if (globals.json) {
                    console.log(JSON.stringify({
                        matches: filtered.map((e) => ({ id: e.id, type: e.type, name: e.name })),
                    }));
                }
                else {
                    console.log(chalk.cyan(`Found ${filtered.length} matches for "${name}":\n`));
                    for (const e of filtered) {
                        console.log(`  ${chalk.dim(e.id.slice(0, 8))}  ${chalk.bold(e.name)}  ${chalk.dim(`[${e.type}]`)}`);
                    }
                    console.log(chalk.dim('\nUse the full ID to select a specific entity.'));
                }
                store.close();
                return;
            }
        }
        // Display entity details
        if (globals.json) {
            const rels = depth > 0 ? await store.getRelationshipsForEntity(entity.id) : [];
            console.log(JSON.stringify({ entity, relationships: rels }));
        }
        else {
            displayEntity(entity);
            // Expand relationships
            if (depth > 0) {
                await expandRelationships(store, entity.id, depth, new Set([entity.id]));
            }
        }
    }
    catch (err) {
        logger.error('Find failed', { error: err instanceof Error ? err.message : String(err) });
        if (globals.json) {
            console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
        else {
            console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        }
    }
    store.close();
}
function displayEntity(entity) {
    console.log('');
    console.log(chalk.bold.cyan(`${entity.name}`) + chalk.dim(` [${entity.type}]`));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.dim(`ID:         ${entity.id}`));
    console.log(chalk.dim(`Source:     ${entity.sourceFile}`));
    if (entity.sourceRange) {
        console.log(chalk.dim(`Lines:      ${entity.sourceRange.startLine}–${entity.sourceRange.endLine}`));
    }
    console.log(chalk.dim(`Confidence: ${(entity.confidence * 100).toFixed(0)}%`));
    console.log(chalk.dim(`Created:    ${entity.createdAt}`));
    if (entity.summary) {
        console.log('');
        console.log(chalk.white(entity.summary));
    }
    if (entity.tags.length > 0) {
        console.log('');
        console.log(chalk.dim('Tags: ') + entity.tags.map((t) => chalk.cyan(t)).join(', '));
    }
    console.log('');
}
async function expandRelationships(store, entityId, depth, visited) {
    const relationships = await store.getRelationshipsForEntity(entityId);
    if (relationships.length === 0) {
        console.log(chalk.dim('  No relationships found.'));
        return;
    }
    console.log(chalk.bold('Relationships:'));
    for (const rel of relationships) {
        const isSource = rel.sourceEntityId === entityId;
        const otherEntityId = isSource ? rel.targetEntityId : rel.sourceEntityId;
        const direction = isSource ? '→' : '←';
        const otherEntity = await store.getEntity(otherEntityId);
        const otherName = otherEntity ? otherEntity.name : otherEntityId.slice(0, 8);
        const otherType = otherEntity ? `[${otherEntity.type}]` : '';
        displayRelationship(rel, direction, otherName, otherType);
        // Recurse if we haven't visited this entity
        if (depth > 1 && !visited.has(otherEntityId)) {
            visited.add(otherEntityId);
            console.log(chalk.dim(`  ${'─'.repeat(40)}`));
            await expandRelationships(store, otherEntityId, depth - 1, visited);
        }
    }
}
function displayRelationship(rel, direction, targetName, targetType) {
    const confidenceColor = rel.confidence >= 0.8
        ? chalk.green
        : rel.confidence >= 0.5 ? chalk.yellow : chalk.red;
    console.log(`  ${direction} ${chalk.bold(rel.type)} ${chalk.cyan(targetName)} ${chalk.dim(targetType)}` +
        ` ${confidenceColor(`${(rel.confidence * 100).toFixed(0)}%`)}`);
    if (rel.description) {
        console.log(chalk.dim(`    ${rel.description}`));
    }
}
//# sourceMappingURL=find.js.map