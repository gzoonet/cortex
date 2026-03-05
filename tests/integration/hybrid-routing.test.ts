/**
 * Integration test: Hybrid routing (US-201)
 * Entity extraction → Ollama, relationship inference → Anthropic (cloud).
 *
 * @requires-ollama
 * @requires-anthropic
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { eventBus, LLMTask } from '../../packages/core/src/index.js';
import type { CortexEvent } from '../../packages/core/src/types/events.js';

const OLLAMA_HOST = process.env['CORTEX_OLLAMA_HOST'] ?? 'http://localhost:11434';
const HAS_OLLAMA = !!process.env['CORTEX_OLLAMA_HOST'];
const HAS_ANTHROPIC = !!process.env['CORTEX_ANTHROPIC_API_KEY'];
const SKIP = !HAS_OLLAMA || !HAS_ANTHROPIC;

describe.skipIf(SKIP)('hybrid routing (US-201)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = resolve(tmpdir(), `cortex-hybrid-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('entity extraction uses Ollama, relationship inference uses Anthropic', async () => {
    const taskProviders: Array<{ task: string; provider: string }> = [];

    const unsub = eventBus.on('llm.request.start', (e: CortexEvent) => {
      taskProviders.push(e.payload as { task: string; provider: string });
    });

    const { SQLiteStore } = await import('../../packages/graph/src/sqlite-store.js');
    const { Router } = await import('../../packages/llm/src/router.js');
    const { IngestionPipeline } = await import('../../packages/ingest/src/pipeline.js');

    const dbPath = resolve(tmpDir, 'test.db');
    const store = new SQLiteStore({ dbPath, walMode: false, backupOnStartup: false });

    const config = {
      llm: {
        mode: 'hybrid' as const,
        taskRouting: {},
        temperature: { extraction: 0.1, chat: 0.7, ranking: 0.1, proactive: 0.5 },
        maxContextTokens: 50000,
        cache: { enabled: false, ttlDays: 1, maxSizeMb: 10 },
        budget: { monthlyLimitUsd: 25, warningThresholds: [0.5, 0.8, 0.9], enforcementAction: 'fallback-local' as const },
        local: {
          provider: 'ollama' as const,
          host: OLLAMA_HOST,
          model: 'mistral:7b-instruct-q5_K_M',
          embeddingModel: 'nomic-embed-text',
          numCtx: 4096,
          numGpu: -1,
          timeoutMs: 60000,
          keepAlive: '5m',
        },
        cloud: {
          provider: 'anthropic' as const,
          apiKeySource: 'env:CORTEX_ANTHROPIC_API_KEY',
          models: { primary: 'claude-sonnet-4-5-20250929', fast: 'claude-haiku-4-5-20251001' },
          timeoutMs: 30000,
          maxRetries: 3,
          promptCaching: false,
        },
      },
    };

    const router = new Router({ config: config as never });
    const project = await store.createProject({
      name: 'hybrid-test',
      rootPath: tmpDir,
      privacyLevel: 'standard',
      fileCount: 0,
      entityCount: 0,
    });

    const testFile = resolve(tmpDir, 'arch.md');
    writeFileSync(testFile, [
      '# Architecture Decisions',
      '',
      '## Decision: PostgreSQL for storage',
      'We decided to use PostgreSQL as our primary database.',
      'It provides ACID compliance and good concurrent write support.',
      '',
      '## Component: API Gateway',
      'The API gateway handles authentication and rate limiting.',
      'It depends on the PostgreSQL decision for session storage.',
    ].join('\n'));

    const pipeline = new IngestionPipeline(router, store, {
      projectId: project.id,
      projectName: project.name,
      projectRoot: tmpDir,
      maxFileSize: 10_000_000,
      batchSize: 5,
      projectPrivacyLevel: 'standard',
      mergeConfidenceThreshold: 0.85,
    });

    await pipeline.ingestFile(testFile);
    unsub();

    const extractionRequests = taskProviders.filter((r) => r.task === LLMTask.ENTITY_EXTRACTION);
    const inferenceRequests = taskProviders.filter((r) => r.task === LLMTask.RELATIONSHIP_INFERENCE);

    // In hybrid mode: entity extraction → ollama, relationship inference → anthropic
    expect(extractionRequests.length).toBeGreaterThan(0);
    for (const r of extractionRequests) {
      expect(r.provider).toBe('ollama');
    }

    if (inferenceRequests.length > 0) {
      for (const r of inferenceRequests) {
        expect(r.provider).toBe('anthropic');
      }
    }

    store.close();
  });
});
