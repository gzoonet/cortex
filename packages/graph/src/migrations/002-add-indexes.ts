import type Database from 'better-sqlite3';

export const MIGRATION_VERSION = 2;

export function up(db: Database.Database): void {
  const currentVersion = (db.prepare(
    'SELECT MAX(version) as v FROM schema_version',
  ).get() as { v: number | null })?.v ?? 0;

  if (currentVersion >= MIGRATION_VERSION) return;

  db.exec(`
    -- Composite index for common entity queries (project + status + soft-delete filter)
    CREATE INDEX IF NOT EXISTS idx_entities_project_status_deleted
      ON entities(project_id, status, deleted_at);

    -- Contradiction lookups by status and severity
    CREATE INDEX IF NOT EXISTS idx_contradictions_status_severity
      ON contradictions(status, severity);

    -- Contradiction lookups by entity
    CREATE INDEX IF NOT EXISTS idx_contradictions_entity_a
      ON contradictions(entity_id_a);

    CREATE INDEX IF NOT EXISTS idx_contradictions_entity_b
      ON contradictions(entity_id_b);

    -- Files by project + status (used during watch/ingest)
    CREATE INDEX IF NOT EXISTS idx_files_project_status
      ON files(project_id, status);

    INSERT OR IGNORE INTO schema_version (version, applied_at)
      VALUES (${MIGRATION_VERSION}, datetime('now'));
  `);
}
