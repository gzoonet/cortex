import { useEffect, useRef, useState } from 'react';
import {
  Radio,
  Network,
  GitFork,
  FileText,
  AlertTriangle,
  Merge,
  Zap,
  Loader2,
  CheckCircle,
  Wallet,
  Trash2,
} from 'lucide-react';
import { useWebSocketStore, type WsEvent } from '../stores/websocket';
import { api } from '../stores/api';

const EVENT_CONFIG: Record<string, { icon: typeof Network; color: string; label: string }> = {
  'entity.created': { icon: Network, color: 'text-sky-400', label: 'Entity Created' },
  'relationship.created': { icon: GitFork, color: 'text-emerald-400', label: 'Relationship Created' },
  'file.ingested': { icon: FileText, color: 'text-violet-400', label: 'File Ingested' },
  'entity.merged': { icon: Merge, color: 'text-cyan-400', label: 'Entity Merged' },
  'contradiction.detected': { icon: AlertTriangle, color: 'text-amber-400', label: 'Contradiction' },
  'budget.warning': { icon: Wallet, color: 'text-orange-400', label: 'Budget Warning' },
  'budget.exhausted': { icon: Wallet, color: 'text-red-400', label: 'Budget Exhausted' },
  'llm.request.start': { icon: Loader2, color: 'text-zinc-500', label: 'LLM Request' },
  'llm.request.complete': { icon: CheckCircle, color: 'text-zinc-500', label: 'LLM Complete' },
};

function getEventConfig(channel: string) {
  return EVENT_CONFIG[channel] ?? { icon: Zap, color: 'text-zinc-400', label: channel };
}

function formatPayload(event: WsEvent): string {
  const p = event.payload;
  switch (event.channel) {
    case 'entity.created':
      return `${p.type ?? 'Entity'}: ${p.name ?? p.id ?? ''}`;
    case 'relationship.created':
      return `${p.type ?? 'relates_to'}: ${p.sourceName ?? p.sourceId ?? ''} → ${p.targetName ?? p.targetId ?? ''}`;
    case 'file.ingested':
      return String(p.filePath ?? p.file ?? '').split('/').slice(-2).join('/');
    case 'entity.merged':
      return `Merged: ${p.name ?? p.survivorId ?? ''}`;
    case 'contradiction.detected':
      return `${p.severity ?? 'medium'}: ${p.description ?? ''}`;
    case 'budget.warning':
    case 'budget.exhausted':
      return `${p.provider ?? ''} — ${p.message ?? ''}`;
    case 'llm.request.start':
      return `${p.provider ?? ''} ${p.model ?? ''}`;
    case 'llm.request.complete':
      return `${p.provider ?? ''} ${p.model ?? ''} (${p.tokensUsed ?? '?'} tokens)`;
    default:
      return JSON.stringify(p);
  }
}

function EventRow({ event }: { event: WsEvent }) {
  const config = getEventConfig(event.channel);
  const Icon = config.icon;
  const isLlm = event.channel.startsWith('llm.');

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-2.5 text-sm transition-opacity ${
        isLlm
          ? 'border-zinc-800/50 bg-zinc-900/50 opacity-60'
          : 'border-zinc-800 bg-zinc-900'
      }`}
    >
      <span className="mt-0.5 shrink-0 font-mono text-xs text-zinc-600">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.color}`} />
      <span className={`shrink-0 font-medium ${config.color}`}>{config.label}</span>
      <span className="flex-1 truncate text-zinc-400">{formatPayload(event)}</span>
    </div>
  );
}

function CounterCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-3">
      <span className={`text-3xl font-bold tabular-nums ${color}`}>{count}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

export function LiveFeed() {
  const { connected, events, counters, connect, disconnect, clearEvents, setInitialCounters } = useWebSocketStore();
  const [paused, setPaused] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load existing DB stats as initial counters
    api.getStatus()
      .then((res) => {
        const g = res.data.graph;
        setInitialCounters({
          entities: g.entityCount,
          relationships: g.relationshipCount,
          files: g.fileCount,
          contradictions: g.contradictionCount,
        });
      })
      .catch(() => {});
    connect();
    return () => disconnect();
  }, [connect, disconnect, setInitialCounters]);

  // Auto-scroll to top when new events arrive (unless paused)
  useEffect(() => {
    if (!paused && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events.length, paused]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Live Feed</h1>
          <span className="flex items-center gap-1.5 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}
            />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button
              onClick={clearEvents}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          )}
          <button
            onClick={() => setPaused(!paused)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${
              paused
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Session Counters */}
      <div className="grid grid-cols-4 gap-3">
        <CounterCard label="Entities" count={counters.entities} color="text-sky-400" />
        <CounterCard label="Relationships" count={counters.relationships} color="text-emerald-400" />
        <CounterCard label="Files" count={counters.files} color="text-violet-400" />
        <CounterCard label="Contradictions" count={counters.contradictions} color="text-amber-400" />
      </div>

      {/* Event Stream */}
      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
          <Radio className="h-12 w-12 text-zinc-700" />
          <p className="text-sm">Waiting for events...</p>
          <p className="max-w-md text-center text-xs text-zinc-600">
            Edit a file in one of your registered projects to see live ingestion events.
          </p>
          <p className="max-w-md text-center text-xs text-zinc-600">
            The server watches your projects automatically &mdash; you do not need
            to run <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">cortex watch</code> separately.
          </p>
        </div>
      ) : (
        <div
          ref={listRef}
          className="flex-1 space-y-1 overflow-y-auto"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {events.map((event, i) => (
            <EventRow key={`${event.timestamp}-${i}`} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
