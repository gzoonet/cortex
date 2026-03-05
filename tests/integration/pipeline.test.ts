import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { MarkdownParser, TypeScriptParser, chunkSections } from '@cortex/ingest';
import { SQLiteStore } from '@cortex/graph';

const fixturesDir = resolve(import.meta.dirname, '../fixtures');

describe('Ingestion Pipeline (offline)', () => {
  let store: SQLiteStore;
  let tempDir: string;
  let projectId: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cortex-pipeline-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    store = new SQLiteStore({
      dbPath: join(tempDir, 'test.db'),
      walMode: true,
      backupOnStartup: false,
    });

    const project = await store.createProject({
      name: 'test-project',
      rootPath: fixturesDir,
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

  describe('Parse → Chunk → Store Flow', () => {
    it('should parse markdown, chunk, and store entities manually', async () => {
      // Step 1: Parse
      const parser = new MarkdownParser();
      const content = readFileSync(resolve(fixturesDir, 'sample-architecture.md'), 'utf-8');
      const result = await parser.parse(content, 'sample-architecture.md');

      expect(result.sections.length).toBeGreaterThan(0);

      // Step 2: Chunk
      const chunks = chunkSections(result.sections);
      expect(chunks.length).toBeGreaterThan(0);

      // Step 3: Simulate entity storage (normally done by LLM extraction)
      const entity = await store.createEntity({
        type: 'Decision',
        name: 'Use Stripe for payments',
        content: chunks[0]!.content.slice(0, 200),
        summary: 'Stripe chosen as payment processor',
        properties: { processor: 'stripe' },
        confidence: 0.95,
        sourceFile: resolve(fixturesDir, 'sample-architecture.md'),
        sourceRange: { startLine: chunks[0]!.startLine, endLine: chunks[0]!.endLine },
        projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'claude-haiku-4-5' },
        tags: ['payments', 'architecture'],
        status: 'active',
      });

      expect(entity.id).toBeDefined();

      // Step 4: Verify it's searchable
      const searchResults = await store.searchEntities('Stripe');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0]!.name).toContain('Stripe');

      // Step 5: Store the file record
      const fileRecord = await store.upsertFile({
        path: resolve(fixturesDir, 'sample-architecture.md'),
        relativePath: 'sample-architecture.md',
        projectId,
        contentHash: 'test-hash-123',
        fileType: '.md',
        sizeBytes: content.length,
        lastModified: new Date().toISOString(),
        lastIngestedAt: new Date().toISOString(),
        entityIds: [entity.id],
        status: 'parsed',
      });

      expect(fileRecord.id).toBeDefined();

      // Step 6: Verify stats
      const stats = await store.getStats();
      expect(stats.entityCount).toBe(1);
      expect(stats.fileCount).toBe(1);
    });

    it('should parse TypeScript, chunk, and store entities', async () => {
      const parser = new TypeScriptParser();
      const content = readFileSync(resolve(fixturesDir, 'sample-component.ts'), 'utf-8');
      const result = await parser.parse(content, 'sample-component.ts');

      // Should extract interfaces, classes, etc.
      expect(result.sections.length).toBeGreaterThan(0);

      const interfaces = result.sections.filter((s) => s.type === 'interface');
      const classes = result.sections.filter((s) => s.type === 'class');

      expect(interfaces.length).toBeGreaterThan(0);
      expect(classes.length).toBeGreaterThan(0);

      // Chunk
      const chunks = chunkSections(result.sections);
      expect(chunks.length).toBeGreaterThan(0);

      // Store representative entities
      for (const iface of interfaces.slice(0, 3)) {
        await store.createEntity({
          type: 'Interface',
          name: iface.title ?? 'Unknown',
          content: iface.content,
          properties: {},
          confidence: 0.9,
          sourceFile: resolve(fixturesDir, 'sample-component.ts'),
          sourceRange: { startLine: iface.startLine, endLine: iface.endLine },
          projectId,
          extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'claude-haiku-4-5' },
          tags: ['typescript', 'interface'],
          status: 'active',
        });
      }

      const entities = await store.findEntities({ projectId });
      expect(entities.length).toBeGreaterThanOrEqual(interfaces.slice(0, 3).length);
    });

    it('should create relationships between entities', async () => {
      const entity1 = await store.createEntity({
        type: 'Decision',
        name: 'Use Stripe',
        content: 'Use Stripe for payments',
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
        name: 'PaymentGateway',
        content: 'Payment gateway integrates with Stripe',
        properties: {},
        confidence: 0.9,
        sourceFile: '/test.ts',
        projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'haiku' },
        tags: [],
        status: 'active',
      });

      const entity3 = await store.createEntity({
        type: 'Requirement',
        name: 'PCI Compliance',
        content: 'Must be PCI compliant',
        properties: {},
        confidence: 0.85,
        sourceFile: '/test.md',
        projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'haiku' },
        tags: [],
        status: 'active',
      });

      // Create relationships
      await store.createRelationship({
        type: 'implements',
        sourceEntityId: entity2.id,
        targetEntityId: entity1.id,
        description: 'PaymentGateway implements Stripe decision',
        confidence: 0.9,
        properties: {},
        extractedBy: { promptId: 'P2', promptVersion: '1.0', model: 'sonnet' },
      });

      await store.createRelationship({
        type: 'constrains',
        sourceEntityId: entity3.id,
        targetEntityId: entity1.id,
        description: 'PCI Compliance constrains payment decision',
        confidence: 0.85,
        properties: {},
        extractedBy: { promptId: 'P2', promptVersion: '1.0', model: 'sonnet' },
      });

      // Verify relationship graph
      const relsForDecision = await store.getRelationshipsForEntity(entity1.id, 'both');
      expect(relsForDecision).toHaveLength(2);

      const inbound = await store.getRelationshipsForEntity(entity1.id, 'in');
      expect(inbound.some((r) => r.type === 'implements')).toBe(true);
      expect(inbound.some((r) => r.type === 'constrains')).toBe(true);

      // Verify stats
      const stats = await store.getStats();
      expect(stats.entityCount).toBe(3);
      expect(stats.relationshipCount).toBe(2);
    });
  });

  describe('Multi-file ingestion', () => {
    it('should handle multiple files and cross-file search', async () => {
      // Parse and store entities from architecture doc
      const mdParser = new MarkdownParser();
      const archContent = readFileSync(resolve(fixturesDir, 'sample-architecture.md'), 'utf-8');
      const archResult = mdParser.parse(archContent, 'sample-architecture.md');

      await store.createEntity({
        type: 'Decision',
        name: 'Use Stripe for payments',
        content: 'Stripe chosen for marketplace payments via Connect platform',
        properties: {},
        confidence: 0.95,
        sourceFile: 'sample-architecture.md',
        projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'haiku' },
        tags: ['payments'],
        status: 'active',
      });

      // Parse and store entities from requirements doc
      const reqContent = readFileSync(resolve(fixturesDir, 'sample-requirements.md'), 'utf-8');
      const reqResult = mdParser.parse(reqContent, 'sample-requirements.md');

      await store.createEntity({
        type: 'Requirement',
        name: 'Multi-factor Authentication',
        content: 'MFA via TOTP required for all accounts',
        properties: {},
        confidence: 0.9,
        sourceFile: 'sample-requirements.md',
        projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'haiku' },
        tags: ['auth', 'security'],
        status: 'active',
      });

      await store.createEntity({
        type: 'Decision',
        name: 'Use JWT for authentication',
        content: 'JWT chosen for stateless auth across services',
        properties: {},
        confidence: 0.9,
        sourceFile: 'sample-requirements.md',
        projectId,
        extractedBy: { promptId: 'P1', promptVersion: '1.0', model: 'haiku' },
        tags: ['auth'],
        status: 'active',
      });

      // Cross-file search
      const paymentSearch = await store.searchEntities('Stripe payments');
      expect(paymentSearch.length).toBeGreaterThan(0);

      const authSearch = await store.searchEntities('authentication JWT');
      expect(authSearch.length).toBeGreaterThan(0);

      // Stats reflect multi-file data
      const stats = await store.getStats();
      expect(stats.entityCount).toBe(3);
    });
  });
});
