import type Database from 'better-sqlite3';

export const MIGRATION_VERSION = 1;

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL UNIQUE,
      privacy_level TEXT NOT NULL DEFAULT 'standard',
      file_count INTEGER DEFAULT 0,
      entity_count INTEGER DEFAULT 0,
      last_ingested_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      properties TEXT,
      confidence REAL NOT NULL,
      source_file TEXT NOT NULL,
      source_start_line INTEGER,
      source_end_line INTEGER,
      project_id TEXT NOT NULL,
      extracted_by TEXT NOT NULL,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source_entity_id TEXT NOT NULL,
      target_entity_id TEXT NOT NULL,
      description TEXT,
      confidence REAL NOT NULL,
      properties TEXT,
      extracted_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (source_entity_id) REFERENCES entities(id),
      FOREIGN KEY (target_entity_id) REFERENCES entities(id)
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      relative_path TEXT NOT NULL,
      project_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      file_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      last_modified TEXT NOT NULL,
      last_ingested_at TEXT,
      entity_ids TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      parse_error TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS contradictions (
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

    CREATE TABLE IF NOT EXISTS token_usage (
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

    CREATE TABLE IF NOT EXISTS dead_letter_queue (
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
    CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(name, content, summary, tags);

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_entities_project ON entities(project_id);
    CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);
    CREATE INDEX IF NOT EXISTS idx_entities_source ON entities(source_file);
    CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
    CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
    CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
    CREATE INDEX IF NOT EXISTS idx_files_hash ON files(content_hash);
    CREATE INDEX IF NOT EXISTS idx_token_usage_month ON token_usage(timestamp);
    CREATE INDEX IF NOT EXISTS idx_dlq_status ON dead_letter_queue(status);

    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (${MIGRATION_VERSION}, datetime('now'));
  `);
}
