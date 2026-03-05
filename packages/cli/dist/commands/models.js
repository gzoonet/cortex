import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import chalk from 'chalk';
import { loadConfig, createLogger } from '@cortex/core';
import { Router } from '@cortex/llm';
const logger = createLogger('cli:models');
export function registerModelsCommand(program) {
    const models = program
        .command('models')
        .description('Manage Ollama models');
    models
        .command('list')
        .description('Show available Ollama models and which are configured')
        .action(async () => {
        const globals = program.opts();
        await runModelsList(globals);
    });
    models
        .command('pull <model>')
        .description('Pull a model from Ollama registry')
        .action(async (model) => {
        const globals = program.opts();
        await runModelsPull(model, globals);
    });
    models
        .command('test')
        .description('Run a quick inference + embedding test to verify Ollama setup')
        .action(async () => {
        const globals = program.opts();
        await runModelsTest(globals);
    });
    models
        .command('info')
        .description('Show context window, GPU layers, and performance info for configured model')
        .action(async () => {
        const globals = program.opts();
        await runModelsInfo(globals);
    });
}
function formatBytes(bytes) {
    const gb = bytes / (1024 ** 3);
    const mb = bytes / (1024 ** 2);
    if (gb >= 1)
        return `${gb.toFixed(1)} GB`;
    return `${mb.toFixed(0)} MB`;
}
async function runModelsList(globals) {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const router = new Router({ config });
    const local = router.getLocalProvider();
    if (!local) {
        console.log(chalk.yellow('Local provider (Ollama) is not configured in this mode.'));
        console.log(chalk.dim(`Current mode: ${router.getMode()} — set mode to hybrid, local-first, or local-only`));
        return;
    }
    const host = local.getHost();
    const configuredModel = local.getModel();
    const configuredEmbed = local.getEmbeddingModel();
    const available = await local.isAvailable();
    if (!available) {
        console.error(chalk.red(`✗ Ollama not reachable at ${host}`));
        console.log(chalk.dim('  Start with: ollama serve'));
        process.exit(1);
    }
    const modelList = await local.listModels();
    if (globals.json) {
        console.log(JSON.stringify({
            host,
            configuredModel,
            configuredEmbeddingModel: configuredEmbed,
            models: modelList,
        }));
        return;
    }
    console.log('');
    console.log(chalk.bold(`Ollama Models (${host})`));
    console.log(chalk.dim('─'.repeat(50)));
    if (modelList.length === 0) {
        console.log(chalk.dim('  No models installed.'));
        console.log(chalk.dim('  Pull one with: cortex models pull mistral:7b-instruct-q5_K_M'));
    }
    else {
        for (const m of modelList) {
            const isConfigured = m.name === configuredModel;
            const isEmbed = m.name === configuredEmbed;
            const tag = isConfigured
                ? chalk.green('← configured (primary)')
                : isEmbed
                    ? chalk.cyan('← configured (embeddings)')
                    : '';
            const sizeStr = chalk.dim(formatBytes(m.sizeBytes).padEnd(8));
            console.log(`  ${m.name.padEnd(40)} ${sizeStr} ${tag}`);
        }
    }
    console.log('');
    console.log(chalk.dim(`Tip: Set model with \`cortex config set llm.local.model <model>\``));
    console.log('');
}
async function runModelsPull(model, globals) {
    if (!globals.quiet) {
        console.log(chalk.bold(`\nPulling model: ${chalk.cyan(model)}`));
        console.log(chalk.dim('This may take several minutes for large models...\n'));
    }
    // Delegate to ollama CLI directly so the user sees progress
    const result = spawnSync('ollama', ['pull', model], { stdio: 'inherit', shell: true });
    if (result.status !== 0) {
        console.error(chalk.red(`\n✗ Failed to pull model "${model}"`));
        console.log(chalk.dim('  Make sure Ollama is running: ollama serve'));
        process.exit(result.status ?? 1);
    }
    if (!globals.quiet) {
        console.log(chalk.green(`\n✓ Model "${model}" pulled successfully`));
        console.log(chalk.dim(`  Configure it: cortex config set llm.local.model ${model}`));
    }
}
async function runModelsTest(globals) {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const router = new Router({ config });
    const local = router.getLocalProvider();
    if (!local) {
        console.log(chalk.yellow('Local provider (Ollama) not configured.'));
        process.exit(1);
    }
    const host = local.getHost();
    const model = local.getModel();
    const embedModel = local.getEmbeddingModel();
    if (!globals.quiet && !globals.json) {
        console.log(chalk.bold('\nTesting Ollama setup...\n'));
    }
    const checks = [];
    // 1. Connection check
    let reachable = false;
    try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 3000);
        const resp = await fetch(`${host}/api/tags`, { signal: ctrl.signal });
        clearTimeout(tid);
        reachable = resp.ok;
    }
    catch {
        reachable = false;
    }
    checks.push({ label: `Connection:  ${host} reachable`, ok: reachable });
    // 2. Model available
    let modelLoaded = false;
    if (reachable) {
        const models = await local.listModels();
        modelLoaded = models.some((m) => m.name === model);
    }
    checks.push({ label: `Model:       ${model} loaded`, ok: modelLoaded });
    // 3. Inference test
    let inferenceMs = 0;
    let inferenceTokens = 0;
    let inferenceOk = false;
    if (modelLoaded) {
        try {
            const start = performance.now();
            const result = await local.completeWithSystem(undefined, 'Hello', { temperature: 0.1, maxTokens: 20 });
            inferenceMs = Math.round(performance.now() - start);
            inferenceTokens = result.outputTokens;
            inferenceOk = true;
        }
        catch (err) {
            logger.debug('Inference test failed', { error: err instanceof Error ? err.message : String(err) });
        }
    }
    const tokPerSec = inferenceMs > 0 ? Math.round((inferenceTokens / inferenceMs) * 1000) : 0;
    checks.push({
        label: 'Inference:   "Hello" response',
        ok: inferenceOk,
        detail: inferenceOk ? `${inferenceTokens} tokens in ${inferenceMs}ms (${tokPerSec} tok/s)` : undefined,
    });
    // 4. Embeddings test
    let embedOk = false;
    let embedMs = 0;
    let embedDims = 0;
    if (reachable) {
        try {
            const start = performance.now();
            const embeddings = await local.embed(['test']);
            embedMs = Math.round(performance.now() - start);
            embedDims = embeddings[0]?.length ?? 0;
            embedOk = embedDims > 0;
        }
        catch (err) {
            logger.debug('Embedding test failed', { error: err instanceof Error ? err.message : String(err) });
        }
    }
    checks.push({
        label: `Embeddings:  ${embedModel}`,
        ok: embedOk,
        detail: embedOk ? `${embedDims}-dim vector in ${embedMs}ms` : undefined,
    });
    const allOk = checks.every((c) => c.ok);
    if (globals.json) {
        console.log(JSON.stringify({ checks: checks.map((c) => ({ ...c })), allOk }));
        process.exit(allOk ? 0 : 4);
    }
    for (const c of checks) {
        const icon = c.ok ? chalk.green('✓') : chalk.red('✗');
        const detail = c.detail ? chalk.dim(` (${c.detail})`) : '';
        console.log(`  ${icon} ${c.label}${detail}`);
    }
    if (allOk) {
        console.log(chalk.green('\n  ✓ Ready for hybrid/local mode\n'));
        process.exit(0);
    }
    else {
        console.log(chalk.red('\n  ✗ Setup incomplete — check Ollama installation\n'));
        process.exit(4);
    }
}
async function runModelsInfo(globals) {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const router = new Router({ config });
    const local = router.getLocalProvider();
    if (!local) {
        console.log(chalk.yellow('Local provider (Ollama) not configured.'));
        process.exit(1);
    }
    const model = local.getModel();
    const numCtx = local.getNumCtx();
    const numGpu = local.getNumGpu();
    const host = local.getHost();
    if (globals.json) {
        console.log(JSON.stringify({
            model,
            host,
            numCtx,
            numGpu: numGpu === -1 ? 'auto' : numGpu,
            estimatedTokensPerSecond: 30,
        }));
        return;
    }
    console.log('');
    console.log(chalk.bold(`Ollama Model Info`));
    console.log(chalk.dim('─'.repeat(40)));
    console.log(`  Model:      ${chalk.cyan(model)}`);
    console.log(`  Host:       ${host}`);
    console.log(`  Context:    ${numCtx.toLocaleString()} tokens`);
    console.log(`  GPU layers: ${numGpu === -1 ? 'auto-detect' : String(numGpu)}`);
    console.log(`  Speed est.: ~30 tok/s`);
    console.log('');
}
//# sourceMappingURL=models.js.map