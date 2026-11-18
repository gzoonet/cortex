import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import {
  normalizePrivacyLevel,
  stricterPrivacyLevel,
  type Entity,
} from '../../../packages/core/src/index.js';
import { SQLiteStore } from '../../../packages/graph/src/sqlite-store.js';
import { QueryEngine } from '../../../packages/graph/src/query-engine.js';
import type { VectorStore } from '../../../packages/graph/src/vector-store.js';

describe('privacy level helpers', () => {
  it('passes known levels through', () => {
    expect(normalizePrivacyLevel('standard')).toBe('standard');
    expect(normalizePrivacyLevel('sensitive')).toBe('sensitive');
    expect(normalizePrivacyLevel('restricted')).toBe('restricted');
  });

  it('fails closed on unknown values', () => {
    expect(normalizePrivacyLevel('Restricted')).toBe('restricted');
    expect(normalizePrivacyLevel('public')).toBe('restricted');
    expect(normalizePrivacyLevel(undefined)).toBe('restricted');
  });

  it('picks the stricter level', () => {
    expect(stricterPrivacyLevel('standard', 'sensitive')).toBe('sensitive');
    expect(stricterPrivacyLevel('restricted', 'standard')).toBe('restricted');
    expect(stricterPrivacyLevel('standard', 'standard')).toBe('standard');
  });
});

describe('QueryEngine.filterByPrivacy', () => {
  let tempDir: string;
  let dbPath: string;
  let store: SQLiteStore;
  let engine: QueryEngine;

  const entityFor = async (projectId: string, name: string): Promise<Entity> =>
    store.createEntity({
      type: 'Decision',
      name,
      content: `Full content of ${name}`,
      summary: `Summary of ${name}`,
      properties: { owner: 'team' },
      confidence: 0.9,
      sourceFile: `/src/${name}.md`,
      projectId,
      extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'test' },
      tags: [],
      status: 'active',
    });

  const project = async (name: string, privacyLevel: 'standard' | 'sensitive' | 'restricted') =>
    store.createProject({ name, rootPath: `/${name}`, privacyLevel, fileCount: 0, entityCount: 0 });

  beforeEach(() => {
    tempDir = join(tmpdir(), `cortex-privacy-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    dbPath = join(tempDir, 'test.db');
    store = new SQLiteStore({ dbPath, walMode: false, backupOnStartup: false });
    engine = new QueryEngine(store, {} as VectorStore);
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('drops restricted entities and redacts content, summary and properties of sensitive ones', async () => {
    const std = await entityFor((await project('std', 'standard')).id, 'alpha');
    const sen = await entityFor((await project('sen', 'sensitive')).id, 'beta');
    const res = await entityFor((await project('res', 'restricted')).id, 'gamma');

    const out = await engine.filterByPrivacy([std, sen, res]);

    expect(out.map((e) => e.name)).toEqual(['alpha', 'beta']);
    expect(out[0]!.content).toBe('Full content of alpha');
    expect(out[1]!.content).toBe('[REDACTED]');
    expect(out[1]!.summary).toBeUndefined();
    expect(out[1]!.properties).toEqual({});
  });

  it('treats a malformed stored privacy level as restricted', async () => {
    const p = await project('odd', 'standard');
    const e = await entityFor(p.id, 'delta');
    // Simulate a row written by an older version without validation.
    const raw = new Database(dbPath);
    raw.prepare('UPDATE projects SET privacy_level = ? WHERE id = ?').run('Restricted', p.id);
    raw.close();

    expect((await store.getProject(p.id))!.privacyLevel).toBe('restricted');
    expect(await engine.filterByPrivacy([e])).toEqual([]);
  });

  it('rejects an invalid privacy level on project creation', async () => {
    await expect(
      store.createProject({
        name: 'bad',
        rootPath: '/bad',
        privacyLevel: 'Restricted' as 'restricted',
        fileCount: 0,
        entityCount: 0,
      }),
    ).rejects.toThrow(/Invalid privacy level/);
  });
});
