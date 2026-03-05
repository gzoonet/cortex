/**
 * Integration test: Privacy enforcement (US-203)
 * Tests that restricted/sensitive projects never send content to cloud.
 * Requires Ollama running locally. Skipped if CORTEX_OLLAMA_HOST not set
 * or llm mode is cloud-first without a local provider.
 *
 * @requires-ollama
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync } from 'node:fs';
import { eventBus } from '../../packages/core/src/index.js';
import type { CortexEvent } from '../../packages/core/src/types/events.js';

const OLLAMA_HOST = process.env['CORTEX_OLLAMA_HOST'] ?? 'http://localhost:11434';
const SKIP = !process.env['CORTEX_OLLAMA_HOST'];

describe.skipIf(SKIP)('privacy enforcement (restricted projects)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = resolve(tmpdir(), `cortex-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('restricted project: no LLM requests go to cloud provider', async () => {
    const cloudRequests: string[] = [];
    const unsub = eventBus.on('llm.request.start', (e: CortexEvent) => {
      const payload = e.payload as { provider: string };
      if (payload.provider === 'anthropic') {
        cloudRequests.push(payload.provider);
      }
    });

    const { SQLiteStore } = await import('../../packages/graph/src/sqlite-store.js');
    const { Router } = await import('../../packages/llm/src/router.js');
    const { IngestionPipeline } = await import('../../packages/ingest/src/pipeline.js');
    const { writeFileSync } = await import('node:fs');

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
      name: 'restricted-test',
      rootPath: tmpDir,
      privacyLevel: 'restricted',
      fileCount: 0,
      entityCount: 0,
    });

    const testFile = resolve(tmpDir, 'secret.md');
    writeFileSync(testFile, '# Secret Decision\n\nWe will use proprietary algorithm X for classification.\n');

    const pipeline = new IngestionPipeline(router, store, {
      projectId: project.id,
      projectName: project.name,
      projectRoot: tmpDir,
      maxFileSize: 10_000_000,
      batchSize: 5,
      projectPrivacyLevel: 'restricted',
      mergeConfidenceThreshold: 0.85,
    });

    await pipeline.ingestFile(testFile);
    unsub();

    expect(cloudRequests).toHaveLength(0);
    store.close();
  });
});
