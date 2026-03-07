import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SQLiteStore } from '@cortex/graph';
import {
  addProject as addProjectToRegistry,
  removeProject as removeProjectFromRegistry,
  getProject as getRegistryProject,
} from '@cortex/core';

export interface AddProjectInput {
  name: string;
  path: string;
  privacyLevel?: 'standard' | 'sensitive' | 'restricted';
}

export interface AddProjectResult {
  success: boolean;
  project?: { id: string; name: string; rootPath: string; privacyLevel: string };
  error?: string;
}

export async function handleAddProject(
  input: AddProjectInput,
  store: SQLiteStore,
): Promise<AddProjectResult> {
  const rootPath = resolve(input.path);

  if (!existsSync(rootPath)) {
    return { success: false, error: 'Path does not exist' };
  }

  const stat = statSync(rootPath);
  if (!stat.isDirectory()) {
    return { success: false, error: 'Path is not a directory' };
  }

  // Check if already registered
  const existing = getRegistryProject(input.name);
  if (existing) {
    return { success: false, error: `Project "${input.name}" already exists` };
  }

  // Add to file-based registry
  addProjectToRegistry(input.name, rootPath);

  // Add to DB
  const privacyLevel = input.privacyLevel ?? 'standard';
  const project = await store.createProject({
    name: input.name,
    rootPath,
    privacyLevel,
    fileCount: 0,
    entityCount: 0,
  });

  return {
    success: true,
    project: {
      id: project.id,
      name: project.name,
      rootPath: project.rootPath,
      privacyLevel: project.privacyLevel,
    },
  };
}

export interface RemoveProjectInput {
  name: string;
}

export interface RemoveProjectResult {
  success: boolean;
  removed?: string;
  note?: string;
  error?: string;
}

export async function handleRemoveProject(
  input: RemoveProjectInput,
): Promise<RemoveProjectResult> {
  const existing = getRegistryProject(input.name);
  if (!existing) {
    return { success: false, error: `Project "${input.name}" not found in registry` };
  }

  const removed = removeProjectFromRegistry(input.name);
  if (!removed) {
    return { success: false, error: 'Failed to remove project from registry' };
  }

  return {
    success: true,
    removed: input.name,
    note: 'Project removed from registry. Entities are preserved in the knowledge graph.',
  };
}
