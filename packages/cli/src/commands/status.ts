import { Command } from 'commander';
import { resolve } from 'node:path';
import { statSync } from 'node:fs';
import chalk from 'chalk';
import { loadConfig, createLogger } from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
import { Router } from '@cortex/llm';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:status');

async function checkOllamaAvailable(host: string): Promise<boolean> {
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

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('System dashboard — graph stats, LLM status, costs')
    .action(async () => {
      const globals = program.opts<GlobalOptions>();
      await runStatus(globals);
    });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

async function runStatus(globals: GlobalOptions): Promise<void> {
  const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
  const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });

  try {
    const stats = await store.getStats();
    const projects = await store.listProjects();

    // Get vector DB size
    let vectorSizeBytes = 0;
    try {
      const vectorStat = statSync(config.graph.vectorDbPath);
      vectorSizeBytes = vectorStat.size;
    } catch {
      // Vector DB may not exist yet
    }

    // Check LLM availability
    const hasApiKey = Boolean(process.env['CORTEX_ANTHROPIC_API_KEY'] || process.env['ANTHROPIC_API_KEY']);
    const mode = config.llm.mode;
    const ollamaAvailable = mode !== 'cloud-first' ? await checkOllamaAvailable(config.llm.local.host) : false;

    // Compute local savings estimate: tokens processed by Ollama × Haiku cloud rate
    const router = new Router({ config });
    const tracker = router.getTracker();
    const summary = tracker.getSummary();
    const localTokens = tracker.getRecords()
      .filter((r) => r.provider === 'ollama')
      .reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
    const HAIKU_RATE_PER_M = 2.4; // blended input+output Haiku rate
    const localSavingsUsd = (localTokens / 1_000_000) * HAIKU_RATE_PER_M;
    const localProvider = router.getLocalProvider();

    if (globals.json) {
      console.log(JSON.stringify({
        graph: {
          entities: stats.entityCount,
          relationships: stats.relationshipCount,
          contradictions: stats.contradictionCount,
        },
        projects: projects.map((p) => p.name),
        files: {
          tracked: stats.fileCount,
        },
        storage: {
          sqliteBytes: stats.dbSizeBytes,
          vectorBytes: vectorSizeBytes,
        },
        llm: {
          mode: mode,
          cloud: {
            provider: 'anthropic',
            available: hasApiKey,
          },
          local: {
            provider: 'ollama',
            available: ollamaAvailable,
            host: config.llm.local.host,
            model: config.llm.local.model,
            numCtx: localProvider?.getNumCtx() ?? config.llm.local.numCtx,
          },
        },
        budget: {
          monthlyLimitUsd: config.llm.budget.monthlyLimitUsd,
          spentThisMonthUsd: summary.totalCostUsd,
          localSavingsUsd: Math.round(localSavingsUsd * 100) / 100,
        },
      }));
      store.close();
      return;
    }

    // Header
    console.log('');
    console.log(chalk.bold.cyan('CORTEX STATUS'));
    console.log(chalk.dim('─'.repeat(50)));

    // Graph stats
    console.log(
      chalk.white('Graph:     ') +
      chalk.bold(`${stats.entityCount.toLocaleString()}`) + ' entities | ' +
      chalk.bold(`${stats.relationshipCount.toLocaleString()}`) + ' relationships | ' +
      chalk.bold(`${stats.contradictionCount}`) + ' contradictions',
    );

    // Projects
    const projectNames = projects.map((p) => p.name).join(', ') || 'none';
    console.log(
      chalk.white('Projects:  ') +
      `${projects.length} watched (${projectNames})`,
    );

    // Files
    console.log(
      chalk.white('Files:     ') +
      `${stats.fileCount} tracked`,
    );

    // Storage
    console.log(
      chalk.white('Storage:   ') +
      `${formatBytes(stats.dbSizeBytes)} (SQLite) | ${formatBytes(vectorSizeBytes)} (vectors)`,
    );

    console.log('');

    // LLM Mode + provider block
    const numCtx = localProvider?.getNumCtx() ?? config.llm.local.numCtx;
    const numGpu = localProvider?.getNumGpu() ?? config.llm.local.numGpu;

    console.log(chalk.white('LLM Mode:  ') + mode);

    const cloudLabel = `${config.llm.cloud.models.primary} / ${config.llm.cloud.models.fast} (${config.llm.cloud.provider})`;
    const localLabel = `${config.llm.local.model} @ ${config.llm.local.host}`;
    const localDetail = `${numCtx.toLocaleString()} ctx | GPU: ${numGpu === -1 ? 'auto' : numGpu} layers | ~30 tok/s est.`;

    if (mode === 'cloud-first') {
      const llmStatus = hasApiKey ? chalk.green('✓') : chalk.red('✗');
      console.log(chalk.white('  Cloud:   ') + `${llmStatus} ${cloudLabel}`);
    } else if (mode === 'local-only') {
      const llmStatus = ollamaAvailable ? chalk.green('✓') : chalk.red('✗');
      console.log(chalk.white('  Local:   ') + `${llmStatus} ${localLabel}`);
      console.log(chalk.dim(`            ${localDetail}`));
    } else if (mode === 'local-first') {
      const localStatus = ollamaAvailable ? chalk.green('✓') : chalk.red('✗');
      const cloudStatus = hasApiKey ? chalk.green('✓') : chalk.yellow('○');
      console.log(chalk.white('  Cloud:   ') + `${cloudStatus} ${cloudLabel}`);
      console.log(chalk.white('  Local:   ') + `${localStatus} ${localLabel}`);
      if (ollamaAvailable) {
        console.log(chalk.dim(`            ${localDetail}`));
      }
    } else {
      // hybrid
      const localStatus = ollamaAvailable ? chalk.green('✓') : chalk.yellow('○');
      const cloudStatus = hasApiKey ? chalk.green('✓') : chalk.red('✗');
      console.log(chalk.white('  Cloud:   ') + `${cloudStatus} ${cloudLabel}`);
      console.log(chalk.white('  Local:   ') + `${localStatus} ${localLabel}`);
      if (ollamaAvailable) {
        console.log(chalk.dim(`            ${localDetail}`));
      }
    }

    console.log('');

    // Budget + savings
    const budgetLimit = config.llm.budget.monthlyLimitUsd;
    const spentUsd = summary.totalCostUsd;
    const usedPct = budgetLimit > 0 ? ((spentUsd / budgetLimit) * 100).toFixed(1) : '0.0';
    console.log(
      chalk.white('Cost:      ') +
      `$${spentUsd.toFixed(2)} / $${budgetLimit.toFixed(2)} this month (${usedPct}%)`,
    );
    if (localSavingsUsd > 0) {
      console.log(chalk.dim(`           Savings from local: ~$${localSavingsUsd.toFixed(2)} est.`));
    }

    console.log('');

    // Overall status based on mode
    let statusOk = false;
    let statusMsg = '';

    if (mode === 'local-only') {
      statusOk = ollamaAvailable;
      statusMsg = ollamaAvailable
        ? '✓ Fully operational'
        : `⚠ Ollama not available at ${config.llm.local.host}. Run \`ollama serve\`.`;
    } else if (mode === 'local-first') {
      statusOk = ollamaAvailable || hasApiKey;
      if (ollamaAvailable) {
        statusMsg = '✓ Fully operational (using Ollama)';
      } else if (hasApiKey) {
        statusMsg = '⚠ Ollama unavailable, using cloud fallback';
      } else {
        statusMsg = '⚠ No LLM available. Start Ollama or set API key.';
      }
    } else if (mode === 'hybrid') {
      statusOk = hasApiKey || ollamaAvailable;
      if (hasApiKey && ollamaAvailable) {
        statusMsg = '✓ Fully operational (hybrid mode)';
      } else if (hasApiKey) {
        statusMsg = '⚠ Ollama unavailable, cloud-only';
      } else if (ollamaAvailable) {
        statusMsg = '⚠ API key not set, local-only';
      } else {
        statusMsg = '⚠ No LLM available';
      }
    } else {
      // cloud-first
      statusOk = hasApiKey;
      statusMsg = hasApiKey
        ? '✓ Fully operational'
        : '⚠ API key not set. Run `cortex init` or set CORTEX_ANTHROPIC_API_KEY.';
    }

    console.log(
      chalk.white('Status:    ') +
      (statusOk ? chalk.green(statusMsg) : chalk.yellow(statusMsg)),
    );

    console.log('');
  } catch (err) {
    logger.error('Status check failed', { error: err instanceof Error ? err.message : String(err) });
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }

  store.close();
}
