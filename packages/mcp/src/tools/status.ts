import type { SQLiteStore } from '@cortex/graph';

export interface GetStatusResult {
  graph: {
    entityCount: number;
    relationshipCount: number;
    fileCount: number;
    projectCount: number;
    contradictionCount: number;
    dbSizeBytes: number;
  };
  ready: boolean;
  hint?: string;
}

export async function handleGetStatus(store: SQLiteStore): Promise<GetStatusResult> {
  const stats = await store.getStats();
  const ready = stats.entityCount > 0;
  return {
    graph: {
      entityCount: stats.entityCount,
      relationshipCount: stats.relationshipCount,
      fileCount: stats.fileCount,
      projectCount: stats.projectCount,
      contradictionCount: stats.contradictionCount,
      dbSizeBytes: stats.dbSizeBytes,
    },
    ready,
    ...(!ready && { hint: 'No entities yet. Run `cortex watch` in your project directory to ingest files.' }),
  };
}
