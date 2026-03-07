import { readFileSync, statSync, realpathSync } from 'node:fs';
import { relative, extname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  eventBus,
  createLogger,
  CortexError,
  INGEST_PARSE_FAILED,
  INGEST_FILE_TOO_LARGE,
  INGEST_UNSUPPORTED_TYPE,
  LLM_EXTRACTION_FAILED,
  LLMTask,
  type Entity,
  type EntityType,
} from '@cortex/core';
import type { Router } from '@cortex/llm';
import {
  entityExtractionPrompt,
  relationshipInferencePrompt,
} from '@cortex/llm';
import type { SQLiteStore } from '@cortex/graph';
import { getParser } from './parsers/index.js';
import { chunkSections, type Chunk } from './chunker.js';
import { runMergeDetection, runContradictionDetection } from './post-ingest.js';

const logger = createLogger('ingest:pipeline');

export interface PipelineOptions {
  projectId: string;
  projectName: string;
  projectRoot: string;
  maxFileSize: number;
  batchSize: number;
  projectPrivacyLevel: 'standard' | 'sensitive' | 'restricted';
  mergeConfidenceThreshold: number;
  secretPatterns?: string[];
}

export interface PipelineResult {
  fileId: string;
  entityIds: string[];
  relationshipIds: string[];
  status: 'ingested' | 'failed' | 'skipped';
  error?: string;
}

export class IngestionPipeline {
  private router: Router;
  private store: SQLiteStore;
  private options: PipelineOptions;
  // Shared across all ingestFile calls — prevents the same entity pair from being
  // evaluated twice when multiple files ingest in the same batch.
  private checkedContradictionPairs: Set<string> = new Set();
  // Pre-compiled secret patterns for scrubbing before cloud LLM calls
  private compiledSecretPatterns: RegExp[];

  constructor(
    router: Router,
    store: SQLiteStore,
    options: PipelineOptions,
  ) {
    this.router = router;
    this.store = store;
    this.options = options;
    this.compiledSecretPatterns = (options.secretPatterns ?? [])
      .map((pattern) => {
        try {
          return new RegExp(pattern, 'g');
        } catch {
          logger.warn('Invalid secret pattern, skipping', { pattern });
          return null;
        }
      })
      .filter((r): r is RegExp => r !== null);
  }

  /**
   * Scrub secrets from content before sending to cloud LLMs.
   * Only applied for standard privacy (sensitive/restricted use local provider).
   */
  private scrubSecrets(content: string): string {
    if (this.compiledSecretPatterns.length === 0) return content;
    let scrubbed = content;
    for (const re of this.compiledSecretPatterns) {
      re.lastIndex = 0; // reset global regex state
      scrubbed = scrubbed.replace(re, '[SECRET_REDACTED]');
    }
    return scrubbed;
  }

  async ingestFile(filePath: string): Promise<PipelineResult> {
    // Resolve symlinks and verify the real path is within the project root
    try {
      const realPath = realpathSync(filePath);
      const projectRoot = resolve(this.options.projectRoot);
      const rel = relative(projectRoot, realPath);
      if (rel.startsWith('..') || resolve(realPath) !== resolve(projectRoot, rel)) {
        logger.warn('Symlink traversal blocked — file resolves outside project root', {
          filePath,
          realPath,
          projectRoot,
        });
        return { fileId: '', entityIds: [], relationshipIds: [], status: 'skipped', error: 'Outside project root' };
      }
    } catch {
      // realpathSync failed — file may not exist yet, let downstream handle it
    }

    const ext = extname(filePath).slice(1).toLowerCase();

    // Quick extension check — skip entirely unsupported types before reading
    if (!getParser(ext)) {
      logger.debug('Unsupported file type, skipping', { filePath, ext });
      return { fileId: '', entityIds: [], relationshipIds: [], status: 'skipped' };
    }

    // Check file size
    let stat;
    try {
      stat = statSync(filePath);
    } catch {
      return { fileId: '', entityIds: [], relationshipIds: [], status: 'failed', error: 'File not found' };
    }

    if (stat.size > this.options.maxFileSize) {
      logger.warn('File too large, skipping', { filePath, size: stat.size, max: this.options.maxFileSize });
      return { fileId: '', entityIds: [], relationshipIds: [], status: 'skipped', error: 'File too large' };
    }

    // Read file
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (err) {
      return {
        fileId: '', entityIds: [], relationshipIds: [], status: 'failed',
        error: `Read error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Re-resolve parser with content for conversation format sniffing
    const parser = getParser(ext, filePath, content)!;

    // Compute content hash
    const contentHash = createHash('sha256').update(content).digest('hex');

    // Check if already ingested with same hash
    const existingFile = await this.store.getFile(filePath);
    if (existingFile && existingFile.contentHash === contentHash && existingFile.status === 'ingested') {
      logger.debug('File unchanged, skipping', { filePath });
      return {
        fileId: existingFile.id,
        entityIds: existingFile.entityIds,
        relationshipIds: [],
        status: 'ingested',
      };
    }

    const relativePath = relative(this.options.projectRoot, filePath);

    try {
      // Parse file
      logger.debug('Parsing file', { filePath, ext });
      const parseResult = await parser.parse(content, filePath);

      // Chunk
      const chunks = chunkSections(parseResult.sections);
      logger.debug('Chunked file', { filePath, chunks: chunks.length });

      // Extract entities from each chunk
      type EntityInput = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>;
      const allEntities: EntityInput[] = [];
      let extractionErrors = 0;
      for (const chunk of chunks) {
        const { entities, hadError } = await this.extractEntities(chunk, filePath, ext);
        if (hadError) extractionErrors++;
        allEntities.push(...entities);
      }

      // If every chunk failed with an LLM error (not just "no entities found"), surface it
      // so the file is marked 'failed' and retried on the next watch run.
      if (allEntities.length === 0 && extractionErrors > 0 && chunks.length > 0) {
        throw new CortexError(
          LLM_EXTRACTION_FAILED, 'high', 'llm',
          `Entity extraction failed for all ${chunks.length} chunk(s) in ${filePath}`,
        );
      }

      // Deduplicate entities by name within this file
      const deduped = this.deduplicateEntities(allEntities);
      logger.debug('Extracted entities', { filePath, raw: allEntities.length, deduped: deduped.length });

      // Store entities in a transaction for atomicity and performance
      // (better-sqlite3 operations are synchronous, so await resolves immediately)
      const storedEntities: Entity[] = [];
      this.store.transaction(() => {
        for (const entity of deduped) {
          // createEntity is sync under the hood (better-sqlite3)
          storedEntities.push(this.store.createEntitySync(entity));
        }
      });

      // Emit events outside the transaction
      for (const stored of storedEntities) {
        eventBus.emit({
          type: 'entity.created',
          payload: { entity: stored },
          timestamp: new Date().toISOString(),
          source: 'ingest:pipeline',
        });
      }

      // Post-ingest: merge detection (P3) and contradiction detection (P4)
      await runMergeDetection(
        storedEntities,
        filePath,
        this.store,
        this.router,
        this.options.mergeConfidenceThreshold,
      );
      await runContradictionDetection(
        storedEntities,
        filePath,
        this.options.projectId,
        this.options.projectPrivacyLevel,
        this.store,
        this.router,
        this.checkedContradictionPairs,
      );

      // Infer relationships between entities
      const relationshipIds: string[] = [];
      if (storedEntities.length >= 2) {
        const rels = await this.inferRelationships(storedEntities);
        relationshipIds.push(...rels);
      }

      // Update file record
      const entityIds = storedEntities.map((e) => e.id);
      const fileRecord = await this.store.upsertFile({
        path: filePath,
        relativePath,
        projectId: this.options.projectId,
        contentHash,
        fileType: ext,
        sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
        lastIngestedAt: new Date().toISOString(),
        entityIds,
        status: 'ingested',
      });

      // Emit file ingested
      eventBus.emit({
        type: 'file.ingested',
        payload: { fileId: fileRecord.id, entityIds, relationshipIds },
        timestamp: new Date().toISOString(),
        source: 'ingest:pipeline',
      });

      logger.info('File ingested', {
        filePath: relativePath,
        entities: entityIds.length,
        relationships: relationshipIds.length,
      });

      return { fileId: fileRecord.id, entityIds, relationshipIds, status: 'ingested' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Ingestion failed', { filePath, error: errorMsg });

      // Record failed file
      await this.store.upsertFile({
        path: filePath,
        relativePath,
        projectId: this.options.projectId,
        contentHash,
        fileType: ext,
        sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
        entityIds: [],
        status: 'failed',
        parseError: errorMsg,
      });

      return { fileId: '', entityIds: [], relationshipIds: [], status: 'failed', error: errorMsg };
    }
  }

  private async extractEntities(
    chunk: Chunk,
    filePath: string,
    fileType: string,
  ): Promise<{ entities: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>[]; hadError: boolean }> {
    const contentHash = createHash('sha256').update(chunk.content).digest('hex');
    // Step 4: privacy enforcement — restricted/sensitive never go to cloud
    const privacyOverride = this.options.projectPrivacyLevel !== 'standard'
      ? { forceProvider: 'local' as const }
      : {};

    // Step 2: scrub secrets before sending to cloud LLM
    // (only relevant for standard privacy; sensitive/restricted use local provider)
    const safeContent = this.options.projectPrivacyLevel === 'standard'
      ? this.scrubSecrets(chunk.content)
      : chunk.content;

    try {
      const result = await this.router.completeStructured(
        {
          systemPrompt: entityExtractionPrompt.systemPrompt,
          userPrompt: entityExtractionPrompt.buildUserPrompt({
            filePath,
            projectName: this.options.projectName,
            fileType,
            content: safeContent,
          }),
          promptId: entityExtractionPrompt.PROMPT_ID,
          promptVersion: entityExtractionPrompt.PROMPT_VERSION,
          task: LLMTask.ENTITY_EXTRACTION,
          modelPreference: entityExtractionPrompt.config.model,
          temperature: entityExtractionPrompt.config.temperature,
          maxTokens: entityExtractionPrompt.config.maxTokens,
          contentHash,
          ...privacyOverride,
        },
        entityExtractionPrompt.outputSchema,
      );

      return {
        entities: result.data.entities.map((e) => ({
          type: e.type as EntityType,
          name: e.name,
          content: e.content,
          summary: e.summary,
          properties: e.properties,
          confidence: e.confidence,
          sourceFile: filePath,
          sourceRange: { startLine: chunk.startLine, endLine: chunk.endLine },
          projectId: this.options.projectId,
          extractedBy: {
            promptId: entityExtractionPrompt.PROMPT_ID,
            promptVersion: entityExtractionPrompt.PROMPT_VERSION,
            model: result.model,
            provider: result.provider,
            tokensUsed: { input: result.inputTokens, output: result.outputTokens },
            timestamp: new Date().toISOString(),
          },
          tags: e.tags,
          status: 'active' as const,
        })),
        hadError: false,
      };
    } catch (err) {
      logger.warn('Entity extraction failed for chunk', {
        filePath,
        chunk: chunk.index,
        error: err instanceof Error ? err.message : String(err),
      });
      return { entities: [], hadError: true };
    }
  }

  private async inferRelationships(entities: Entity[]): Promise<string[]> {
    // Step 4: privacy enforcement — restricted/sensitive never go to cloud
    const privacyOverride = this.options.projectPrivacyLevel !== 'standard'
      ? { forceProvider: 'local' as const }
      : {};

    try {
      const result = await this.router.completeStructured(
        {
          systemPrompt: relationshipInferencePrompt.systemPrompt,
          userPrompt: relationshipInferencePrompt.buildUserPrompt({
            entities: entities.map((e) => ({
              id: e.id,
              type: e.type,
              name: e.name,
              summary: e.summary,
              sourceFile: e.sourceFile,
            })),
          }),
          promptId: relationshipInferencePrompt.PROMPT_ID,
          promptVersion: relationshipInferencePrompt.PROMPT_VERSION,
          task: LLMTask.RELATIONSHIP_INFERENCE,
          modelPreference: relationshipInferencePrompt.config.model,
          temperature: relationshipInferencePrompt.config.temperature,
          maxTokens: relationshipInferencePrompt.config.maxTokens,
          ...privacyOverride,
        },
        relationshipInferencePrompt.outputSchema,
      );

      const entityIdSet = new Set(entities.map((e) => e.id));
      const relationshipIds: string[] = [];

      for (const rel of result.data.relationships) {
        // Validate that referenced entities exist
        if (!entityIdSet.has(rel.sourceEntityId) || !entityIdSet.has(rel.targetEntityId)) {
          continue;
        }

        const stored = await this.store.createRelationship({
          type: rel.type,
          sourceEntityId: rel.sourceEntityId,
          targetEntityId: rel.targetEntityId,
          description: rel.description,
          confidence: rel.confidence,
          properties: {},
          extractedBy: {
            promptId: relationshipInferencePrompt.PROMPT_ID,
            promptVersion: relationshipInferencePrompt.PROMPT_VERSION,
            model: result.model,
            provider: result.provider,
            tokensUsed: { input: result.inputTokens, output: result.outputTokens },
            timestamp: new Date().toISOString(),
          },
        });

        relationshipIds.push(stored.id);

        eventBus.emit({
          type: 'relationship.created',
          payload: { relationship: stored },
          timestamp: new Date().toISOString(),
          source: 'ingest:pipeline',
        });
      }

      return relationshipIds;
    } catch (err) {
      logger.warn('Relationship inference failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private deduplicateEntities(
    entities: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>[],
  ): Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>[] {
    const seen = new Map<string, Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>>();

    for (const entity of entities) {
      const key = `${entity.type}:${entity.name.toLowerCase()}`;
      const existing = seen.get(key);

      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }

    return [...seen.values()];
  }
}
