import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SQLiteStore } from '../../../packages/graph/src/sqlite-store.js';
import { QueryEngine } from '../../../packages/graph/src/query-engine.js';
import type { VectorStore } from '../../../packages/graph/src/vector-store.js';
import type { Router } from '../../../packages/llm/src/router.js';
import { handleCortexAsk } from '../../../packages/mcp/src/tools/ask.js';

describe('MCP cortex_ask privacy', () => {
  let tempDir: string;
  let store: SQLiteStore;

  beforeEach(() => {
    tempDir = join(tmpdir(), `cortex-ask-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    store = new SQLiteStore({ dbPath: join(tempDir, 'test.db'), walMode: false, backupOnStartup: false });
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('keeps restricted entities and projects out of the prompt and the result', async () => {
    const pub = await store.createProject({
      name: 'public-app', rootPath: '/public-app', privacyLevel: 'standard', fileCount: 0, entityCount: 0,
    });
    const sec = await store.createProject({
      name: 'secret-app', rootPath: '/secret/app', privacyLevel: 'restricted', fileCount: 0, entityCount: 0,
    });
    const base = {
      type: 'Decision' as const,
      properties: {},
      confidence: 0.9,
      extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'test' },
      tags: [],
      status: 'active' as const,
    };
    await store.createEntity({
      ...base, name: 'Billing provider choice', content: 'We use Stripe for billing.',
      sourceFile: '/public-app/billing.md', projectId: pub.id,
    });
    await store.createEntity({
      ...base, name: 'Billing provider secret', content: 'RESTRICTED-MARKER billing runs through account 42.',
      sourceFile: '/secret/app/billing.md', projectId: sec.id,
    });

    const prompts: string[] = [];
    const router = {
      hasEmbeddings: () => false,
      complete: async (req: { userPrompt: string }) => {
        prompts.push(req.userPrompt);
        return { content: 'answer', provider: 'fake', model: 'fake' };
      },
    } as unknown as Router;

    const result = await handleCortexAsk(
      { question: 'billing provider' },
      new QueryEngine(store, {} as VectorStore),
      router,
      store,
    );

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('Stripe');
    expect(prompts[0]).not.toContain('RESTRICTED-MARKER');
    expect(prompts[0]).not.toContain('secret-app');
    expect(result.entities.map((e) => e.name)).toEqual(['Billing provider choice']);
    expect(result.sourceFiles).not.toContain('/secret/app/billing.md');
  });
});
