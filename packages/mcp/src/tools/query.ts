import { LLMTask } from '@cortex/core';
import type { QueryEngine } from '@cortex/graph';
import type { Router } from '@cortex/llm';
import { conversationalQueryPrompt } from '@cortex/llm';

export interface QueryCortexInput {
  question: string;
  projectId?: string;
}

export interface QueryCortexResult {
  answer: string;
  citations: Array<{
    entityId: string;
    entityType: string;
    entityName: string;
    sourceFile: string;
  }>;
  entityCount: number;
  provider: string;
  model: string;
}

export async function handleQueryCortex(
  input: QueryCortexInput,
  queryEngine: QueryEngine,
  router: Router,
  store: import('@cortex/graph').SQLiteStore,
): Promise<QueryCortexResult> {
  const [context, graphStats, projects] = await Promise.all([
    queryEngine.assembleContext(input.question, undefined, input.projectId),
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

  if (context.entities.length === 0 && graphStats.entityCount === 0) {
    return {
      answer: 'No entities found. Make sure `cortex watch` has been run on your project files.',
      citations: [],
      entityCount: 0,
      provider: 'none',
      model: 'none',
    };
  }

  const contextEntities = context.entities.map((e) => ({
    id: e.id,
    type: e.type,
    name: e.name,
    content: e.content,
    sourceFile: e.sourceFile,
    createdAt: e.createdAt,
    relationships: context.relationships
      .filter((r) => r.sourceEntityId === e.id)
      .map((r) => ({ type: r.type, targetEntityId: r.targetEntityId })),
  }));

  const result = await router.complete({
    systemPrompt: conversationalQueryPrompt.systemPrompt,
    userPrompt: conversationalQueryPrompt.buildUserPrompt({
      contextEntities,
      userQuery: input.question,
      graphSummary,
    }),
    promptId: conversationalQueryPrompt.PROMPT_ID,
    promptVersion: conversationalQueryPrompt.PROMPT_VERSION,
    task: LLMTask.CONVERSATIONAL_QUERY,
    modelPreference: conversationalQueryPrompt.config.model,
    temperature: conversationalQueryPrompt.config.temperature,
    maxTokens: conversationalQueryPrompt.config.maxTokens,
  });

  return {
    answer: result.content,
    citations: context.entities.map((e) => ({
      entityId: e.id,
      entityType: e.type,
      entityName: e.name,
      sourceFile: e.sourceFile,
    })),
    entityCount: context.entities.length,
    provider: result.provider,
    model: result.model,
  };
}
