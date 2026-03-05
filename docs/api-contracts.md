# GZOO Cortex API Contracts

## Event Bus

The event bus is the communication backbone between packages. No package imports another package directly (except `@cortex/core` types).

```typescript
// packages/core/src/events/event-bus.ts
class EventBus {
  private handlers: Map<string, Set<Function>> = new Map();

  emit(event: CortexEvent): void;
  on(type: string, handler: (event: CortexEvent) => void): () => void; // returns unsubscribe
  off(type: string, handler: Function): void;
  once(type: string, handler: (event: CortexEvent) => void): void;
}

// Singleton: export const eventBus = new EventBus();
```

### Key Event Flows

**File change → Entity extraction:**
```
file.changed → [ingest] parse file → file.parsed
  → [llm] extract entities → entity.created (×N)
  → [llm] infer relationships → relationship.created (×N)
  → file.ingested
```

**User query:**
```
query.received → [graph] semantic search → [llm] context ranking
  → [llm] conversational synthesis (streaming) → query.response.chunk (×N)
  → query.response.complete
```

---

## REST API (Phase 3 — define interfaces now)

Base: `http://127.0.0.1:3710/api/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/entities` | List/search entities (query params: type, project, search, limit, offset) |
| GET | `/entities/:id` | Get entity by ID |
| GET | `/entities/:id/relationships` | Get relationships for entity |
| GET | `/relationships` | List relationships (query params: type, sourceId, targetId) |
| GET | `/projects` | List projects |
| GET | `/projects/:id` | Get project details |
| POST | `/query` | Natural language query (body: `{ query, filters?, stream? }`) |
| GET | `/contradictions` | List active contradictions |
| POST | `/contradictions/:id/resolve` | Resolve contradiction (body: `{ action }`) |
| GET | `/status` | System status |
| GET | `/costs` | Cost report |
| GET | `/costs/history` | Monthly cost history |

### Standard Response Envelope

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}
```

---

## WebSocket Protocol (Phase 3)

Endpoint: `ws://127.0.0.1:3710/ws`

### Client → Server Messages

```typescript
type ClientMessage =
  | { type: 'query.start'; id: string; query: string; filters?: QueryFilters }
  | { type: 'query.cancel'; id: string }
  | { type: 'subscribe'; channels: string[] }     // e.g., ['entity.*', 'contradiction.*']
  | { type: 'unsubscribe'; channels: string[] };
```

### Server → Client Messages

```typescript
type ServerMessage =
  | { type: 'query.chunk'; id: string; content: string }
  | { type: 'query.sources'; id: string; entities: Entity[] }
  | { type: 'query.followups'; id: string; questions: string[] }
  | { type: 'query.complete'; id: string; usage: TokenUsage }
  | { type: 'query.error'; id: string; error: { code: string; message: string } }
  | { type: 'event'; channel: string; event: CortexEvent };
```

---

## Graph Store Interface

Implemented in `packages/graph/src/sqlite-store.ts`. See `docs/types.md` for the full `GraphStore` interface.

### SQLite Schema (Phase 1)

```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  properties TEXT,           -- JSON
  confidence REAL NOT NULL,
  source_file TEXT NOT NULL,
  source_start_line INTEGER,
  source_end_line INTEGER,
  project_id TEXT NOT NULL,
  extracted_by TEXT NOT NULL, -- JSON: ExtractionMetadata
  tags TEXT,                 -- JSON array
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  description TEXT,
  confidence REAL NOT NULL,
  properties TEXT,           -- JSON
  extracted_by TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_entity_id) REFERENCES entities(id),
  FOREIGN KEY (target_entity_id) REFERENCES entities(id)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  privacy_level TEXT NOT NULL DEFAULT 'standard',
  file_count INTEGER DEFAULT 0,
  entity_count INTEGER DEFAULT 0,
  last_ingested_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  relative_path TEXT NOT NULL,
  project_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  last_modified TEXT NOT NULL,
  last_ingested_at TEXT,
  entity_ids TEXT,           -- JSON array
  status TEXT NOT NULL DEFAULT 'pending',
  parse_error TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE contradictions (
  id TEXT PRIMARY KEY,
  entity_id_a TEXT NOT NULL,
  entity_id_b TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  suggested_resolution TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  resolved_action TEXT,
  resolved_at TEXT,
  detected_at TEXT NOT NULL,
  FOREIGN KEY (entity_id_a) REFERENCES entities(id),
  FOREIGN KEY (entity_id_b) REFERENCES entities(id)
);

CREATE TABLE token_usage (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  task TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd REAL NOT NULL,
  latency_ms INTEGER NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE dead_letter_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  first_failed_at TEXT NOT NULL,
  last_failed_at TEXT NOT NULL,
  next_retry_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Full-text search
CREATE VIRTUAL TABLE entities_fts USING fts5(name, content, summary, tags);

-- Indexes
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_project ON entities(project_id);
CREATE INDEX idx_entities_status ON entities(status);
CREATE INDEX idx_entities_source ON entities(source_file);
CREATE INDEX idx_relationships_source ON relationships(source_entity_id);
CREATE INDEX idx_relationships_target ON relationships(target_entity_id);
CREATE INDEX idx_relationships_type ON relationships(type);
CREATE INDEX idx_files_project ON files(project_id);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_hash ON files(content_hash);
CREATE INDEX idx_token_usage_month ON token_usage(timestamp);
CREATE INDEX idx_dlq_status ON dead_letter_queue(status);

-- Pragmas (set on connection)
-- PRAGMA journal_mode = WAL;
-- PRAGMA foreign_keys = ON;
-- PRAGMA busy_timeout = 5000;
```
