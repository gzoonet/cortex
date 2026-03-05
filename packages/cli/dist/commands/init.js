import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { getDefaultConfig, cortexConfigSchema } from '@cortex/core';
export function registerInitCommand(program) {
    program
        .command('init')
        .description('Interactive setup wizard — creates cortex.config.json')
        .option('--mode <mode>', 'LLM routing mode (cloud-first, hybrid, local-first, local-only)')
        .option('--non-interactive', 'Use defaults, no prompts', false)
        .action(async (opts) => {
        const globals = program.opts();
        await runInit(opts, globals);
    });
}
// Model presets by VRAM tier
const GPU_PRESETS = {
    high: { model: 'qwen2.5:14b-instruct-q5_K_M', numCtx: 8192, extractionLocal: true },
    mid: { model: 'mistral:7b-instruct-q5_K_M', numCtx: 4096, extractionLocal: false },
    low: { model: 'phi3:mini-4k-instruct-q4_K_M', numCtx: 2048, extractionLocal: false },
};
// Cloud provider presets
const CLOUD_PRESETS = {
    anthropic: {
        provider: 'anthropic',
        baseUrl: undefined,
        apiKeySource: 'env:CORTEX_ANTHROPIC_API_KEY',
        envVar: 'CORTEX_ANTHROPIC_API_KEY',
        models: { primary: 'claude-sonnet-4-5-20250929', fast: 'claude-haiku-4-5-20251001' },
        promptCaching: true,
        label: 'Anthropic (Claude)',
        hint: 'Best quality, higher cost',
    },
    gemini: {
        provider: 'openai-compatible',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKeySource: 'env:CORTEX_GEMINI_API_KEY',
        envVar: 'CORTEX_GEMINI_API_KEY',
        models: { primary: 'gemini-2.5-flash', fast: 'gemini-2.5-flash' },
        promptCaching: false,
        label: 'Google Gemini',
        hint: 'Very cheap, good quality',
    },
    groq: {
        provider: 'openai-compatible',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKeySource: 'env:CORTEX_GROQ_API_KEY',
        envVar: 'CORTEX_GROQ_API_KEY',
        models: { primary: 'llama-3.3-70b-versatile', fast: 'llama-3.1-8b-instant' },
        promptCaching: false,
        label: 'Groq',
        hint: 'Fast inference, free tier available',
    },
    openrouter: {
        provider: 'openai-compatible',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeySource: 'env:CORTEX_OPENROUTER_API_KEY',
        envVar: 'CORTEX_OPENROUTER_API_KEY',
        models: { primary: 'google/gemini-2.0-flash-001', fast: 'google/gemini-2.0-flash-lite-001' },
        promptCaching: false,
        label: 'OpenRouter',
        hint: 'Access to many models via one key',
    },
};
const VRAM_HINT = process.platform === 'darwin' ? '(Apple menu → About This Mac → More Info → Graphics)' :
    process.platform === 'linux' ? '(run: nvidia-smi or rocm-smi)' :
        '(Task Manager → Performance → GPU → Dedicated GPU Memory)';
async function runInit(opts, globals) {
    const config = getDefaultConfig();
    if (opts.nonInteractive) {
        if (opts.mode)
            config.llm.mode = opts.mode;
        writeConfig(config, globals);
        return;
    }
    if (!globals.quiet)
        console.log(chalk.bold('\nCortex Setup\n'));
    // ── Step 1: What do you have? (derives mode automatically) ────────────────
    const { hasOllama } = await inquirer.prompt([{
            type: 'confirm',
            name: 'hasOllama',
            message: 'Do you have Ollama installed and running locally?',
            default: false,
        }]);
    const { hasApiKey } = await inquirer.prompt([{
            type: 'confirm',
            name: 'hasApiKey',
            message: 'Do you have a cloud LLM API key? (Anthropic, Gemini, Groq, etc.)',
            default: true,
        }]);
    // Derive mode from what the user has
    let mode;
    if (hasOllama && hasApiKey) {
        mode = 'hybrid';
        console.log(chalk.dim('  → Hybrid mode: GPU for ingestion, Claude for queries'));
    }
    else if (hasOllama) {
        mode = 'local-only';
        console.log(chalk.dim('  → Local-only mode: everything runs on your GPU'));
    }
    else {
        mode = 'cloud-first';
        console.log(chalk.dim('  → Cloud mode: everything runs via Claude API'));
    }
    config.llm.mode = mode;
    const usesLocal = hasOllama;
    const usesCloud = hasApiKey;
    // ── Step 2: GPU tier (only when Ollama is involved) ───────────────────────
    if (usesLocal) {
        console.log('');
        const { vramGb } = await inquirer.prompt([{
                type: 'number',
                name: 'vramGb',
                message: `How many GB of VRAM does your GPU have? ${VRAM_HINT}`,
                default: 8,
                validate: (v) => (v > 0 && Number.isFinite(v)) || 'Enter a number greater than 0',
            }]);
        const gpuTier = vramGb >= 24 ? 'high' : vramGb >= 8 ? 'mid' : 'low';
        const { useManual } = await inquirer.prompt([{
                type: 'confirm',
                name: 'useManual',
                message: `Recommended model: ${GPU_PRESETS[gpuTier].model} — use a different one?`,
                default: false,
            }]);
        if (useManual) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'model',
                    message: 'Ollama model name:',
                    default: config.llm.local.model,
                },
                {
                    type: 'number',
                    name: 'numCtx',
                    message: 'Context window (lower = less VRAM):',
                    default: config.llm.local.numCtx,
                },
            ]);
            config.llm.local.model = answers.model;
            config.llm.local.numCtx = answers.numCtx;
        }
        else {
            const preset = GPU_PRESETS[gpuTier];
            config.llm.local.model = preset.model;
            config.llm.local.numCtx = preset.numCtx;
            console.log(chalk.dim(`  → run: ollama pull ${preset.model}`));
            if (mode === 'hybrid') {
                const extractionRoute = preset.extractionLocal ? 'local' : 'cloud';
                config.llm.taskRouting = {
                    entity_extraction: extractionRoute,
                    relationship_inference: extractionRoute,
                    contradiction_detection: 'local',
                    conversational_query: 'cloud',
                    context_ranking: 'local',
                    embedding_generation: 'local',
                };
                if (!preset.extractionLocal) {
                    console.log(chalk.dim('  → File extraction routed to cloud (more reliable on 7B models)'));
                }
            }
        }
    }
    // ── Step 3: Cloud provider selection + API key ─────────────────────────────
    let selectedPresetKey = 'gemini';
    if (usesCloud) {
        console.log('');
        const choices = Object.entries(CLOUD_PRESETS).map(([key, preset]) => ({
            name: `${preset.label} — ${preset.hint}`,
            value: key,
        }));
        const { cloudProvider } = await inquirer.prompt([{
                type: 'list',
                name: 'cloudProvider',
                message: 'Which cloud LLM provider?',
                choices,
                default: 'gemini',
            }]);
        selectedPresetKey = cloudProvider;
        const preset = CLOUD_PRESETS[selectedPresetKey];
        config.llm.cloud.provider = preset.provider;
        if (preset.baseUrl) {
            config.llm.cloud.baseUrl = preset.baseUrl;
        }
        config.llm.cloud.apiKeySource = preset.apiKeySource;
        config.llm.cloud.models = { ...preset.models };
        config.llm.cloud.promptCaching = preset.promptCaching;
        // Check if key is already set
        const envVar = preset.envVar;
        if (process.env[envVar]) {
            console.log(chalk.green(`  ✓ ${envVar} found in environment`));
        }
        else {
            // Prompt for the key and save to ~/.cortex/.env
            const { apiKey } = await inquirer.prompt([{
                    type: 'password',
                    name: 'apiKey',
                    message: `Paste your ${preset.label} API key:`,
                    mask: '*',
                }]);
            if (apiKey.trim()) {
                writeEnvFile(envVar, apiKey.trim());
                // Also set it for this process so subsequent steps can use it
                process.env[envVar] = apiKey.trim();
                console.log(chalk.green(`  ✓ Saved to ~/.cortex/.env`));
            }
            else {
                console.log(chalk.yellow(`  ! No key provided — set ${envVar} later in ~/.cortex/.env`));
            }
        }
    }
    // ── Step 4: Watch directories ──────────────────────────────────────────────
    console.log('');
    const { watchDirs } = await inquirer.prompt([{
            type: 'input',
            name: 'watchDirs',
            message: 'Directories to watch (comma-separated):',
            default: '.',
        }]);
    config.ingest.watchDirs = watchDirs.split(',').map((d) => d.trim());
    // ── Step 5: Monthly budget (if cloud involved) ─────────────────────────────
    if (usesCloud) {
        const { budget } = await inquirer.prompt([{
                type: 'number',
                name: 'budget',
                message: 'Monthly LLM spend limit in USD (0 = no limit):',
                default: 25,
            }]);
        config.llm.budget.monthlyLimitUsd = budget;
    }
    // ── Step 6: Write ──────────────────────────────────────────────────────────
    writeConfig(config, globals);
}
function writeEnvFile(key, value) {
    const cortexDir = join(homedir(), '.cortex');
    if (!existsSync(cortexDir)) {
        mkdirSync(cortexDir, { recursive: true });
    }
    const envPath = join(cortexDir, '.env');
    let content = '';
    if (existsSync(envPath)) {
        content = readFileSync(envPath, 'utf-8');
        // Replace existing key if present
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
            writeFileSync(envPath, content, { mode: 0o600 });
            return;
        }
        // Ensure trailing newline before appending
        if (content.length > 0 && !content.endsWith('\n')) {
            content += '\n';
        }
    }
    else {
        content = '# Cortex API Keys\n# This file is loaded automatically by Cortex. Do not commit this file.\n\n';
    }
    content += `${key}=${value}\n`;
    writeFileSync(envPath, content, { mode: 0o600 });
}
function writeConfig(config, globals) {
    const validated = cortexConfigSchema.parse(config);
    const cortexDir = join(homedir(), '.cortex');
    if (!existsSync(cortexDir)) {
        mkdirSync(cortexDir, { recursive: true });
    }
    const configPath = globals.config
        ? resolve(globals.config, 'cortex.config.json')
        : join(cortexDir, 'cortex.config.json');
    writeFileSync(configPath, JSON.stringify(validated, null, 2), { mode: 0o600 });
    if (!globals.quiet) {
        if (globals.json) {
            console.log(JSON.stringify({ success: true, path: configPath }));
        }
        else {
            console.log(chalk.green(`\n✓ Config written to ${configPath}`));
            console.log(chalk.dim('  Run `cortex watch` to start.\n'));
        }
    }
}
//# sourceMappingURL=init.js.map