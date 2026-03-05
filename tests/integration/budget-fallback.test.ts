/**
 * Integration test: Budget exhaustion auto-fallback (US-202)
 * When monthlyLimitUsd is 0, all tasks should route to local Ollama.
 *
 * @requires-ollama
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { eventBus } from '../../packages/core/src/index.js';
import type { CortexEvent } from '../../packages/core/src/types/events.js';

const OLLAMA_HOST = process.env['CORTEX_OLLAMA_HOST'] ?? 'http://localhost:11434';
const SKIP = !process.env['CORTEX_OLLAMA_HOST'];

describe.skipIf(SKIP)('budget exhaustion auto-fallback', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = resolve(tmpdir(), `cortex-budget-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('with $0 budget limit, all tasks route to local Ollama', async () => {
    const providersSeen = new Set<string>();
    let exhaustedFired = false;

    const unsubRequests = eventBus.on('llm.request.start', (e: CortexEvent) => {
      providersSeen.add((e.payload as { provider: string }).provider);
    });
    const unsubExhausted = eventBus.on('budget.exhausted', () => {
      exhaustedFired = true;
    });

    const { SQLiteStore } = await import('../../packages/graph/src/sqlite-store.js');
    const { Router } = await import('../../packages/llm/src/router.js');
    const { IngestionPipeline } = await import('../../packages/ingest/src/pipeline.js');

    const dbPath = resolve(tmpDir, 'test.db');
    const store = new SQLiteStore({ dbPath, walMode: false, backupOnStartup: false });

    const config = {
      llm: {
        mode: 'cloud-first' as const,
        taskRouting: {},
        temperature: { extraction: 0.1, chat: 0.7, ranking: 0.1, proactive: 0.5 },
        maxContextTokens: 50000,
        cache: { enabled: false, ttlDays: 1, maxSizeMb: 10 },
        // $0 limit means budget is immediately exhausted
        budget: { monthlyLimitUsd: 0, warningThresholds: [0.5, 0.8, 0.9], enforcementAction: 'fallback-local' as const },
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
      name: 'budget-test',
      rootPath: tmpDir,
      privacyLevel: 'standard',
      fileCount: 0,
      entityCount: 0,
    });

    const testFile = resolve(tmpDir, 'notes.md');
    writeFileSync(testFile, '# Architecture Decision\n\nWe chose React for the frontend. The decision was made after evaluating Vue and Angular.\n');

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

    unsubRequests();
    unsubExhausted();

    // With $0 budget, cloud-first mode falls back to local immediately
    expect(providersSeen.has('anthropic')).toBe(false);
    expect(providersSeen.has('ollama')).toBe(true);

    store.close();
  });
});
