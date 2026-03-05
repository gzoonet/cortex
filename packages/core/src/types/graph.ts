import type { Entity, EntityType } from './entity.js';
import type { Relationship, Contradiction } from './relationship.js';
import type { FileRecord } from './file.js';
import type { Project } from './project.js';

export interface EntityQuery {
  type?: EntityType;
  projectId?: string;
  status?: string;
  since?: string;
  before?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GraphStats {
  entityCount: number;
  relationshipCount: number;
  fileCount: number;
  projectCount: number;
  contradictionCount: number;
  dbSizeBytes: number;
  vectorDbSizeBytes: number;
}

export interface IntegrityResult {
  ok: boolean;
  orphanedRelationships: number;
  missingFiles: number;
  details: string[];
}

export interface GraphStore {
  createEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity>;
  getEntity(id: string): Promise<Entity | null>;
  updateEntity(id: string, updates: Partial<Entity>): Promise<Entity>;
  deleteEntity(id: string, soft?: boolean): Promise<void>;
  findEntities(query: EntityQuery): Promise<Entity[]>;

  createRelationship(rel: Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>): Promise<Relationship>;
  getRelationship(id: string): Promise<Relationship | null>;
  getRelationshipsForEntity(entityId: string, direction?: 'in' | 'out' | 'both'): Promise<Relationship[]>;
  deleteRelationship(id: string): Promise<void>;

  upsertFile(file: Omit<FileRecord, 'id'>): Promise<FileRecord>;
  getFile(path: string): Promise<FileRecord | null>;
  getFilesByProject(projectId: string): Promise<FileRecord[]>;

  createProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  listProjects(): Promise<Project[]>;

  searchEntities(text: string, limit?: number): Promise<Entity[]>;
  semanticSearch(embedding: Float32Array, limit?: number): Promise<Entity[]>;

  createContradiction(contradiction: Omit<Contradiction, 'id'>): Promise<Contradiction>;
  findContradictions(query?: { status?: Contradiction['status']; entityId?: string; limit?: number }): Promise<Contradiction[]>;
  updateContradiction(id: string, update: { status: Contradiction['status']; resolvedAction?: Contradiction['resolvedAction']; resolvedAt?: string }): Promise<void>;

  getStats(): Promise<GraphStats>;
  backup(): Promise<string>;
  integrityCheck(): Promise<IntegrityResult>;
}

export interface DeadLetterEntry {
  id: string;
  type: 'file_parse' | 'entity_extraction' | 'relationship_inference' | 'embedding';
  payload: string;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  nextRetryAt?: string;
  status: 'pending' | 'retrying' | 'resolved' | 'abandoned';
}

export interface TransmissionLogEntry {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  task: string;
  endpoint: string;
  requestSizeBytes: number;
  responseSizeBytes: number;
  inputTokens: number;
  outputTokens: number;
  sourceFiles: string[];
  privacyLevels: string[];
  redactionsApplied: number;
  secretsDetected: number;
  latencyMs: number;
  status: 'sent' | 'blocked' | 'error';
}
