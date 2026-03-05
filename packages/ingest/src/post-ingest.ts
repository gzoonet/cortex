import {
  eventBus,
  createLogger,
  LLMTask,
  type Entity,
} from '@cortex/core';
import {
  mergeDetectionPrompt,
  contradictionDetectionPrompt,
  type Router,
} from '@cortex/llm';
import type { SQLiteStore } from '@cortex/graph';

const logger = createLogger('ingest:post-ingest');

/**
 * Run P3 merge detection for each newly stored entity against existing graph
 * entities with similar names. Always routes to local provider — high-volume,
 * low-stakes task that should never hit cloud.
 *
 * Skipped entirely if no local provider is available.
 */
export async function runMergeDetection(
  entities: Entity[],
  sourceFile: string,
  store: SQLiteStore,
  router: Router,
  mergeConfidenceThreshold: number,
): Promise<void> {
  // Skip if no local provider configured
  if (!router.getLocalProvider()) {
    return;
  }

  for (const entity of entities) {
    let candidates: Entity[];
    try {
      candidates = await store.searchEntities(entity.name, 5);
    } catch {
      continue;
    }

    // Only compare against active entities of the same type from different source files
    const others = candidates.filter(
      (c) => c.id !== entity.id && c.sourceFile !== sourceFile && c.status !== 'superseded' && c.type === entity.type,
    );

    for (const candidate of others) {
      try {
        const result = await router.completeStructured(
          {
            systemPrompt: mergeDetectionPrompt.systemPrompt,
            userPrompt: mergeDetectionPrompt.buildUserPrompt({
              a: { type: entity.type, name: entity.name, summary: entity.summary, sourceFile: entity.sourceFile },
              b: { type: candidate.type, name: candidate.name, summary: candidate.summary, sourceFile: candidate.sourceFile },
            }),
            promptId: mergeDetectionPrompt.PROMPT_ID,
            promptVersion: mergeDetectionPrompt.PROMPT_VERSION,
            task: LLMTask.ENTITY_EXTRACTION,
            temperature: mergeDetectionPrompt.config.temperature,
            maxTokens: mergeDetectionPrompt.config.maxTokens,
            forceProvider: 'local',
          },
          mergeDetectionPrompt.outputSchema,
        );

        if (result.data.shouldMerge && result.data.confidence >= mergeConfidenceThreshold) {
          await store.updateEntity(candidate.id, { status: 'superseded' });

          eventBus.emit({
            type: 'entity.merged',
            payload: { survivorId: entity.id, mergedId: candidate.id },
            timestamp: new Date().toISOString(),
            source: 'ingest:post-ingest',
          });

          logger.info('Entity merged', {
            survivor: entity.name,
            merged: candidate.name,
            confidence: result.data.confidence,
            reason: result.data.reason,
          });
        }
      } catch (err) {
        logger.debug('Merge detection failed for pair', {
          entity: entity.name,
          candidate: candidate.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

/**
 * Run P4 contradiction detection for each newly stored entity against existing
 * graph entities of the same type. Routes to cloud (Haiku) by default.
 * Skipped for restricted projects. Forced local for sensitive.
 *
 * Cost controls:
 * - contradictedFilePairs: skip LLM call once a contradiction is found for a file pair
 * - checkedEntityPairs: skip LLM call if this exact entity pair was already evaluated
 *   (prevents cross-batch duplicates when files A and B both ingest in the same run)
 * - type constraint: only compare same-type entities (same as merge detection)
 * - search limit 5: matches merge detection limit
 */
export async function runContradictionDetection(
  entities: Entity[],
  sourceFile: string,
  projectId: string,
  privacyLevel: 'standard' | 'sensitive' | 'restricted',
  store: SQLiteStore,
  router: Router,
  checkedEntityPairs: Set<string> = new Set(),
): Promise<void> {
  // Restricted: never send content to cloud; skip contradiction detection entirely
  if (privacyLevel === 'restricted') {
    return;
  }

  // Standard privacy: no forceProvider — task routing config (contradiction_detection) decides
  // Sensitive: force local for privacy
  const privacyForce = privacyLevel === 'sensitive'
    ? { forceProvider: 'local' as const }
    : {};

  // Once a contradiction is found for a file pair, skip remaining pairs from those files.
  // This prevents LLM calls for every entity pair after the first match.
  const contradictedFilePairs = new Set<string>();

  for (const entity of entities) {
    let candidates: Entity[];
    try {
      candidates = await store.searchEntities(entity.name, 5);
    } catch {
      continue;
    }

    // Only compare same-type entities from different source files (mirrors merge detection)
    const others = candidates.filter(
      (c) => c.id !== entity.id && c.sourceFile !== sourceFile && c.status !== 'superseded' && c.type === entity.type,
    );

    for (const candidate of others) {
      // Skip if we already found a contradiction between these two files this run
      const filePairKey = [entity.sourceFile, candidate.sourceFile].sort().join('\0');
      if (contradictedFilePairs.has(filePairKey)) continue;

      // Skip if this exact entity pair was already evaluated (cross-batch dedup)
      const entityPairKey = [entity.id, candidate.id].sort().join('\0');
      if (checkedEntityPairs.has(entityPairKey)) continue;
      checkedEntityPairs.add(entityPairKey);

      try {
        const result = await router.completeStructured(
          {
            systemPrompt: contradictionDetectionPrompt.systemPrompt,
            userPrompt: contradictionDetectionPrompt.buildUserPrompt({
              a: {
                type: entity.type,
                name: entity.name,
                content: entity.summary ?? entity.content,
                createdAt: entity.createdAt,
                sourceFile: entity.sourceFile,
              },
              b: {
                type: candidate.type,
                name: candidate.name,
                content: candidate.summary ?? candidate.content,
                createdAt: candidate.createdAt,
                sourceFile: candidate.sourceFile,
              },
            }),
            promptId: contradictionDetectionPrompt.PROMPT_ID,
            promptVersion: contradictionDetectionPrompt.PROMPT_VERSION,
            task: LLMTask.CONTRADICTION_DETECTION,
            temperature: contradictionDetectionPrompt.config.temperature,
            maxTokens: contradictionDetectionPrompt.config.maxTokens,
            ...privacyForce,
          },
          contradictionDetectionPrompt.outputSchema,
        );

        if (result.data.isContradiction) {
          contradictedFilePairs.add(filePairKey);

          const contradiction = await store.createContradiction({
            entityIds: [entity.id, candidate.id],
            description: result.data.description,
            severity: result.data.severity,
            suggestedResolution: result.data.suggestedResolution,
            status: 'active',
            detectedAt: new Date().toISOString(),
          });

          eventBus.emit({
            type: 'contradiction.detected',
            payload: { contradiction },
            timestamp: new Date().toISOString(),
            source: 'ingest:post-ingest',
          });

          logger.info('Contradiction detected', {
            entityA: entity.name,
            entityB: candidate.name,
            severity: result.data.severity,
          });
        }
      } catch (err) {
        logger.debug('Contradiction detection failed for pair', {
          entity: entity.name,
          candidate: candidate.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
