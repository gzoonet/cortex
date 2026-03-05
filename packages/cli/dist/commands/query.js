import { resolve } from 'node:path';
import chalk from 'chalk';
import { loadConfig, LLMTask, createLogger } from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
import { QueryEngine } from '@cortex/graph';
import { VectorStore } from '@cortex/graph';
import { Router, conversationalQueryPrompt, followUpGenerationPrompt } from '@cortex/llm';
const logger = createLogger('cli:query');
export function registerQueryCommand(program) {
    program
        .command('query <question>')
        .description('Natural language query with citations')
        .option('--project <name>', 'Filter to specific project')
        .option('--type <type>', 'Filter entity type')
        .option('--since <date>', 'Only entities after date')
        .option('--before <date>', 'Only entities before date')
        .option('--raw', 'Show debug info', false)
        .option('--no-stream', 'Wait for full response')
        .action(async (question, opts) => {
        const globals = program.opts();
        await runQuery(question, opts, globals);
    });
}
async function runQuery(question, opts, globals) {
    const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
    const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });
    const vectorStore = new VectorStore({ dbPath: config.graph.vectorDbPath });
    await vectorStore.initialize();
    const queryEngine = new QueryEngine(store, vectorStore, { maxContextTokens: config.llm.maxContextTokens });
    const router = new Router({ config });
    // Fetch graph stats for context
    const [graphStats, projects] = await Promise.all([
        store.getStats(),
        store.listProjects(),
    ]);
    const graphSummary = [
        `${graphStats.entityCount} entities, ${graphStats.relationshipCount} relationships, ${graphStats.fileCount} files indexed`,
        projects.length > 0
            ? `Projects: ${projects.map((p) => `${p.name} (${p.rootPath})`).join(', ')}`
            : 'No projects configured.',
        projects.some((p) => p.lastIngestedAt)
            ? `Last ingested: ${projects.map((p) => p.lastIngestedAt).filter(Boolean).sort().pop()}`
            : '',
    ].filter(Boolean).join('\n');
    // Assemble context
    const context = await queryEngine.assembleContext(question, undefined, opts.project);
    if (opts.raw) {
        console.log(chalk.dim(`Context: ${context.entities.length} entities, ${context.relationships.length} rels, ~${context.totalTokensEstimate} tokens\n`));
    }
    if (context.entities.length === 0 && graphStats.entityCount === 0) {
        console.log(chalk.yellow('No entities found. Try ingesting files first with `cortex watch`.'));
        store.close();
        return;
    }
    // Build context for conversational query
    const contextEntities = context.entities.map((e) => {
        const rels = context.relationships
            .filter((r) => r.sourceEntityId === e.id)
            .map((r) => ({ type: r.type, targetEntityId: r.targetEntityId }));
        return {
            id: e.id,
            type: e.type,
            name: e.name,
            content: e.content,
            sourceFile: e.sourceFile,
            createdAt: e.createdAt,
            relationships: rels,
        };
    });
    const userPrompt = conversationalQueryPrompt.buildUserPrompt({ contextEntities, userQuery: question, graphSummary });
    if (opts.stream && !globals.json) {
        // Streaming output
        const gen = router.stream({
            systemPrompt: conversationalQueryPrompt.systemPrompt,
            userPrompt,
            promptId: conversationalQueryPrompt.PROMPT_ID,
            promptVersion: conversationalQueryPrompt.PROMPT_VERSION,
            task: LLMTask.CONVERSATIONAL_QUERY,
            modelPreference: 'primary',
            temperature: conversationalQueryPrompt.config.temperature,
            maxTokens: conversationalQueryPrompt.config.maxTokens,
        });
        let fullResponse = '';
        let result;
        while (true) {
            const { value, done } = await gen.next();
            if (done) {
                result = value;
                break;
            }
            process.stdout.write(value);
            fullResponse += value;
        }
        console.log(''); // newline after streaming
        // Generate follow-ups
        await showFollowUps(router, question, fullResponse, globals);
        if (opts.raw && result) {
            console.log(chalk.dim(`\nTokens: ${result.inputTokens} in / ${result.outputTokens} out | Cost: $${result.costUsd.toFixed(4)}`));
        }
    }
    else {
        // Non-streaming
        const result = await router.complete({
            systemPrompt: conversationalQueryPrompt.systemPrompt,
            userPrompt,
            promptId: conversationalQueryPrompt.PROMPT_ID,
            promptVersion: conversationalQueryPrompt.PROMPT_VERSION,
            task: LLMTask.CONVERSATIONAL_QUERY,
            modelPreference: 'primary',
            temperature: conversationalQueryPrompt.config.temperature,
            maxTokens: conversationalQueryPrompt.config.maxTokens,
        });
        if (globals.json) {
            console.log(JSON.stringify({
                answer: result.content,
                entities: context.entities.map((e) => ({ id: e.id, type: e.type, name: e.name })),
                cost: result.costUsd,
            }));
        }
        else {
            console.log(result.content);
            await showFollowUps(router, question, result.content, globals);
        }
    }
    store.close();
}
async function showFollowUps(router, question, answer, globals) {
    if (globals.json || globals.quiet)
        return;
    try {
        const result = await router.completeStructured({
            systemPrompt: followUpGenerationPrompt.systemPrompt,
            userPrompt: followUpGenerationPrompt.buildUserPrompt({
                userQuery: question,
                answerSummary: answer.slice(0, 500),
            }),
            promptId: followUpGenerationPrompt.PROMPT_ID,
            promptVersion: followUpGenerationPrompt.PROMPT_VERSION,
            task: LLMTask.CONVERSATIONAL_QUERY,
            modelPreference: 'fast',
            temperature: followUpGenerationPrompt.config.temperature,
            maxTokens: followUpGenerationPrompt.config.maxTokens,
        }, followUpGenerationPrompt.outputSchema);
        console.log(chalk.dim('\nFollow-ups:'));
        for (const q of result.data.followUps) {
            console.log(chalk.dim(`  → ${q}`));
        }
    }
    catch {
        // Follow-up generation is non-critical
    }
}
//# sourceMappingURL=query.js.map