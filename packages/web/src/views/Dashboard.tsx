import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { api, type StatusData, type ReportData, type Entity, type Project } from '../stores/api';
import { StatsCards } from '../components/charts/StatsCards';
import { EntityDonut } from '../components/charts/EntityDonut';

export function Dashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [recentEntities, setRecentEntities] = useState<Entity[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getStatus(),
      api.getReport(),
      api.getEntities({ limit: '20' }),
      api.getProjects(),
    ])
      .then(([s, r, e, p]) => {
        setStatus(s.data);
        setReport(r.data);
        setRecentEntities(e.data);
        setProjects(p.data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-400">Failed to load: {error}</p>
      </div>
    );
  }

  if (!status || !report) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-cortex-500 border-t-transparent" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with project selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {projects.length > 1 && (
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-cortex-500"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stat cards */}
      <StatsCards graph={status.graph} />

      {/* Donut chart + Contradictions summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-lg font-semibold">Entity Distribution</h2>
          <EntityDonut data={report.entityBreakdown} />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Contradictions</h2>
            <Link
              to="/contradictions"
              className="flex items-center gap-1 text-xs text-cortex-400 hover:text-cortex-300"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-zinc-800 p-3 text-center">
              <p className="text-xl font-bold text-red-400">{report.contradictions.active}</p>
              <p className="text-xs text-zinc-500">Active</p>
            </div>
            <div className="rounded-lg bg-zinc-800 p-3 text-center">
              <p className="text-xl font-bold text-emerald-400">{report.contradictions.resolved}</p>
              <p className="text-xs text-zinc-500">Resolved</p>
            </div>
            <div className="rounded-lg bg-zinc-800 p-3 text-center">
              <p className="text-xl font-bold text-zinc-400">{report.contradictions.dismissed}</p>
              <p className="text-xs text-zinc-500">Dismissed</p>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-zinc-500">
            <span>
              <span className="font-medium text-red-400">{report.contradictions.highSeverity}</span> high
            </span>
            <span>
              <span className="font-medium text-amber-400">{report.contradictions.mediumSeverity}</span> medium
            </span>
            <span>
              <span className="font-medium text-zinc-400">{report.contradictions.lowSeverity}</span> low
            </span>
          </div>
          {report.topContradictions.length > 0 && (
            <div className="mt-4 space-y-2">
              {report.topContradictions.slice(0, 3).map((c) => (
                <div key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
                  <span className="font-medium text-zinc-300">{c.entityA}</span>
                  <span className="text-zinc-600"> vs </span>
                  <span className="font-medium text-zinc-300">{c.entityB}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity + system info */}
      <div className="grid grid-cols-3 gap-4">
        {/* Activity feed */}
        <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-lg font-semibold">Recent Entities</h2>
          {recentEntities.length === 0 ? (
            <p className="text-sm text-zinc-500">No entities extracted yet.</p>
          ) : (
            <div className="space-y-1.5">
              {recentEntities.map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-800"
                >
                  <EntityTypeBadge type={entity.type} />
                  <span className="flex-1 truncate font-medium text-zinc-200">
                    {entity.name}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-zinc-600">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(entity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System info */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 text-lg font-semibold">LLM</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Mode</span>
                <span className="text-zinc-200">{status.llm.mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className={status.llm.available ? 'text-emerald-400' : 'text-red-400'}>
                  {status.llm.available ? 'Available' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">DB Size</span>
                <span className="text-zinc-200">{formatBytes(status.graph.dbSizeBytes)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 text-lg font-semibold">Files</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Ingested</span>
                <span className="text-emerald-400">{report.fileStatus.ingested}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Failed</span>
                <span className="text-red-400">{report.fileStatus.failed}</span>
              </div>
              {report.tokenEstimate.totalInput > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tokens used</span>
                  <span className="text-zinc-200">
                    {((report.tokenEstimate.totalInput + report.tokenEstimate.totalOutput) / 1_000_000).toFixed(1)}M
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  Decision: 'bg-amber-500/20 text-amber-400',
  Requirement: 'bg-blue-500/20 text-blue-400',
  Pattern: 'bg-violet-500/20 text-violet-400',
  Component: 'bg-emerald-500/20 text-emerald-400',
  Dependency: 'bg-red-500/20 text-red-400',
  Interface: 'bg-cyan-500/20 text-cyan-400',
  Constraint: 'bg-orange-500/20 text-orange-400',
  ActionItem: 'bg-pink-500/20 text-pink-400',
  Risk: 'bg-red-600/20 text-red-300',
  Note: 'bg-zinc-500/20 text-zinc-400',
};

function EntityTypeBadge({ type }: { type: string }) {
  const colors = TYPE_COLORS[type] ?? 'bg-zinc-500/20 text-zinc-400';
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors}`}>
      {type.slice(0, 4)}
    </span>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
