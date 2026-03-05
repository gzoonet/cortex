import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SQLiteStore } from '@cortex/graph';
import type { Entity, Relationship, Project } from '@cortex/core';

describe('SQLiteStore', () => {
  let store: SQLiteStore;
  let tempDir: string;
  let projectId: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cortex-test-db-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    store = new SQLiteStore({
      dbPath: join(tempDir, 'test.db'),
      walMode: true,
      backupOnStartup: false,
    });

    // Create a test project
    const project = await store.createProject({
      name: 'test-project',
      rootPath: '/test',
      privacyLevel: 'standard',
      fileCount: 0,
      entityCount: 0,
    });
    projectId = project.id;
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Entity CRUD', () => {
    const makeEntity = (): Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> => ({
      type: 'Decision',
      name: 'Use Stripe for payments',
      content: 'We decided to use Stripe for payment processing.',
      summary: 'Stripe chosen for payments',
      properties: { priority: 'high' },
      confidence: 0.95,
      sourceFile: '/docs/architecture.md',
      sourceRange: { startLine: 10, endLine: 20 },
      projectId,
      extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'haiku' },
      tags: ['payments', 'architecture'],
      status: 'active',
    });

    it('should create and retrieve an entity', async () => {
      const entity = await store.createEntity(makeEntity());

      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('Use Stripe for payments');
      expect(entity.createdAt).toBeDefined();

      const retrieved = await store.getEntity(entity.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('Use Stripe for payments');
      expect(retrieved!.tags).toEqual(['payments', 'architecture']);
      expect(retrieved!.sourceRange).toEqual({ startLine: 10, endLine: 20 });
    });

    it('should update an entity', async () => {
      const entity = await store.createEntity(makeEntity());

      const updated = await store.updateEntity(entity.id, {
        name: 'Use Stripe Connect',
        confidence: 0.99,
      });

      expect(updated.name).toBe('Use Stripe Connect');
      expect(updated.confidence).toBe(0.99);

      const retrieved = await store.getEntity(entity.id);
      expect(retrieved!.name).toBe('Use Stripe Connect');
    });

    it('should soft-delete an entity', async () => {
      const entity = await store.createEntity(makeEntity());
      await store.deleteEntity(entity.id, true);

      const retrieved = await store.getEntity(entity.id);
      expect(retrieved).toBeNull(); // Excluded by deleted_at filter
    });

    it('should find entities by query', async () => {
      await store.createEntity(makeEntity());
      await store.createEntity({
        ...makeEntity(),
        name: 'Use JWT for auth',
        type: 'Pattern',
        tags: ['auth'],
      });

      const decisions = await store.findEntities({ type: 'Decision' });
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.name).toBe('Use Stripe for payments');

      const patterns = await store.findEntities({ type: 'Pattern' });
      expect(patterns).toHaveLength(1);

      const all = await store.findEntities({});
      expect(all).toHaveLength(2);
    });

    it('should find entities by project', async () => {
      await store.createEntity(makeEntity());

      const results = await store.findEntities({ projectId });
      expect(results).toHaveLength(1);

      const noResults = await store.findEntities({ projectId: 'nonexistent' });
      expect(noResults).toHaveLength(0);
    });

    it('should search entities via FTS', async () => {
      await store.createEntity(makeEntity());
      await store.createEntity({
        ...makeEntity(),
        name: 'Use JWT for auth',
        content: 'JWT chosen for stateless authentication.',
        tags: ['auth'],
      });

      const results = await store.searchEntities('Stripe');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.name).toContain('Stripe');

      const authResults = await store.searchEntities('JWT auth');
      expect(authResults.length).toBeGreaterThan(0);
    });
  });

  describe('Relationship CRUD', () => {
    it('should create and retrieve a relationship', async () => {
      const entity1 = await store.createEntity({
        type: 'Decision',
        name: 'Decision A',
        content: 'Content A',
        properties: {},
        confidence: 0.9,
        sourceFile: '/test.md',
        projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'haiku' },
        tags: [],
        status: 'active',
      });

      const entity2 = await store.createEntity({
        type: 'Component',
        name: 'Component B',
        content: 'Content B',
        properties: {},
        confidence: 0.9,
        sourceFile: '/test.md',
        projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'haiku' },
        tags: [],
        status: 'active',
      });

      const rel = await store.createRelationship({
        type: 'implements',
        sourceEntityId: entity2.id,
        targetEntityId: entity1.id,
        description: 'Component B implements Decision A',
        confidence: 0.85,
        properties: {},
        extractedBy: { promptId: 'P2', promptVersion: '1.0', model: 'sonnet' },
      });

      expect(rel.id).toBeDefined();
      expect(rel.type).toBe('implements');

      const retrieved = await store.getRelationship(rel.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.description).toBe('Component B implements Decision A');
    });

    it('should get relationships for an entity', async () => {
      const entity1 = await store.createEntity({
        type: 'Decision', name: 'D1', content: 'C1', properties: {},
        confidence: 0.9, sourceFile: '/t.md', projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'h' },
        tags: [], status: 'active',
      });
      const entity2 = await store.createEntity({
        type: 'Component', name: 'C2', content: 'C2', properties: {},
        confidence: 0.9, sourceFile: '/t.md', projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'h' },
        tags: [], status: 'active',
      });

      await store.createRelationship({
        type: 'implements',
        sourceEntityId: entity2.id,
        targetEntityId: entity1.id,
        confidence: 0.85,
        properties: {},
        extractedBy: { promptId: 'P2', promptVersion: '1.0', model: 's' },
      });

      const outbound = await store.getRelationshipsForEntity(entity2.id, 'out');
      expect(outbound).toHaveLength(1);

      const inbound = await store.getRelationshipsForEntity(entity1.id, 'in');
      expect(inbound).toHaveLength(1);

      const both = await store.getRelationshipsForEntity(entity1.id, 'both');
      expect(both).toHaveLength(1);
    });

    it('should delete a relationship', async () => {
      const entity1 = await store.createEntity({
        type: 'Decision', name: 'D1', content: 'C', properties: {},
        confidence: 0.9, sourceFile: '/t.md', projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'h' },
        tags: [], status: 'active',
      });
      const entity2 = await store.createEntity({
        type: 'Component', name: 'C2', content: 'C', properties: {},
        confidence: 0.9, sourceFile: '/t.md', projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'h' },
        tags: [], status: 'active',
      });

      const rel = await store.createRelationship({
        type: 'relates_to',
        sourceEntityId: entity1.id,
        targetEntityId: entity2.id,
        confidence: 0.7,
        properties: {},
        extractedBy: { promptId: 'P2', promptVersion: '1.0', model: 's' },
      });

      await store.deleteRelationship(rel.id);
      const retrieved = await store.getRelationship(rel.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('File Operations', () => {
    it('should upsert and retrieve files', async () => {
      const file = await store.upsertFile({
        path: '/project/src/index.ts',
        relativePath: 'src/index.ts',
        projectId,
        contentHash: 'abc123',
        fileType: '.ts',
        sizeBytes: 1024,
        lastModified: new Date().toISOString(),
        entityIds: [],
        status: 'parsed',
      });

      expect(file.id).toBeDefined();

      const retrieved = await store.getFile('/project/src/index.ts');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.contentHash).toBe('abc123');
    });

    it('should update file on re-upsert', async () => {
      await store.upsertFile({
        path: '/project/src/index.ts',
        relativePath: 'src/index.ts',
        projectId,
        contentHash: 'abc123',
        fileType: '.ts',
        sizeBytes: 1024,
        lastModified: new Date().toISOString(),
        entityIds: [],
        status: 'parsed',
      });

      await store.upsertFile({
        path: '/project/src/index.ts',
        relativePath: 'src/index.ts',
        projectId,
        contentHash: 'def456',
        fileType: '.ts',
        sizeBytes: 2048,
        lastModified: new Date().toISOString(),
        entityIds: ['entity-1'],
        status: 'parsed',
      });

      const retrieved = await store.getFile('/project/src/index.ts');
      expect(retrieved!.contentHash).toBe('def456');
      expect(retrieved!.sizeBytes).toBe(2048);
      expect(retrieved!.entityIds).toEqual(['entity-1']);
    });
  });

  describe('Projects', () => {
    it('should list projects', async () => {
      const projects = await store.listProjects();
      expect(projects.length).toBeGreaterThanOrEqual(1);
      expect(projects.some((p) => p.name === 'test-project')).toBe(true);
    });

    it('should get project by ID', async () => {
      const project = await store.getProject(projectId);
      expect(project).not.toBeNull();
      expect(project!.name).toBe('test-project');
    });
  });

  describe('Stats & Maintenance', () => {
    it('should return accurate stats', async () => {
      await store.createEntity({
        type: 'Decision', name: 'D1', content: 'C1', properties: {},
        confidence: 0.9, sourceFile: '/t.md', projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'h' },
        tags: [], status: 'active',
      });

      const stats = await store.getStats();
      expect(stats.entityCount).toBe(1);
      expect(stats.projectCount).toBeGreaterThanOrEqual(1);
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });

    it('should pass integrity check on clean DB', async () => {
      const result = await store.integrityCheck();
      expect(result.ok).toBe(true);
      expect(result.orphanedRelationships).toBe(0);
    });
  });
});
