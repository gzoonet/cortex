import type { Entity, Relationship } from '@cortex/core';
import { createLogger } from '@cortex/core';
import type { SQLiteStore } from './sqlite-store.js';
import type { VectorStore, VectorSearchResult } from './vector-store.js';

const logger = createLogger('graph:query-engine');

export interface QueryContext {
  entities: Entity[];
  relationships: Relationship[];
  totalTokensEstimate: number;
}

export interface QueryEngineOptions {
  maxContextTokens?: number;
  maxResultEntities?: number;
  ftsWeight?: number;
  vectorWeight?: number;
}

const AVG_CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}

const FTS_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'what', 'which', 'who', 'how', 'why', 'when', 'where', 'that', 'this',
  'these', 'those', 'it', 'its', 'me', 'my', 'you', 'your', 'we', 'our',
  'they', 'their', 'he', 'she', 'i', 'all', 'any', 'each', 'some', 'no',
  'not', 'so', 'yet', 'use', 'used', 'using', 'about', 'tell', 'know',
  'get', 'got', 'make', 'made', 'see', 'give', 'go', 'come', 'take',
]);

export class QueryEngine {
  private sqliteStore: SQLiteStore;
  private vectorStore: VectorStore;
  private maxContextTokens: number;
  private maxResultEntities: number;
  private ftsWeight: number;
  private vectorWeight: number;

  constructor(
    sqliteStore: SQLiteStore,
    vectorStore: VectorStore,
    options: QueryEngineOptions = {},
  ) {
    this.sqliteStore = sqliteStore;
    this.vectorStore = vectorStore;
    this.maxContextTokens = options.maxContextTokens ?? 50_000;
    this.maxResultEntities = options.maxResultEntities ?? 30;
    this.ftsWeight = options.ftsWeight ?? 0.4;
    this.vectorWeight = options.vectorWeight ?? 0.6;
  }

  async assembleContext(
    query: string,
    queryEmbedding?: Float32Array,
    projectId?: string,
  ): Promise<QueryContext> {
    // Run FTS and vector search in parallel
    const [ftsResults, vectorResults] = await Promise.all([
      this.ftsSearch(query, projectId),
      queryEmbedding ? this.vectorStore.search(queryEmbedding, 30) : Promise.resolve([]),
    ]);

    // Merge and rank results
    const rankedEntities = this.mergeAndRank(ftsResults, vectorResults);

    // Collect entities up to token budget and entity count limit
    const contextEntities: Entity[] = [];
    let totalTokens = 0;
    const budgetForEntities = Math.floor(this.maxContextTokens * 0.7);

    for (const entity of rankedEntities) {
      if (contextEntities.length >= this.maxResultEntities) break;
      const entityTokens = estimateTokens(entity.content) + estimateTokens(entity.name);
      if (totalTokens + entityTokens > budgetForEntities) break;
      contextEntities.push(entity);
      totalTokens += entityTokens;
    }

    // Filter entities by project privacy level
    const privacyFiltered = await this.filterByPrivacy(contextEntities);

    // Gather relationships between context entities (single batch query)
    const entityIds = new Set(privacyFiltered.map((e) => e.id));
    const allRels = await this.sqliteStore.getRelationshipsForEntities([...entityIds]);
    const uniqueRels = allRels.filter(
      (r) => entityIds.has(r.sourceEntityId) && entityIds.has(r.targetEntityId),
    );

    const relTokens = uniqueRels.reduce(
      (sum, r) => sum + estimateTokens(r.description ?? '') + 20,
      0,
    );

    // Recalculate tokens after privacy filtering (content may have been redacted)
    const filteredTokens = privacyFiltered.reduce(
      (sum, e) => sum + estimateTokens(e.content) + estimateTokens(e.name),
      0,
    );

    logger.debug('Context assembled', {
      entities: privacyFiltered.length,
      entitiesFiltered: contextEntities.length - privacyFiltered.length,
      relationships: uniqueRels.length,
      totalTokensEstimate: filteredTokens + relTokens,
    });

    return {
      entities: privacyFiltered,
      relationships: uniqueRels,
      totalTokensEstimate: filteredTokens + relTokens,
    };
  }

  private async filterByPrivacy(entities: Entity[]): Promise<Entity[]> {
    if (entities.length === 0) return entities;

    // Batch-fetch unique project IDs to avoid N+1 queries
    const projectIds = [...new Set(entities.map((e) => e.projectId))];
    const projectPrivacy = new Map<string, string>();

    for (const pid of projectIds) {
      const project = await this.sqliteStore.getProject(pid);
      if (project) {
        projectPrivacy.set(pid, project.privacyLevel);
      }
    }

    const filtered: Entity[] = [];
    let excluded = 0;
    let redacted = 0;

    for (const entity of entities) {
      const level = projectPrivacy.get(entity.projectId) ?? 'standard';

      if (level === 'restricted') {
        excluded++;
        continue;
      }

      if (level === 'sensitive') {
        redacted++;
        filtered.push({ ...entity, content: '[REDACTED]', properties: {} });
        continue;
      }

      filtered.push(entity);
    }

    if (excluded > 0 || redacted > 0) {
      logger.info('Privacy filter applied', { excluded, redacted, kept: filtered.length });
    }

    return filtered;
  }

  /**
   * Converts a natural language query to an FTS5-safe keyword query.
   * FTS5 uses AND semantics by default, so "what is the architecture" would
   * require ALL words to match. We strip stop words and use OR semantics so
   * entities matching ANY meaningful keyword are returned.
   */
  private buildFtsQuery(query: string): string {
    const keywords = query
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !FTS_STOP_WORDS.has(w));

    if (keywords.length === 0) {
      // Fallback: sanitize raw query for FTS5 safety
      return query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    }

    return keywords.join(' OR ');
  }

  private async ftsSearch(query: string, projectId?: string): Promise<Entity[]> {
    const ftsQuery = this.buildFtsQuery(query);
    try {
      if (projectId) {
        return await this.sqliteStore.findEntities({
          search: ftsQuery,
          projectId,
          limit: 30,
        });
      }
      return await this.sqliteStore.searchEntities(ftsQuery, 30);
    } catch (err) {
      logger.warn('FTS search failed, returning empty results', {
        error: err instanceof Error ? err.message : String(err),
        query: ftsQuery,
      });
      return [];
    }
  }

  private mergeAndRank(
    ftsResults: Entity[],
    vectorResults: VectorSearchResult[],
  ): Entity[] {
    // Score-based ranking combining FTS rank position and vector distance
    const scores = new Map<string, { entity: Entity; score: number }>();

    // FTS results: score by position (best match first)
    for (let i = 0; i < ftsResults.length; i++) {
      const entity = ftsResults[i]!;
      const positionScore = 1 - i / Math.max(ftsResults.length, 1);
      scores.set(entity.id, {
        entity,
        score: positionScore * this.ftsWeight,
      });
    }

    // Vector results: score by inverse distance
    if (vectorResults.length > 0) {
      const maxDist = Math.max(...vectorResults.map((r) => r.distance), 1);
      for (const vr of vectorResults) {
        const distScore = 1 - vr.distance / maxDist;
        const existing = scores.get(vr.entityId);
        if (existing) {
          existing.score += distScore * this.vectorWeight;
        }
        // Vector-only results would need entity fetch — skip for now.
        // They'll be included once QueryEngine integrates more tightly.
      }
    }

    return [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .map((s) => s.entity);
  }
}
