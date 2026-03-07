import type { SQLiteStore } from '@cortex/graph';

export interface SearchEntitiesInput {
  query: string;
  limit?: number;
  type?: string;
}

export interface SearchEntitiesResult {
  count: number;
  entities: Array<{
    id: string;
    type: string;
    name: string;
    summary?: string;
    sourceFile: string;
    confidence: number;
    tags: string[];
  }>;
}

export async function handleSearchEntities(
  input: SearchEntitiesInput,
  store: SQLiteStore,
): Promise<SearchEntitiesResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
  let entities = await store.searchEntities(input.query, limit);

  if (input.type) {
    entities = entities.filter((e) => e.type === input.type);
  }

  return {
    count: entities.length,
    entities: entities.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      summary: e.summary,
      sourceFile: e.sourceFile,
      confidence: e.confidence,
      tags: e.tags,
    })),
  };
}
