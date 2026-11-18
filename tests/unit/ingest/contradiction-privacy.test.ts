import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Entity } from '../../../packages/core/src/index.js';
import { SQLiteStore } from '../../../packages/graph/src/sqlite-store.js';
import { runContradictionDetection } from '../../../packages/ingest/src/post-ingest.js';
import type { Router } from '../../../packages/llm/src/router.js';

interface RecordedCall {
  userPrompt: string;
  forceProvider?: string;
}

function fakeRouter(calls: RecordedCall[]): Router {
  return {
    completeStructured: async (req: { userPrompt: string; forceProvider?: string }) => {
      calls.push({ userPrompt: req.userPrompt, forceProvider: req.forceProvider });
      return { data: { isContradiction: false, description: '', severity: 'low', suggestedResolution: '' } };
    },
  } as unknown as Router;
}

describe('contradiction detection privacy', () => {
  let tempDir: string;
  let store: SQLiteStore;

  const project = async (name: string, privacyLevel: 'standard' | 'sensitive' | 'restricted') =>
    store.createProject({ name, rootPath: `/${name}`, privacyLevel, fileCount: 0, entityCount: 0 });

  const entity = (projectId: string, sourceFile: string, content: string): Promise<Entity> =>
    store.createEntity({
      type: 'Decision',
      name: 'Auth Service token storage',
      content,
      properties: {},
      confidence: 0.9,
      sourceFile,
      projectId,
      extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'test' },
      tags: [],
      status: 'active',
    });

  beforeEach(() => {
    tempDir = join(tmpdir(), `cortex-contra-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    store = new SQLiteStore({ dbPath: join(tempDir, 'test.db'), walMode: false, backupOnStartup: false });
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('never puts a restricted-project candidate into any prompt', async () => {
    const std = await project('public-app', 'standard');
    const res = await project('secret-app', 'restricted');
    await entity(res.id, '/secret-app/auth.md', 'RESTRICTED-MARKER tokens live in vault path X');
    const fresh = await entity(std.id, '/public-app/auth.md', 'Tokens are stored in cookies');

    const calls: RecordedCall[] = [];
    await runContradictionDetection([fresh], fresh.sourceFile, std.id, 'standard', store, fakeRouter(calls));

    expect(calls.every((c) => !c.userPrompt.includes('RESTRICTED-MARKER'))).toBe(true);
  });

  it('forces the local provider when the candidate is from a sensitive project', async () => {
    const std = await project('public-app', 'standard');
    const sen = await project('internal-app', 'sensitive');
    await entity(sen.id, '/internal-app/auth.md', 'Tokens live in Redis');
    const fresh = await entity(std.id, '/public-app/auth.md', 'Tokens are stored in cookies');

    const calls: RecordedCall[] = [];
    await runContradictionDetection([fresh], fresh.sourceFile, std.id, 'standard', store, fakeRouter(calls));

    expect(calls.length).toBe(1);
    expect(calls[0]!.forceProvider).toBe('local');
  });

  it('leaves standard-to-standard pairs to normal routing', async () => {
    const a = await project('app-a', 'standard');
    const b = await project('app-b', 'standard');
    await entity(b.id, '/app-b/auth.md', 'Tokens live in Redis');
    const fresh = await entity(a.id, '/app-a/auth.md', 'Tokens are stored in cookies');

    const calls: RecordedCall[] = [];
    await runContradictionDetection([fresh], fresh.sourceFile, a.id, 'standard', store, fakeRouter(calls));

    expect(calls.length).toBe(1);
    expect(calls[0]!.forceProvider).toBeUndefined();
  });
});
