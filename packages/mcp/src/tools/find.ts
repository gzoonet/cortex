import type { SQLiteStore } from '@cortex/graph';
import type { Entity, Relationship } from '@cortex/core';

export interface FindEntityInput {
  name: string;
  expand?: boolean;
  type?: string;
}

interface EntityMatch {
  id: string;
  type: string;
  name: string;
  summary?: string;
  content: string;
  sourceFile: string;
  sourceRange?: { startLine: number; endLine: number };
  confidence: number;
  tags: string[];
  createdAt: string;
  relationships: Array<{
    id: string;
    type: string;
    direction: 'outgoing' | 'incoming';
    otherEntityId: string;
    otherEntityName?: string;
    description?: string;
    confidence: number;
  }>;
}

export interface FindEntityResult {
  found: boolean;
  matches: EntityMatch[];
}

export async function handleFindEntity(
  input: FindEntityInput,
  store: SQLiteStore,
): Promise<FindEntityResult> {
  // Try exact ID lookup first, then full-text search
  let entities: Entity[] = [];
  const byId = await store.getEntity(input.name);
  if (byId) {
    entities = [byId];
  } else {
    const results = await store.searchEntities(input.name, 20);
    entities = input.type
      ? results.filter((e) => e.type === input.type)
      : results;
  }

  if (entities.length === 0) {
    return { found: false, matches: [] };
  }

  const matches = await Promise.all(
    entities.map(async (entity): Promise<EntityMatch> => {
      let relationships: EntityMatch['relationships'] = [];

      if (input.expand) {
        const rels: Relationship[] = await store.getRelationshipsForEntity(entity.id, 'both');
        relationships = await Promise.all(
          rels.map(async (rel) => {
            const isOutgoing = rel.sourceEntityId === entity.id;
            const otherId = isOutgoing ? rel.targetEntityId : rel.sourceEntityId;
            const other = await store.getEntity(otherId);
            return {
              id: rel.id,
              type: rel.type,
              direction: (isOutgoing ? 'outgoing' : 'incoming') as 'outgoing' | 'incoming',
              otherEntityId: otherId,
              otherEntityName: other?.name,
              description: rel.description,
              confidence: rel.confidence,
            };
          }),
        );
      }

      return {
        id: entity.id,
        type: entity.type,
        name: entity.name,
        summary: entity.summary,
        content: entity.content,
        sourceFile: entity.sourceFile,
        sourceRange: entity.sourceRange,
        confidence: entity.confidence,
        tags: entity.tags,
        createdAt: entity.createdAt,
        relationships,
      };
    }),
  );

  return { found: true, matches };
}
