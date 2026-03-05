import { useEffect, useState } from 'react';
import { AlertTriangle, X, CheckCircle, ArrowRight, Eye } from 'lucide-react';
import { api, type Contradiction } from '../stores/api';

const DEFAULT_SEVERITY = { badge: 'text-zinc-400 border-zinc-700 bg-zinc-800/30', border: 'border-zinc-700' };

const SEVERITY_STYLES: Record<string, { badge: string; border: string }> = {
  critical: { badge: 'text-red-400 border-red-800 bg-red-950/30', border: 'border-red-800/50' },
  high: { badge: 'text-red-400 border-red-800 bg-red-950/30', border: 'border-red-800/30' },
  medium: { badge: 'text-amber-400 border-amber-800 bg-amber-950/30', border: 'border-amber-800/30' },
  low: { badge: 'text-zinc-400 border-zinc-700 bg-zinc-800/30', border: 'border-zinc-700' },
};

const RESOLUTION_LABELS: Record<string, { label: string; description: string }> = {
  supersede: { label: 'Supersede', description: 'Entity A replaces Entity B' },
  dismiss: { label: 'Dismiss', description: 'Not a real contradiction' },
  keep_old: { label: 'Keep Old', description: 'Keep the older entity' },
  both_valid: { label: 'Both Valid', description: 'Both entities are correct' },
};

type StatusFilter = 'all' | 'active' | 'resolved' | 'dismissed';

function EntityCard({
  label,
  entity,
}: {
  label: string;
  entity: Contradiction['entityA'];
}) {
  if (!entity) {
    return (
      <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-xs font-semibold uppercase text-zinc-600">{label}</p>
        <p className="mt-2 text-sm text-zinc-500">Entity not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-semibold uppercase text-zinc-600">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-200">{entity.name}</p>
      <span className="mt-1 inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
        {entity.type}
      </span>
      {entity.summary && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{entity.summary}</p>
      )}
    </div>
  );
}

export function Contradictions() {
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contradiction | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '200' };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await api.getContradictions(params);
      setContradictions(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleResolve = async (id: string, action: string) => {
    setResolving(id);
    try {
      await api.resolveContradiction(id, action);
      // Update locally for instant feedback
      setContradictions((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'resolved' } : c)),
      );
      if (selected?.id === id) setSelected(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResolving(null);
    }
  };

  const activeCount = contradictions.filter((c) => c.status === 'active').length;
  const resolvedCount = contradictions.filter((c) => c.status === 'resolved').length;

  if (error) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Main list */}
      <div className="flex flex-1 flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Contradictions</h1>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              {activeCount} active
            </span>
            {resolvedCount > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                {resolvedCount} resolved
              </span>
            )}
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
          {(['all', 'active', 'resolved', 'dismissed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-zinc-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
            Loading contradictions...
          </div>
        ) : contradictions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
            <AlertTriangle className="h-12 w-12 text-zinc-700" />
            <p className="text-sm">
              {statusFilter === 'all'
                ? 'No contradictions detected'
                : `No ${statusFilter} contradictions`}
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto">
            {contradictions.map((c) => {
              const styles = SEVERITY_STYLES[c.severity] ?? DEFAULT_SEVERITY;
              const isSelected = selected?.id === c.id;

              return (
                <div
                  key={c.id}
                  className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? 'border-cortex-500/50 bg-cortex-500/5'
                      : `${styles.border} bg-zinc-900 hover:bg-zinc-800/50`
                  }`}
                  onClick={() => setSelected(isSelected ? null : c)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${styles.badge}`}
                        >
                          {c.severity}
                        </span>
                        {c.status !== 'active' && (
                          <span className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                            <CheckCircle className="h-3 w-3" />
                            {c.status}
                          </span>
                        )}
                        <span className="text-sm font-medium text-zinc-200">
                          {c.entityA?.name ?? '?'}
                          <span className="mx-2 text-zinc-600">vs</span>
                          {c.entityB?.name ?? '?'}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400">{c.description}</p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(isSelected ? null : c);
                      }}
                      className="shrink-0 rounded-lg border border-zinc-700 p-1.5 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-[420px] shrink-0 space-y-4 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Contradiction Details</h3>
            <button
              onClick={() => setSelected(null)}
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Severity + description */}
          <div className="space-y-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                (SEVERITY_STYLES[selected.severity] ?? DEFAULT_SEVERITY).badge
              }`}
            >
              {selected.severity}
            </span>
            <p className="text-sm text-zinc-300">{selected.description}</p>
          </div>

          {/* Side-by-side comparison */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Comparison
            </p>
            <div className="flex gap-2">
              <EntityCard label="Entity A" entity={selected.entityA} />
              <div className="flex items-center">
                <ArrowRight className="h-4 w-4 text-zinc-600" />
              </div>
              <EntityCard label="Entity B" entity={selected.entityB} />
            </div>
          </div>

          {/* Resolution actions */}
          {selected.status === 'active' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Resolution
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(RESOLUTION_LABELS).map(([action, { label, description }]) => (
                  <button
                    key={action}
                    disabled={resolving === selected.id}
                    onClick={() => handleResolve(selected.id, action)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-left transition-colors hover:border-cortex-500 hover:bg-zinc-800/80 disabled:opacity-50"
                  >
                    <p className="text-xs font-medium text-zinc-200">{label}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{description}</p>
                  </button>
                ))}
              </div>
              {resolving === selected.id && (
                <p className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
                  Resolving...
                </p>
              )}
            </div>
          )}

          {selected.status !== 'active' && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-800/30 bg-emerald-950/20 p-3 text-sm text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              Already {selected.status}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
