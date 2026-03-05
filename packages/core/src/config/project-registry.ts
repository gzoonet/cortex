import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const REGISTRY_PATH = join(homedir(), '.cortex', 'projects.json');

export const projectEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  configPath: z.string().optional(),
  addedAt: z.string(),
  lastWatched: z.string().optional(),
});

export const projectRegistrySchema = z.object({
  version: z.literal('1.0'),
  projects: z.record(z.string(), projectEntrySchema),
});

export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export type ProjectRegistry = z.infer<typeof projectRegistrySchema>;

function ensureRegistryDir(): void {
  const dir = join(homedir(), '.cortex');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadProjectRegistry(): ProjectRegistry {
  ensureRegistryDir();
  
  if (!existsSync(REGISTRY_PATH)) {
    return { version: '1.0', projects: {} };
  }

  try {
    const raw = readFileSync(REGISTRY_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return projectRegistrySchema.parse(data);
  } catch {
    // Corrupted registry, start fresh
    return { version: '1.0', projects: {} };
  }
}

export function saveProjectRegistry(registry: ProjectRegistry): void {
  ensureRegistryDir();
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

export function addProject(name: string, path: string, configPath?: string): ProjectEntry {
  const registry = loadProjectRegistry();
  
  const entry: ProjectEntry = {
    name,
    path,
    configPath,
    addedAt: new Date().toISOString(),
  };
  
  registry.projects[name] = entry;
  saveProjectRegistry(registry);
  
  return entry;
}

export function removeProject(name: string): boolean {
  const registry = loadProjectRegistry();
  
  if (!registry.projects[name]) {
    return false;
  }
  
  delete registry.projects[name];
  saveProjectRegistry(registry);
  
  return true;
}

export function getProject(name: string): ProjectEntry | null {
  const registry = loadProjectRegistry();
  return registry.projects[name] ?? null;
}

export function listProjects(): ProjectEntry[] {
  const registry = loadProjectRegistry();
  return Object.values(registry.projects);
}

export function updateProjectLastWatched(name: string): void {
  const registry = loadProjectRegistry();
  
  if (registry.projects[name]) {
    registry.projects[name].lastWatched = new Date().toISOString();
    saveProjectRegistry(registry);
  }
}

export function findProjectByPath(searchPath: string): ProjectEntry | null {
  const registry = loadProjectRegistry();
  const normalized = searchPath.toLowerCase().replace(/\\/g, '/');
  
  for (const project of Object.values(registry.projects)) {
    const projectNormalized = project.path.toLowerCase().replace(/\\/g, '/');
    if (normalized === projectNormalized || normalized.startsWith(projectNormalized + '/')) {
      return project;
    }
  }
  
  return null;
}
