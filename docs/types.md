# GZOO Cortex Type Definitions

> All types live in `packages/core/src/types/`. Import from `@cortex/core`.

## Entity Types

```typescript
type EntityType =
  | 'Decision'
  | 'Requirement'
  | 'Pattern'
  | 'Component'
  | 'Dependency'
  | 'Interface'
  | 'Constraint'
  | 'ActionItem'
  | 'Risk'
  | 'Note';

interface Entity {
  id: string;                    // UUID v4
  type: EntityType;
  name: string;                  // human-readable, unique within project
  content: string;               // full extracted text
  summary?: string;              // 1-2 sentence summary
  properties: Record<string, unknown>; // type-specific metadata
  confidence: number;            // 0.0-1.0, extraction confidence
  sourceFile: string;            // absolute path to source file
  sourceRange?: {                // line range in source
    startLine: number;
    endLine: number;
  };
  projectId: string;             // which watched directory
  extractedBy: ExtractionMetadata;
  embedding?: Float32Array;      // vector from embedding model
  tags: string[];
  status: 'active' | 'superseded' | 'deleted';
  createdAt: string;             // ISO 8601
  updatedAt: string;
}

interface ExtractionMetadata {
  promptId: string;              // e.g., 'entity_extraction'
  promptVersion: string;         // e.g., '1.0.0'
  model: string;                 // e.g., 'claude-haiku-4-5-20251001'
  provider: string;              // e.g., 'anthropic'
  tokensUsed: {
    input: number;
    output: number;
  };
  timestamp: string;
}
```

## Relationship Types

```typescript
type RelationshipType =
  | 'depends_on'
  | 'implements'
  | 'contradicts'
  | 'evolved_from'
  | 'relates_to'
  | 'uses'
  | 'constrains'
  | 'resolves'
  | 'documents'
  | 'derived_from';

interface Relationship {
  id: string;                    // UUID v4
  type: RelationshipType;
  sourceEntityId: string;        // from entity
  targetEntityId: string;        // to entity
  description?: string;          // why this relationship exists
  confidence: number;            // 0.0-1.0
  properties: Record<string, unknown>;
  extractedBy: ExtractionMetadata;
  createdAt: string;
  updatedAt: string;
}
```

## Contradiction

```typescript
interface Contradiction {
  id: string;                    // UUID v4, format CONTR-XXXX for display
  entityIds: [string, string];   // the two conflicting entities
  description: string;           // what the contradiction is
  severity: 'low' | 'medium' | 'high';
  suggestedResolution?: string;
  status: 'active' | 'resolved' | 'dismissed';
  resolvedAction?: 'supersede' | 'dismiss' | 'keep_old' | 'both_valid';
  resolvedAt?: string;
  detectedAt: string;
}
```

## Project

```typescript
interface Project {
  id: string;                    // UUID v4
  name: string;                  // derived from directory name
  rootPath: string;              // absolute path
  privacyLevel: 'standard' | 'sensitive' | 'restricted';
  fileCount: number;
  entityCount: number;
  lastIngestedAt?: string;
  createdAt: string;
}
```

## File Record

```typescript
interface FileRecord {
  id: string;
  path: string;                  // absolute path
  relativePath: string;          // relative to project root
  projectId: string;
  contentHash: string;           // SHA-256 of file content
  fileType: string;              // extension without dot
  sizeBytes: number;
  lastModified: string;
  lastIngestedAt?: string;
  entityIds: string[];           // entities extracted from this file
  status: 'pending' | 'ingested' | 'failed' | 'excluded';
  parseError?: string;           // if status === 'failed'
}
```

## LLM Types

```typescript
enum LLMTask {
  ENTITY_EXTRACTION = 'entity_extraction',
  RELATIONSHIP_INFERENCE = 'relationship_inference',
  EMBEDDING_GENERATION = 'embedding_generation',
  CONVERSATIONAL_QUERY = 'conversational_query',
  CONTRADICTION_DETECTION = 'contradiction_detection',
  CONTEXT_RANKING = 'context_ranking',
}

interface LLMRequest {
  id: string;                    // UUID v4
  task: LLMTask;
  prompt: string;
  systemPrompt?: string;
  schema?: Record<string, unknown>; // JSON schema for structured output
  options?: CompletionOptions;
  constraints?: RoutingConstraints;
}

interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stopSequences?: string[];
}

interface RoutingConstraints {
  forceProvider?: 'local' | 'cloud';
  maxLatencyMs?: number;
  maxCostUsd?: number;
  privacyLevel?: 'standard' | 'sensitive' | 'restricted';
}

interface LLMResponse {
  id: string;
  requestId: string;
  content: string;
  provider: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
  latencyMs: number;
  cached: boolean;
  timestamp: string;
}

interface LLMProvider {
  name: string;
  type: 'local' | 'cloud';
  capabilities: ProviderCapabilities;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  completeStructured<T>(prompt: string, schema: Record<string, unknown>, options?: CompletionOptions): Promise<T>;
  stream(prompt: string, options?: CompletionOptions): AsyncGenerator<string>;
  embed(texts: string[]): Promise<Float32Array[]>;
  isAvailable(): Promise<boolean>;
}

interface ProviderCapabilities {
  supportedTasks: LLMTask[];
  maxContextTokens: number;
  supportsStructuredOutput: boolean;
  supportsStreaming: boolean;
  estimatedTokensPerSecond: number;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
}
```

## Event Bus Types

```typescript
interface CortexEvent {
  type: string;
  payload: unknown;
  timestamp: string;
  source: string;                // which package emitted
}

// Key event types:
// 'file.changed'        → { path, changeType: 'add'|'change'|'unlink' }
// 'file.ingested'       → { fileId, entityIds, relationshipIds }
// 'entity.created'      → { entity: Entity }
// 'entity.updated'      → { entity: Entity, changes: string[] }
// 'entity.merged'       → { survivorId, mergedId }
// 'relationship.created'→ { relationship: Relationship }
// 'contradiction.detected' → { contradiction: Contradiction }
// 'llm.request.start'   → { requestId, task, provider }
// 'llm.request.complete'→ { requestId, usage, latencyMs }
// 'llm.request.error'   → { requestId, error: CortexError }
// 'budget.warning'      → { usedPercent, remainingUsd }
// 'budget.exhausted'    → { totalSpentUsd }
// 'error.occurred'      → { code, severity, layer, message }

interface EventBus {
  emit(event: CortexEvent): void;
  on(type: string, handler: (event: CortexEvent) => void): void;
  off(type: string, handler: (event: CortexEvent) => void): void;
  once(type: string, handler: (event: CortexEvent) => void): void;
}
```

## Token Usage / Cost Tracking

```typescript
interface TokenUsageRecord {
  id: string;
  requestId: string;
  task: LLMTask;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  timestamp: string;
}

interface CostReport {
  currentMonth: {
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
    costByTask: Record<string, number>;
    costByProvider: Record<string, number>;
    budgetRemainingUsd: number;
    budgetUsedPercent: number;
  };
  history: MonthlySnapshot[];
  projectedMonthlyCost: number;
}

interface MonthlySnapshot {
  month: string;                 // 'YYYY-MM'
  totalCostUsd: number;
  requestCount: number;
}
```

## Graph Store Interface

```typescript
interface GraphStore {
  // Entities
  createEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity>;
  getEntity(id: string): Promise<Entity | null>;
  updateEntity(id: string, updates: Partial<Entity>): Promise<Entity>;
  deleteEntity(id: string, soft?: boolean): Promise<void>;
  findEntities(query: EntityQuery): Promise<Entity[]>;

  // Relationships
  createRelationship(rel: Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>): Promise<Relationship>;
  getRelationship(id: string): Promise<Relationship | null>;
  getRelationshipsForEntity(entityId: string, direction?: 'in' | 'out' | 'both'): Promise<Relationship[]>;
  deleteRelationship(id: string): Promise<void>;

  // Files
  upsertFile(file: Omit<FileRecord, 'id'>): Promise<FileRecord>;
  getFile(path: string): Promise<FileRecord | null>;
  getFilesByProject(projectId: string): Promise<FileRecord[]>;

  // Projects
  createProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  listProjects(): Promise<Project[]>;

  // Search
  searchEntities(text: string, limit?: number): Promise<Entity[]>; // FTS
  semanticSearch(embedding: Float32Array, limit?: number): Promise<Entity[]>; // vector

  // Stats
  getStats(): Promise<GraphStats>;

  // Maintenance
  backup(): Promise<string>; // returns backup path
  integrityCheck(): Promise<IntegrityResult>;
}

interface EntityQuery {
  type?: EntityType;
  projectId?: string;
  status?: string;
  since?: string;               // ISO date
  before?: string;
  search?: string;              // FTS query
  limit?: number;
  offset?: number;
}

interface GraphStats {
  entityCount: number;
  relationshipCount: number;
  fileCount: number;
  projectCount: number;
  contradictionCount: number;
  dbSizeBytes: number;
  vectorDbSizeBytes: number;
}
```

## Dead Letter Queue

```typescript
interface DeadLetterEntry {
  id: string;
  type: 'file_parse' | 'entity_extraction' | 'relationship_inference' | 'embedding';
  payload: string;               // JSON: file path, content hash, etc.
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  nextRetryAt?: string;
  status: 'pending' | 'retrying' | 'resolved' | 'abandoned';
}
```

## Transmission Log

```typescript
interface TransmissionLogEntry {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  task: LLMTask;
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
```
