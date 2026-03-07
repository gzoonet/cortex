import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SQLiteStore } from '@cortex/graph';
import type { Router } from '@cortex/llm';
import { IngestionPipeline, type PipelineResult } from '@cortex/ingest';
import { findProjectByPath } from '@cortex/core';

export interface IngestFileInput {
  filePath: string;
  projectId?: string;
}

export interface IngestFileResult {
  status: string;
  fileId: string;
  entityIds: string[];
  relationshipIds: string[];
  entityCount: number;
  error?: string;
}

export async function handleIngestFile(
  input: IngestFileInput,
  store: SQLiteStore,
  router: Router,
): Promise<IngestFileResult> {
  const filePath = resolve(input.filePath);

  if (!existsSync(filePath)) {
    return { status: 'failed', fileId: '', entityIds: [], relationshipIds: [], entityCount: 0, error: 'File not found' };
  }

  const stat = statSync(filePath);
  if (!stat.isFile()) {
    return { status: 'failed', fileId: '', entityIds: [], relationshipIds: [], entityCount: 0, error: 'Path is not a file' };
  }

  // Find project context
  let project: { id: string; name: string; rootPath: string; privacyLevel: string } | null = null;

  if (input.projectId) {
    project = await store.getProject(input.projectId);
    if (!project) {
      return { status: 'failed', fileId: '', entityIds: [], relationshipIds: [], entityCount: 0, error: 'Project not found' };
    }
  } else {
    // Auto-detect project from file path
    const projects = await store.listProjects();
    for (const p of projects) {
      const root = p.rootPath.replace(/\\/g, '/').toLowerCase();
      const file = filePath.replace(/\\/g, '/').toLowerCase();
      if (file.startsWith(root + '/') || file === root) {
        project = p;
        break;
      }
    }
    if (!project) {
      // Try file-based registry
      const entry = findProjectByPath(filePath);
      if (entry) {
        // Find matching DB project by name
        const dbProjects = await store.listProjects();
        project = dbProjects.find((p) => p.name === entry.name) ?? null;
      }
    }
  }

  if (!project) {
    return { status: 'failed', fileId: '', entityIds: [], relationshipIds: [], entityCount: 0, error: 'File does not belong to any registered project' };
  }

  const pipeline = new IngestionPipeline(router, store, {
    projectId: project.id,
    projectName: project.name,
    projectRoot: project.rootPath,
    maxFileSize: 1_048_576,
    batchSize: 10,
    projectPrivacyLevel: (project.privacyLevel as 'standard' | 'sensitive' | 'restricted') ?? 'standard',
    mergeConfidenceThreshold: 0.85,
  });

  const result: PipelineResult = await pipeline.ingestFile(filePath);

  return {
    status: result.status,
    fileId: result.fileId,
    entityIds: result.entityIds,
    relationshipIds: result.relationshipIds,
    entityCount: result.entityIds.length,
    error: result.error,
  };
}
