import type { SQLiteStore } from '@cortex/graph';

export interface SessionBriefResult {
  markdown: string;
  stats: {
    entityCount: number;
    relationshipCount: number;
    fileCount: number;
    projectCount: number;
    contradictionCount: number;
  };
}

export async function handleSessionBrief(
  store: SQLiteStore,
  projectId?: string,
): Promise<SessionBriefResult> {
  const [graphStats, projects, contradictions, reportData, recentFiles] = await Promise.all([
    store.getStats(),
    store.listProjects(),
    store.findContradictions({ status: 'active', limit: 10 }),
    store.getReportData(),
    store.getRecentFiles(7, 20),
  ]);

  // Fetch key entity types in parallel
  const [decisions, patterns, risks, actionItems] = await Promise.all([
    store.findEntities({ type: 'Decision', limit: 10, ...(projectId ? { projectId } : {}) }),
    store.findEntities({ type: 'Pattern', limit: 5, ...(projectId ? { projectId } : {}) }),
    store.findEntities({ type: 'Risk', limit: 5, ...(projectId ? { projectId } : {}) }),
    store.findEntities({ type: 'ActionItem', limit: 5, ...(projectId ? { projectId } : {}) }),
  ]);

  // Resolve contradiction entity names
  const enrichedContradictions = await Promise.all(
    contradictions.map(async (c) => {
      const [entityA, entityB] = await Promise.all([
        store.getEntity(c.entityIds[0]).catch(() => null),
        store.getEntity(c.entityIds[1]).catch(() => null),
      ]);
      return {
        severity: c.severity,
        description: c.description,
        entityA: entityA?.name ?? 'unknown',
        entityB: entityB?.name ?? 'unknown',
      };
    }),
  );

  // Build markdown
  const lines: string[] = ['# Cortex Session Brief', ''];

  // Graph overview
  lines.push('## Graph Overview');
  lines.push(`- **${graphStats.entityCount}** entities across **${projects.length}** project(s), **${graphStats.relationshipCount}** relationships`);
  lines.push(`- **${graphStats.fileCount}** files indexed`);
  if (projects.length > 0) {
    const lastIngested = projects
      .map((p) => p.lastIngestedAt)
      .filter(Boolean)
      .sort()
      .pop();
    if (lastIngested) {
      lines.push(`- Last ingested: ${lastIngested}`);
    }
  }
  lines.push('');

  // Projects
  if (projects.length > 0) {
    lines.push('## Projects');
    for (const p of projects) {
      lines.push(`- **${p.name}** (${p.rootPath}) — ${p.entityCount} entities, ${p.fileCount} files`);
    }
    lines.push('');
  }

  // Entity breakdown
  if (reportData.entityBreakdown.length > 0) {
    lines.push('## Entity Breakdown');
    for (const eb of reportData.entityBreakdown) {
      lines.push(`- ${eb.type}: ${eb.count} (avg confidence: ${(eb.avgConfidence * 100).toFixed(0)}%)`);
    }
    lines.push('');
  }

  // Key decisions
  if (decisions.length > 0) {
    lines.push('## Key Decisions');
    for (const d of decisions) {
      const file = d.sourceFile.split('/').pop() ?? d.sourceFile;
      lines.push(`- **${d.name}** — ${d.summary ?? d.content.slice(0, 100)} _(${file})_`);
    }
    lines.push('');
  }

  // Patterns
  if (patterns.length > 0) {
    lines.push('## Active Patterns');
    for (const p of patterns) {
      lines.push(`- **${p.name}** — ${p.summary ?? p.content.slice(0, 100)}`);
    }
    lines.push('');
  }

  // Contradictions
  if (enrichedContradictions.length > 0) {
    lines.push(`## Open Contradictions (${enrichedContradictions.length} active)`);
    for (const c of enrichedContradictions) {
      lines.push(`- [${c.severity.toUpperCase()}] **${c.entityA}** vs **${c.entityB}**: ${c.description}`);
    }
    lines.push('');
  }

  // Risks
  if (risks.length > 0) {
    lines.push('## Active Risks');
    for (const r of risks) {
      lines.push(`- **${r.name}** — ${r.summary ?? r.content.slice(0, 100)}`);
    }
    lines.push('');
  }

  // Action items
  if (actionItems.length > 0) {
    lines.push('## Open Action Items');
    for (const a of actionItems) {
      lines.push(`- **${a.name}** — ${a.summary ?? a.content.slice(0, 100)}`);
    }
    lines.push('');
  }

  // Recent changes
  if (recentFiles.length > 0) {
    lines.push('## Recent Changes (last 7 days)');
    for (const f of recentFiles) {
      const rel = f.relativePath || f.path.split('/').slice(-2).join('/');
      lines.push(`- ${rel} (ingested: ${f.lastIngestedAt ?? 'unknown'})`);
    }
    lines.push('');
  }

  // Empty state
  if (graphStats.entityCount === 0) {
    lines.length = 0;
    lines.push('# Cortex Session Brief', '');
    lines.push('The knowledge graph is empty. Get started by:');
    lines.push('1. Register a project: `add_project` with name and path');
    lines.push('2. Ingest files: `ingest_file` or run `cortex watch`');
    lines.push('3. Ask questions: `cortex_ask` with natural language');
    lines.push('');
  }

  return {
    markdown: lines.join('\n'),
    stats: {
      entityCount: graphStats.entityCount,
      relationshipCount: graphStats.relationshipCount,
      fileCount: graphStats.fileCount,
      projectCount: projects.length,
      contradictionCount: contradictions.length,
    },
  };
}
