import type { SQLiteStore } from '@cortex/graph';

export interface ListProjectsResult {
  projects: Array<{
    id: string;
    name: string;
    rootPath: string;
    privacyLevel: string;
    fileCount: number;
    entityCount: number;
    lastIngestedAt?: string;
    createdAt: string;
  }>;
  total: number;
}

export async function handleListProjects(store: SQLiteStore): Promise<ListProjectsResult> {
  const projects = await store.listProjects();
  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      rootPath: p.rootPath,
      privacyLevel: p.privacyLevel,
      fileCount: p.fileCount,
      entityCount: p.entityCount,
      lastIngestedAt: p.lastIngestedAt,
      createdAt: p.createdAt,
    })),
    total: projects.length,
  };
}
