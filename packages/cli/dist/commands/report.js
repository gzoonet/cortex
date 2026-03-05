import { resolve } from 'node:path';
import chalk from 'chalk';
import { loadConfig, createLogger } from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
const logger = createLogger('cli:report');
export function registerReportCommand(program) {
    program
        .command('report')
        .description('Post-ingestion summary — files, entities, relationships, contradictions, token costs')
        .option('--failed', 'Show full list of failed files with error messages', false)
        .action(async (opts) => {
        const globals = program.opts();
        await runReport(opts, globals);
    });
}
async function runReport(opts, globals) {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });
    try {
        const data = store.getReportData();
        if (globals.json) {
            console.log(JSON.stringify(data, null, 2));
            store.close();
            return;
        }
        // Header
        console.log('');
        console.log(chalk.bold.cyan('CORTEX REPORT'));
        console.log(chalk.dim(`Generated: ${new Date(data.generatedAt).toLocaleString()}`));
        console.log(chalk.dim('─'.repeat(60)));
        // Files
        const totalFiles = data.fileStatus.ingested + data.fileStatus.failed +
            data.fileStatus.skipped + data.fileStatus.pending;
        console.log('');
        console.log(chalk.bold('Files'));
        console.log(`  ${chalk.green('✓')} Ingested  ${String(data.fileStatus.ingested).padStart(5)}` +
            `   ${chalk.red('✗')} Failed    ${String(data.fileStatus.failed).padStart(5)}` +
            `   ${chalk.dim('–')} Skipped   ${String(data.fileStatus.skipped).padStart(5)}` +
            `   Total ${totalFiles}`);
        if (data.failedFiles.length > 0) {
            if (opts.failed || data.failedFiles.length <= 5) {
                console.log('');
                console.log(chalk.dim('  Failed files:'));
                for (const f of data.failedFiles) {
                    console.log(chalk.red(`    ✗ ${f.relativePath}`));
                    console.log(chalk.dim(`      ${f.parseError}`));
                }
            }
            else {
                console.log(chalk.dim(`  (${data.failedFiles.length} failed — run with --failed to see details)`));
            }
        }
        // Entities
        const totalEntities = data.entityBreakdown.reduce((s, r) => s + r.count, 0);
        console.log('');
        console.log(chalk.bold(`Entities  (${totalEntities} active)`));
        if (data.entityBreakdown.length === 0) {
            console.log(chalk.dim('  None extracted yet.'));
        }
        else {
            for (const row of data.entityBreakdown) {
                const bar = buildBar(row.count / totalEntities, 16);
                const conf = (row.avgConfidence * 100).toFixed(0);
                console.log(`  ${row.type.padEnd(14)} ${String(row.count).padStart(5)}  ${bar}  conf ${conf}%`);
            }
        }
        if (data.supersededCount > 0) {
            console.log(chalk.dim(`  + ${data.supersededCount} superseded (merged duplicates)`));
        }
        // Relationships
        const totalRels = data.relationshipBreakdown.reduce((s, r) => s + r.count, 0);
        console.log('');
        console.log(chalk.bold(`Relationships  (${totalRels} total)`));
        if (data.relationshipBreakdown.length === 0) {
            console.log(chalk.dim('  None inferred yet.'));
        }
        else {
            for (const row of data.relationshipBreakdown) {
                const bar = buildBar(totalRels > 0 ? row.count / totalRels : 0, 16);
                console.log(`  ${row.type.padEnd(18)} ${String(row.count).padStart(5)}  ${bar}`);
            }
        }
        // Contradictions
        const totalContradictions = data.contradictions.active +
            data.contradictions.resolved +
            data.contradictions.dismissed;
        console.log('');
        console.log(chalk.bold(`Contradictions  (${totalContradictions} total)`));
        if (totalContradictions === 0) {
            console.log(chalk.dim('  None detected.'));
        }
        else {
            console.log(`  ${chalk.red('Active')}   ${data.contradictions.active}` +
                `   Resolved  ${data.contradictions.resolved}` +
                `   Dismissed ${data.contradictions.dismissed}`);
            if (data.contradictions.active > 0) {
                console.log(chalk.dim(`  Severity: ${data.contradictions.highSeverity} high / ${data.contradictions.mediumSeverity} medium / ${data.contradictions.lowSeverity} low`));
                if (data.topContradictions.length > 0) {
                    console.log('');
                    for (const c of data.topContradictions) {
                        const sevColor = c.severity === 'high' || c.severity === 'critical'
                            ? chalk.red : c.severity === 'medium' ? chalk.yellow : chalk.dim;
                        console.log(`  ${sevColor(`[${c.severity}]`)} ${chalk.white(c.entityA)} ${chalk.dim('↔')} ${chalk.white(c.entityB)}`);
                        console.log(chalk.dim(`         ${truncate(c.description, 100)}`));
                        console.log(chalk.dim(`         cortex resolve ${c.id} --action <supersede|dismiss|keep-old|both-valid>`));
                    }
                    if (data.contradictions.active > data.topContradictions.length) {
                        console.log(chalk.dim(`  ... and ${data.contradictions.active - data.topContradictions.length} more. Run \`cortex contradictions\` to see all.`));
                    }
                }
            }
        }
        // Token Usage
        const { totalInput, totalOutput } = data.tokenEstimate;
        console.log('');
        console.log(chalk.bold('Token Usage  (from stored entity records)'));
        if (totalInput === 0 && totalOutput === 0) {
            console.log(chalk.dim('  No token data available.'));
        }
        else {
            console.log(`  Input   ${totalInput.toLocaleString().padStart(10)} tokens\n` +
                `  Output  ${totalOutput.toLocaleString().padStart(10)} tokens`);
        }
        console.log('');
        console.log(chalk.dim('─'.repeat(60)));
        console.log(chalk.dim('Tip: cortex contradictions  |  cortex costs  |  cortex status'));
        console.log('');
    }
    catch (err) {
        logger.error('Report failed', { error: err instanceof Error ? err.message : String(err) });
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
    store.close();
}
function truncate(str, maxLen) {
    const oneLine = str.replace(/\n/g, ' ').trim();
    return oneLine.length > maxLen ? oneLine.slice(0, maxLen - 3) + '...' : oneLine;
}
function buildBar(ratio, width) {
    const filled = Math.round(Math.min(1, ratio) * width);
    const empty = width - filled;
    return chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}
//# sourceMappingURL=report.js.map