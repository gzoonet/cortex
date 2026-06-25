import { LLMTask } from '@cortex/core';
import type { QueryEngine, SQLiteStore } from '@cortex/graph';
import type { Router } from '@cortex/llm';
import { unifiedQueryPrompt } from '@cortex/llm';

export interface CortexAskInput {
  question: string;
  projectId?: string;
}

export interface CortexAskResult {
  answer: string;
  entities: Array<{
    id: string;
    type: string;
    name: string;
    summary?: string;
    sourceFile: string;
    confidence: number;
    tags: string[];
    relationships: Array<{
      type: string;
      direction: 'outgoing' | 'incoming';
      otherEntityName: string;
    }>;
  }>;
  contradictions: Array<{
    id: string;
    severity: string;
    description: string;
    entityNames: [string, string];
  }>;
  sourceFiles: string[];
  stats: {
    entitiesMatched: number;
    relationshipsFound: number;
    provider: string;
    model: string;
  };
}

export async function handleCortexAsk(
  input: CortexAskInput,
  queryEngine: QueryEngine,
  router: Router,
  store: SQLiteStore,
): Promise<CortexAskResult> {
  // Compute a query embedding for semantic search (best-effort — falls back to FTS-only).
  let queryEmbedding: Float32Array | undefined;
  if (router.hasEmbeddings()) {
    try {
      [queryEmbedding] = await router.embed([input.question]);
    } catch {
      queryEmbedding = undefined;
    }
  }

  // Parallel data gathering
  const [context, searchResults, allContradictions, graphStats, projects] = await Promise.all([
    queryEngine.assembleContext(input.question, queryEmbedding, input.projectId),
    store.searchEntities(input.question, 20),
    store.findContradictions({ status: 'active', limit: 50 }),
    store.getStats(),
    store.listProjects(),
  ]);

  // Merge and deduplicate entities from context + search
  const entityMap = new Map<string, typeof context.entities[0]>();
  for (const e of context.entities) {
    entityMap.set(e.id, e);
  }
  for (const e of searchResults) {
    if (!entityMap.has(e.id)) {
      entityMap.set(e.id, e);
    }
  }
  const mergedEntities = Array.from(entityMap.values());
  const mergedEntityIds = mergedEntities.map((e) => e.id);

  // Fetch relationships for all matched entities
  const relationships = await store.getRelationshipsForEntities(mergedEntityIds);

  // Filter contradictions to those involving matched entities
  const entityIdSet = new Set(mergedEntityIds);
  const relevantContradictions = allContradictions.filter(
    (c) => entityIdSet.has(c.entityIds[0]) || entityIdSet.has(c.entityIds[1]),
  );

  // Resolve contradiction entity names
  const contradictionEntries = await Promise.all(
    relevantContradictions.map(async (c) => {
      const [entityA, entityB] = await Promise.all([
        store.getEntity(c.entityIds[0]).catch(() => null),
        store.getEntity(c.entityIds[1]).catch(() => null),
      ]);
      return {
        id: c.id,
        severity: c.severity,
        description: c.description,
        entityNames: [
          entityA?.name ?? c.entityIds[0],
          entityB?.name ?? c.entityIds[1],
        ] as [string, string],
      };
    }),
  );

  // Build entity results with relationships
  const entityResults = mergedEntities.map((e) => {
    const entityRels = relationships
      .filter((r) => r.sourceEntityId === e.id || r.targetEntityId === e.id)
      .map((r) => {
        const isOutgoing = r.sourceEntityId === e.id;
        const otherId = isOutgoing ? r.targetEntityId : r.sourceEntityId;
        const other = mergedEntities.find((ent) => ent.id === otherId);
        return {
          type: r.type,
          direction: (isOutgoing ? 'outgoing' : 'incoming') as 'outgoing' | 'incoming',
          otherEntityName: other?.name ?? otherId,
        };
      });

    return {
      id: e.id,
      type: e.type,
      name: e.name,
      summary: e.summary,
      sourceFile: e.sourceFile,
      confidence: e.confidence,
      tags: e.tags,
      relationships: entityRels,
    };
  });

  // Deduplicated source files
  const sourceFiles = [...new Set(mergedEntities.map((e) => e.sourceFile))];

  // Build graph summary
  const graphSummary = [
    `${graphStats.entityCount} entities, ${graphStats.relationshipCount} relationships, ${graphStats.fileCount} files indexed`,
    projects.length > 0
      ? `Projects: ${projects.map((p) => `${p.name} (${p.rootPath})`).join(', ')}`
      : 'No projects configured.',
  ].filter(Boolean).join('\n');

  // Handle empty graph
  if (mergedEntities.length === 0 && graphStats.entityCount === 0) {
    return {
      answer: 'The knowledge graph is empty. Ingest some files first with `ingest_file` or start `cortex watch`.',
      entities: [],
      contradictions: [],
      sourceFiles: [],
      stats: { entitiesMatched: 0, relationshipsFound: 0, provider: 'none', model: 'none' },
    };
  }

  // Build enriched context for LLM
  const contextEntities = mergedEntities.map((e) => ({
    id: e.id,
    type: e.type,
    name: e.name,
    content: e.content,
    sourceFile: e.sourceFile,
    createdAt: e.createdAt,
    relationships: relationships
      .filter((r) => r.sourceEntityId === e.id)
      .map((r) => ({ type: r.type, targetEntityId: r.targetEntityId })),
  }));

  // Call LLM
  const result = await router.complete({
    systemPrompt: unifiedQueryPrompt.systemPrompt,
    userPrompt: unifiedQueryPrompt.buildUserPrompt({
      contextEntities,
      userQuery: input.question,
      graphSummary,
      contradictions: contradictionEntries,
    }),
    promptId: unifiedQueryPrompt.PROMPT_ID,
    promptVersion: unifiedQueryPrompt.PROMPT_VERSION,
    task: LLMTask.CONVERSATIONAL_QUERY,
    modelPreference: unifiedQueryPrompt.config.model,
    temperature: unifiedQueryPrompt.config.temperature,
    maxTokens: unifiedQueryPrompt.config.maxTokens,
  });

  return {
    answer: result.content,
    entities: entityResults,
    contradictions: contradictionEntries,
    sourceFiles,
    stats: {
      entitiesMatched: mergedEntities.length,
      relationshipsFound: relationships.length,
      provider: result.provider,
      model: result.model,
    },
  };
}
