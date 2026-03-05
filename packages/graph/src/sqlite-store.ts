import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { copyFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type {
  Entity,
  Relationship,
  Contradiction,
  FileRecord,
  Project,
  EntityQuery,
  GraphStats,
  IntegrityResult,
  GraphStore,
} from '@cortex/core';
import {
  CortexError,
  GRAPH_DB_ERROR,
  GRAPH_ENTITY_NOT_FOUND,
} from '@cortex/core';
import { up as applyInitialMigration } from './migrations/001-initial.js';

// --- Report types ---

export interface FileStatusBreakdown {
  ingested: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface FailedFile {
  path: string;
  relativePath: string;
  parseError: string;
}

export interface EntityBreakdown {
  type: string;
  count: number;
  avgConfidence: number;
}

export interface RelationshipBreakdown {
  type: string;
  count: number;
}

export interface ContradictionBreakdown {
  active: number;
  resolved: number;
  dismissed: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
}

export interface TopContradiction {
  id: string;
  severity: string;
  description: string;
  entityA: string;
  entityB: string;
}

export interface ReportData {
  generatedAt: string;
  fileStatus: FileStatusBreakdown;
  failedFiles: FailedFile[];
  entityBreakdown: EntityBreakdown[];
  supersededCount: number;
  relationshipBreakdown: RelationshipBreakdown[];
  contradictions: ContradictionBreakdown;
  topContradictions: TopContradiction[];
  tokenEstimate: {
    totalInput: number;
    totalOutput: number;
  };
}

function resolveHomePath(p: string): string {
  return p.startsWith('~') ? p.replace('~', homedir()) : p;
}

function now(): string {
  return new Date().toISOString();
}

interface EntityRow {
  id: string;
  type: string;
  name: string;
  content: string;
  summary: string | null;
  properties: string | null;
  confidence: number;
  source_file: string;
  source_start_line: number | null;
  source_end_line: number | null;
  project_id: string;
  extracted_by: string;
  tags: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface RelationshipRow {
  id: string;
  type: string;
  source_entity_id: string;
  target_entity_id: string;
  description: string | null;
  confidence: number;
  properties: string | null;
  extracted_by: string;
  created_at: string;
  updated_at: string;
}

interface FileRow {
  id: string;
  path: string;
  relative_path: string;
  project_id: string;
  content_hash: string;
  file_type: string;
  size_bytes: number;
  last_modified: string;
  last_ingested_at: string | null;
  entity_ids: string | null;
  status: string;
  parse_error: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  root_path: string;
  privacy_level: string;
  file_count: number;
  entity_count: number;
  last_ingested_at: string | null;
  created_at: string;
}

interface ContradictionRow {
  id: string;
  entity_id_a: string;
  entity_id_b: string;
  description: string;
  severity: string;
  suggested_resolution: string | null;
  status: string;
  resolved_action: string | null;
  resolved_at: string | null;
  detected_at: string;
}

function rowToContradiction(row: ContradictionRow): Contradiction {
  return {
    id: row.id,
    entityIds: [row.entity_id_a, row.entity_id_b],
    description: row.description,
    severity: row.severity as Contradiction['severity'],
    suggestedResolution: row.suggested_resolution ?? undefined,
    status: row.status as Contradiction['status'],
    resolvedAction: row.resolved_action as Contradiction['resolvedAction'] ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    detectedAt: row.detected_at,
  };
}

function rowToEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    type: row.type as Entity['type'],
    name: row.name,
    content: row.content,
    summary: row.summary ?? undefined,
    properties: row.properties ? JSON.parse(row.properties) as Record<string, unknown> : {},
    confidence: row.confidence,
    sourceFile: row.source_file,
    sourceRange: row.source_start_line != null && row.source_end_line != null
      ? { startLine: row.source_start_line, endLine: row.source_end_line }
      : undefined,
    projectId: row.project_id,
    extractedBy: JSON.parse(row.extracted_by) as Entity['extractedBy'],
    tags: row.tags ? JSON.parse(row.tags) as string[] : [],
    status: row.status as Entity['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRelationship(row: RelationshipRow): Relationship {
  return {
    id: row.id,
    type: row.type as Relationship['type'],
    sourceEntityId: row.source_entity_id,
    targetEntityId: row.target_entity_id,
    description: row.description ?? undefined,
    confidence: row.confidence,
    properties: row.properties ? JSON.parse(row.properties) as Record<string, unknown> : {},
    extractedBy: JSON.parse(row.extracted_by) as Relationship['extractedBy'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFile(row: FileRow): FileRecord {
  return {
    id: row.id,
    path: row.path,
    relativePath: row.relative_path,
    projectId: row.project_id,
    contentHash: row.content_hash,
    fileType: row.file_type,
    sizeBytes: row.size_bytes,
    lastModified: row.last_modified,
    lastIngestedAt: row.last_ingested_at ?? undefined,
    entityIds: row.entity_ids ? JSON.parse(row.entity_ids) as string[] : [],
    status: row.status as FileRecord['status'],
    parseError: row.parse_error ?? undefined,
  };
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    rootPath: row.root_path,
    privacyLevel: row.privacy_level as Project['privacyLevel'],
    fileCount: row.file_count,
    entityCount: row.entity_count,
    lastIngestedAt: row.last_ingested_at ?? undefined,
    createdAt: row.created_at,
  };
}

export interface SQLiteStoreOptions {
  dbPath?: string;
  walMode?: boolean;
  backupOnStartup?: boolean;
}

export class SQLiteStore implements GraphStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(options: SQLiteStoreOptions = {}) {
    const {
      dbPath = '~/.cortex/cortex.db',
      walMode = true,
      backupOnStartup = true,
    } = options;

    this.dbPath = resolveHomePath(dbPath);
    mkdirSync(dirname(this.dbPath), { recursive: true });

    if (backupOnStartup) {
      this.backupSync();
    }

    this.db = new Database(this.dbPath);

    if (walMode) {
      this.db.pragma('journal_mode = WAL');
    }
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.migrate();
  }

  private migrate(): void {
    try {
      applyInitialMigration(this.db);
    } catch (err) {
      throw new CortexError(
        GRAPH_DB_ERROR,
        'critical',
        'graph',
        `Migration failed: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        'Delete the database and restart.',
      );
    }
  }

  private backupSync(): void {
    try {
      const stat = statSync(this.dbPath);
      if (stat.isFile()) {
        const backupPath = `${this.dbPath}.backup`;
        copyFileSync(this.dbPath, backupPath);
      }
    } catch {
      // DB doesn't exist yet — no backup needed
    }
  }

  close(): void {
    this.db.close();
  }

  // --- Entities ---

  async createEntity(
    entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Entity> {
    const id = randomUUID();
    const ts = now();

    this.db.prepare(`
      INSERT INTO entities (
        id, type, name, content, summary, properties, confidence,
        source_file, source_start_line, source_end_line,
        project_id, extracted_by, tags, status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `).run(
      id, entity.type, entity.name, entity.content,
      entity.summary ?? null,
      JSON.stringify(entity.properties),
      entity.confidence,
      entity.sourceFile,
      entity.sourceRange?.startLine ?? null,
      entity.sourceRange?.endLine ?? null,
      entity.projectId,
      JSON.stringify(entity.extractedBy),
      JSON.stringify(entity.tags),
      entity.status,
      ts, ts,
    );

    // Sync to FTS
    this.db.prepare(`
      INSERT INTO entities_fts (rowid, name, content, summary, tags)
      VALUES (
        (SELECT rowid FROM entities WHERE id = ?),
        ?, ?, ?, ?
      )
    `).run(
      id,
      entity.name,
      entity.content,
      entity.summary ?? '',
      entity.tags.join(' '),
    );

    return { ...entity, id, createdAt: ts, updatedAt: ts };
  }

  async getEntity(id: string): Promise<Entity | null> {
    const row = this.db.prepare(
      'SELECT * FROM entities WHERE id = ? AND deleted_at IS NULL',
    ).get(id) as EntityRow | undefined;

    return row ? rowToEntity(row) : null;
  }

  async updateEntity(id: string, updates: Partial<Entity>): Promise<Entity> {
    const existing = await this.getEntity(id);
    if (!existing) {
      throw new CortexError(
        GRAPH_ENTITY_NOT_FOUND,
        'low',
        'graph',
        `Entity not found: ${id}`,
        { entityId: id },
      );
    }

    const merged = { ...existing, ...updates, updatedAt: now() };

    this.db.prepare(`
      UPDATE entities SET
        type = ?, name = ?, content = ?, summary = ?,
        properties = ?, confidence = ?,
        source_file = ?, source_start_line = ?, source_end_line = ?,
        extracted_by = ?, tags = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.type, merged.name, merged.content, merged.summary ?? null,
      JSON.stringify(merged.properties), merged.confidence,
      merged.sourceFile,
      merged.sourceRange?.startLine ?? null,
      merged.sourceRange?.endLine ?? null,
      JSON.stringify(merged.extractedBy),
      JSON.stringify(merged.tags),
      merged.status,
      merged.updatedAt,
      id,
    );

    // Re-sync FTS
    this.db.prepare(`
      UPDATE entities_fts SET name = ?, content = ?, summary = ?, tags = ?
      WHERE rowid = (SELECT rowid FROM entities WHERE id = ?)
    `).run(merged.name, merged.content, merged.summary ?? '', merged.tags.join(' '), id);

    return merged;
  }

  async deleteEntity(id: string, soft = true): Promise<void> {
    if (soft) {
      this.db.prepare(
        'UPDATE entities SET deleted_at = ?, status = ? WHERE id = ?',
      ).run(now(), 'deleted', id);
    } else {
      // Remove FTS entry before deleting the entity
      this.db.prepare(
        'DELETE FROM entities_fts WHERE rowid = (SELECT rowid FROM entities WHERE id = ?)',
      ).run(id);
      this.db.prepare('DELETE FROM entities WHERE id = ?').run(id);
    }
  }

  async findEntities(query: EntityQuery): Promise<Entity[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (query.type) {
      conditions.push('type = ?');
      params.push(query.type);
    }
    if (query.projectId) {
      conditions.push('project_id = ?');
      params.push(query.projectId);
    }
    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query.since) {
      conditions.push('created_at >= ?');
      params.push(query.since);
    }
    if (query.before) {
      conditions.push('created_at < ?');
      params.push(query.before);
    }

    let sql: string;

    if (query.search) {
      // Use FTS for text search
      sql = `
        SELECT e.* FROM entities e
        JOIN entities_fts fts ON fts.rowid = e.rowid
        WHERE fts.entities_fts MATCH ? AND ${conditions.join(' AND ')}
        ORDER BY rank
      `;
      params.unshift(query.search);
    } else {
      sql = `
        SELECT * FROM entities
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
      `;
    }

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }
    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    const rows = this.db.prepare(sql).all(...params) as EntityRow[];
    return rows.map(rowToEntity);
  }

  // --- Relationships ---

  async createRelationship(
    rel: Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Relationship> {
    const id = randomUUID();
    const ts = now();

    this.db.prepare(`
      INSERT INTO relationships (
        id, type, source_entity_id, target_entity_id,
        description, confidence, properties, extracted_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, rel.type, rel.sourceEntityId, rel.targetEntityId,
      rel.description ?? null, rel.confidence,
      JSON.stringify(rel.properties),
      JSON.stringify(rel.extractedBy),
      ts, ts,
    );

    return { ...rel, id, createdAt: ts, updatedAt: ts };
  }

  async getRelationship(id: string): Promise<Relationship | null> {
    const row = this.db.prepare(
      'SELECT * FROM relationships WHERE id = ?',
    ).get(id) as RelationshipRow | undefined;

    return row ? rowToRelationship(row) : null;
  }

  async getRelationshipsForEntity(
    entityId: string,
    direction: 'in' | 'out' | 'both' = 'both',
  ): Promise<Relationship[]> {
    let sql: string;
    let params: string[];

    if (direction === 'out') {
      sql = 'SELECT * FROM relationships WHERE source_entity_id = ?';
      params = [entityId];
    } else if (direction === 'in') {
      sql = 'SELECT * FROM relationships WHERE target_entity_id = ?';
      params = [entityId];
    } else {
      sql = 'SELECT * FROM relationships WHERE source_entity_id = ? OR target_entity_id = ?';
      params = [entityId, entityId];
    }

    const rows = this.db.prepare(sql).all(...params) as RelationshipRow[];
    return rows.map(rowToRelationship);
  }

  async deleteRelationship(id: string): Promise<void> {
    this.db.prepare('DELETE FROM relationships WHERE id = ?').run(id);
  }

  deleteBySourcePath(pathPrefix: string): {
    deletedEntities: number;
    deletedRelationships: number;
    deletedFiles: number;
  } {
    // Normalize to backslashes (Windows DB storage) and add wildcard
    const normalized = pathPrefix.replace(/\//g, '\\');
    const pattern = normalized.endsWith('%') ? normalized : normalized + '%';
    return this.db.transaction(() => {
      const relResult = this.db.prepare(`
        DELETE FROM relationships
        WHERE source_entity_id IN (SELECT id FROM entities WHERE source_file LIKE ?)
           OR target_entity_id IN (SELECT id FROM entities WHERE source_file LIKE ?)
      `).run(pattern, pattern);

      this.db.prepare(`
        DELETE FROM entities_fts
        WHERE rowid IN (SELECT rowid FROM entities WHERE source_file LIKE ? AND deleted_at IS NULL)
      `).run(pattern);

      const entityResult = this.db.prepare(
        'DELETE FROM entities WHERE source_file LIKE ?',
      ).run(pattern);

      const fileResult = this.db.prepare(
        'DELETE FROM files WHERE path LIKE ?',
      ).run(pattern);

      return {
        deletedEntities: entityResult.changes,
        deletedRelationships: relResult.changes,
        deletedFiles: fileResult.changes,
      };
    })();
  }

  resetDatabase(): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM contradictions').run();
      this.db.prepare('DELETE FROM relationships').run();
      this.db.prepare('DELETE FROM entities_fts').run();
      this.db.prepare('DELETE FROM entities').run();
      this.db.prepare('DELETE FROM files').run();
    })();
  }

  pruneSoftDeleted(): { deletedEntities: number; deletedRelationships: number } {
    return this.db.transaction(() => {
      const relResult = this.db.prepare(`
        DELETE FROM relationships
        WHERE source_entity_id IN (SELECT id FROM entities WHERE deleted_at IS NOT NULL)
           OR target_entity_id IN (SELECT id FROM entities WHERE deleted_at IS NOT NULL)
      `).run();

      this.db.prepare(`
        DELETE FROM entities_fts
        WHERE rowid IN (SELECT rowid FROM entities WHERE deleted_at IS NOT NULL)
      `).run();

      const entityResult = this.db.prepare(
        'DELETE FROM entities WHERE deleted_at IS NOT NULL',
      ).run();

      return {
        deletedEntities: entityResult.changes,
        deletedRelationships: relResult.changes,
      };
    })();
  }

  // --- Files ---

  async upsertFile(file: Omit<FileRecord, 'id'>): Promise<FileRecord> {
    const existing = this.db.prepare(
      'SELECT * FROM files WHERE path = ?',
    ).get(file.path) as FileRow | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE files SET
          relative_path = ?, project_id = ?, content_hash = ?,
          file_type = ?, size_bytes = ?, last_modified = ?,
          last_ingested_at = ?, entity_ids = ?, status = ?, parse_error = ?
        WHERE path = ?
      `).run(
        file.relativePath, file.projectId, file.contentHash,
        file.fileType, file.sizeBytes, file.lastModified,
        file.lastIngestedAt ?? null,
        JSON.stringify(file.entityIds),
        file.status,
        file.parseError ?? null,
        file.path,
      );
      return { ...file, id: existing.id };
    }

    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO files (
        id, path, relative_path, project_id, content_hash,
        file_type, size_bytes, last_modified, last_ingested_at,
        entity_ids, status, parse_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, file.path, file.relativePath, file.projectId, file.contentHash,
      file.fileType, file.sizeBytes, file.lastModified,
      file.lastIngestedAt ?? null,
      JSON.stringify(file.entityIds),
      file.status,
      file.parseError ?? null,
    );

    return { ...file, id };
  }

  async getFile(path: string): Promise<FileRecord | null> {
    const row = this.db.prepare(
      'SELECT * FROM files WHERE path = ?',
    ).get(path) as FileRow | undefined;

    return row ? rowToFile(row) : null;
  }

  async getFilesByProject(projectId: string): Promise<FileRecord[]> {
    const rows = this.db.prepare(
      'SELECT * FROM files WHERE project_id = ?',
    ).all(projectId) as FileRow[];
    return rows.map(rowToFile);
  }

  // --- Projects ---

  async createProject(
    project: Omit<Project, 'id' | 'createdAt'>,
  ): Promise<Project> {
    const id = randomUUID();
    const ts = now();

    this.db.prepare(`
      INSERT INTO projects (
        id, name, root_path, privacy_level,
        file_count, entity_count, last_ingested_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project.name, project.rootPath, project.privacyLevel,
      project.fileCount, project.entityCount,
      project.lastIngestedAt ?? null, ts,
    );

    return { ...project, id, createdAt: ts };
  }

  async getProject(id: string): Promise<Project | null> {
    const row = this.db.prepare(
      'SELECT * FROM projects WHERE id = ?',
    ).get(id) as ProjectRow | undefined;

    return row ? rowToProject(row) : null;
  }

  async listProjects(): Promise<Project[]> {
    const rows = this.db.prepare(
      'SELECT * FROM projects ORDER BY created_at DESC',
    ).all() as ProjectRow[];
    return rows.map(rowToProject);
  }

  // --- Contradictions ---

  async createContradiction(
    contradiction: Omit<Contradiction, 'id'>,
  ): Promise<Contradiction> {
    const id = randomUUID();

    this.db.prepare(`
      INSERT INTO contradictions (
        id, entity_id_a, entity_id_b, description, severity,
        suggested_resolution, status, resolved_action, resolved_at, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      contradiction.entityIds[0],
      contradiction.entityIds[1],
      contradiction.description,
      contradiction.severity,
      contradiction.suggestedResolution ?? null,
      contradiction.status,
      contradiction.resolvedAction ?? null,
      contradiction.resolvedAt ?? null,
      contradiction.detectedAt,
    );

    return { ...contradiction, id };
  }

  async findContradictions(
    query: { status?: Contradiction['status']; entityId?: string; limit?: number } = {},
  ): Promise<Contradiction[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query.entityId) {
      conditions.push('(entity_id_a = ? OR entity_id_b = ?)');
      params.push(query.entityId, query.entityId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    let sql = `SELECT * FROM contradictions ${where} ORDER BY detected_at DESC`;

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as ContradictionRow[];
    return rows.map(rowToContradiction);
  }

  async updateContradiction(id: string, update: {
    status: Contradiction['status'];
    resolvedAction?: Contradiction['resolvedAction'];
    resolvedAt?: string;
  }): Promise<void> {
    this.db.prepare(`
      UPDATE contradictions SET status = ?, resolved_action = ?, resolved_at = ? WHERE id = ?
    `).run(update.status, update.resolvedAction ?? null, update.resolvedAt ?? null, id);
  }

  // --- Search ---

  async searchEntities(text: string, limit = 20): Promise<Entity[]> {
    const rows = this.db.prepare(`
      SELECT e.* FROM entities e
      JOIN entities_fts fts ON fts.rowid = e.rowid
      WHERE fts.entities_fts MATCH ? AND e.deleted_at IS NULL
      ORDER BY rank
      LIMIT ?
    `).all(text, limit) as EntityRow[];

    return rows.map(rowToEntity);
  }

  async semanticSearch(
    _embedding: Float32Array,
    _limit = 20,
  ): Promise<Entity[]> {
    // Vector search is delegated to VectorStore.
    // This method exists to satisfy the GraphStore interface.
    // The QueryEngine will combine results from both stores.
    return [];
  }

  // --- Stats ---

  async getStats(): Promise<GraphStats> {
    const entityCount = (this.db.prepare(
      "SELECT COUNT(*) as count FROM entities WHERE deleted_at IS NULL AND status != 'deleted'",
    ).get() as { count: number }).count;

    const relationshipCount = (this.db.prepare(
      'SELECT COUNT(*) as count FROM relationships',
    ).get() as { count: number }).count;

    const fileCount = (this.db.prepare(
      'SELECT COUNT(*) as count FROM files',
    ).get() as { count: number }).count;

    const projectCount = (this.db.prepare(
      'SELECT COUNT(*) as count FROM projects',
    ).get() as { count: number }).count;

    const contradictionCount = (this.db.prepare(
      "SELECT COUNT(*) as count FROM contradictions WHERE status = 'active'",
    ).get() as { count: number }).count;

    let dbSizeBytes = 0;
    try {
      dbSizeBytes = statSync(this.dbPath).size;
    } catch {
      // DB file may not exist yet
    }

    return {
      entityCount,
      relationshipCount,
      fileCount,
      projectCount,
      contradictionCount,
      dbSizeBytes,
      vectorDbSizeBytes: 0, // Managed by VectorStore
    };
  }

  // --- Report ---

  getReportData(): ReportData {
    // File status breakdown
    const fileRows = this.db.prepare(
      'SELECT status, COUNT(*) as count FROM files GROUP BY status',
    ).all() as Array<{ status: string; count: number }>;

    const fileStatus: FileStatusBreakdown = { ingested: 0, failed: 0, skipped: 0, pending: 0 };
    for (const row of fileRows) {
      if (row.status in fileStatus) {
        fileStatus[row.status as keyof FileStatusBreakdown] = row.count;
      }
    }

    // Failed files with error messages
    const failedFiles = (this.db.prepare(
      `SELECT path, relative_path, parse_error FROM files
       WHERE status = 'failed' AND parse_error IS NOT NULL
       ORDER BY path LIMIT 50`,
    ).all() as Array<{ path: string; relative_path: string; parse_error: string }>)
      .map((r) => ({ path: r.path, relativePath: r.relative_path, parseError: r.parse_error }));

    // Entity breakdown by type (active only)
    const entityRows = this.db.prepare(
      `SELECT type, COUNT(*) as count, AVG(confidence) as avg_confidence
       FROM entities WHERE deleted_at IS NULL AND status = 'active'
       GROUP BY type ORDER BY count DESC`,
    ).all() as Array<{ type: string; count: number; avg_confidence: number }>;
    const entityBreakdown = entityRows.map((r) => ({
      type: r.type, count: r.count, avgConfidence: r.avg_confidence,
    }));

    // Superseded entity count (proxy for merges)
    const supersededCount = (this.db.prepare(
      "SELECT COUNT(*) as count FROM entities WHERE status = 'superseded'",
    ).get() as { count: number }).count;

    // Relationship breakdown by type
    const relRows = this.db.prepare(
      'SELECT type, COUNT(*) as count FROM relationships GROUP BY type ORDER BY count DESC',
    ).all() as Array<{ type: string; count: number }>;
    const relationshipBreakdown = relRows.map((r) => ({ type: r.type, count: r.count }));

    // Contradictions breakdown by status and severity
    const contrRows = this.db.prepare(
      'SELECT status, severity, COUNT(*) as count FROM contradictions GROUP BY status, severity',
    ).all() as Array<{ status: string; severity: string; count: number }>;
    const contradictions: ContradictionBreakdown = {
      active: 0, resolved: 0, dismissed: 0,
      highSeverity: 0, mediumSeverity: 0, lowSeverity: 0,
    };
    for (const r of contrRows) {
      if (r.status === 'active') contradictions.active += r.count;
      if (r.status === 'resolved') contradictions.resolved += r.count;
      if (r.status === 'dismissed') contradictions.dismissed += r.count;
      if (r.severity === 'high' || r.severity === 'critical') contradictions.highSeverity += r.count;
      if (r.severity === 'medium') contradictions.mediumSeverity += r.count;
      if (r.severity === 'low') contradictions.lowSeverity += r.count;
    }

    // Top active contradictions (high first, then medium, limit 10)
    const topContrRows = this.db.prepare(
      `SELECT c.id, c.severity, c.description, ea.name as entity_a, eb.name as entity_b
       FROM contradictions c
       LEFT JOIN entities ea ON c.entity_id_a = ea.id
       LEFT JOIN entities eb ON c.entity_id_b = eb.id
       WHERE c.status = 'active'
       ORDER BY CASE c.severity
         WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3
       END, c.detected_at DESC
       LIMIT 10`,
    ).all() as Array<{ id: string; severity: string; description: string; entity_a: string; entity_b: string }>;
    const topContradictions = topContrRows.map((r) => ({
      id: r.id.slice(0, 8),
      severity: r.severity,
      description: r.description,
      entityA: r.entity_a ?? 'unknown',
      entityB: r.entity_b ?? 'unknown',
    }));

    // Token estimate from entity extracted_by JSON
    const tokenRow = this.db.prepare(
      `SELECT
        SUM(CAST(JSON_EXTRACT(extracted_by, '$.tokensUsed.input') AS INTEGER)) as total_input,
        SUM(CAST(JSON_EXTRACT(extracted_by, '$.tokensUsed.output') AS INTEGER)) as total_output
       FROM entities WHERE deleted_at IS NULL`,
    ).get() as { total_input: number | null; total_output: number | null };

    return {
      generatedAt: new Date().toISOString(),
      fileStatus,
      failedFiles,
      entityBreakdown,
      supersededCount,
      relationshipBreakdown,
      contradictions,
      topContradictions,
      tokenEstimate: {
        totalInput: tokenRow.total_input ?? 0,
        totalOutput: tokenRow.total_output ?? 0,
      },
    };
  }

  // --- Maintenance ---

  async backup(): Promise<string> {
    const backupPath = `${this.dbPath}.backup-${Date.now()}`;
    await this.db.backup(backupPath);
    return backupPath;
  }

  async integrityCheck(): Promise<IntegrityResult> {
    const details: string[] = [];

    // Check for orphaned relationships
    const orphanedRels = (this.db.prepare(`
      SELECT COUNT(*) as count FROM relationships r
      WHERE NOT EXISTS (SELECT 1 FROM entities WHERE id = r.source_entity_id)
         OR NOT EXISTS (SELECT 1 FROM entities WHERE id = r.target_entity_id)
    `).get() as { count: number }).count;

    if (orphanedRels > 0) {
      details.push(`Found ${orphanedRels} orphaned relationships`);
    }

    // Check for files referencing missing projects
    const missingProjects = (this.db.prepare(`
      SELECT COUNT(*) as count FROM files f
      WHERE NOT EXISTS (SELECT 1 FROM projects WHERE id = f.project_id)
    `).get() as { count: number }).count;

    if (missingProjects > 0) {
      details.push(`Found ${missingProjects} files referencing missing projects`);
    }

    // SQLite integrity check
    const integrityResult = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    const sqliteOk = integrityResult.length === 1 && integrityResult[0]!.integrity_check === 'ok';

    if (!sqliteOk) {
      details.push('SQLite integrity check failed');
    }

    return {
      ok: orphanedRels === 0 && missingProjects === 0 && sqliteOk,
      orphanedRelationships: orphanedRels,
      missingFiles: missingProjects,
      details,
    };
  }

  // --- Graph visualization data ---

  getGraphData(options: { projectId?: string; limit?: number } = {}): {
    nodes: Array<{ id: string; name: string; type: string; confidence: number; sourceFile: string }>;
    edges: Array<{ id: string; source: string; target: string; type: string; confidence: number }>;
  } {
    const limit = options.limit ?? 2000;

    let entitySql = `SELECT id, name, type, confidence, source_file FROM entities WHERE status = 'active'`;
    const params: unknown[] = [];
    if (options.projectId) {
      entitySql += ` AND project_id = ?`;
      params.push(options.projectId);
    }
    entitySql += ` ORDER BY confidence DESC LIMIT ?`;
    params.push(limit);

    const entityRows = this.db.prepare(entitySql).all(...params) as Array<{
      id: string; name: string; type: string; confidence: number; source_file: string;
    }>;

    const entityIds = new Set(entityRows.map(e => e.id));

    const relRows = this.db.prepare(
      `SELECT id, type, source_entity_id, target_entity_id, confidence
       FROM relationships
       LIMIT ?`,
    ).all(limit * 2) as Array<{
      id: string; type: string; source_entity_id: string; target_entity_id: string; confidence: number;
    }>;

    // Only include edges where both endpoints are in our node set
    const edges = relRows
      .filter(r => entityIds.has(r.source_entity_id) && entityIds.has(r.target_entity_id))
      .map(r => ({
        id: r.id,
        source: r.source_entity_id,
        target: r.target_entity_id,
        type: r.type,
        confidence: r.confidence,
      }));

    return {
      nodes: entityRows.map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        confidence: e.confidence,
        sourceFile: e.source_file,
      })),
      edges,
    };
  }
}
