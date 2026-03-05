import { useState, useRef, useEffect } from 'react';
import { Search, Send, Clock, Network, Sparkles } from 'lucide-react';
import { api, type QueryResult } from '../stores/api';
import { useNavigate } from 'react-router-dom';

interface HistoryEntry {
  query: string;
  answer: string;
  sources: QueryResult['sources'];
  timestamp: string;
}

const FOLLOW_UP_SUGGESTIONS = [
  'What are the main architectural patterns?',
  'What decisions were made recently?',
  'Are there any contradictions?',
  'What components depend on this?',
  'What risks have been identified?',
];

export function Query() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<QueryResult['sources']>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    setLoading(true);
    setStreaming(true);
    setError(null);
    setAnswer('');
    setSources([]);

    try {
      let fullAnswer = '';
      let resultSources: QueryResult['sources'] = [];

      for await (const event of api.queryStream(q)) {
        if (event.type === 'chunk') {
          fullAnswer += event.content;
          setAnswer(fullAnswer);
        } else if (event.type === 'sources') {
          resultSources = event.entities;
          setSources(resultSources);
        }
      }

      // Add to history
      setHistory((prev) => [
        { query: q, answer: fullAnswer, sources: resultSources, timestamp: new Date().toISOString() },
        ...prev.slice(0, 19),
      ]);
    } catch (err: unknown) {
      // Fallback to non-streaming
      try {
        const res = await api.query(q);
        setAnswer(res.data.answer);
        setSources(res.data.sources ?? []);
        setHistory((prev) => [
          { query: q, answer: res.data.answer, sources: res.data.sources ?? [], timestamp: new Date().toISOString() },
          ...prev.slice(0, 19),
        ]);
      } catch (fallbackErr: unknown) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
      }
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const askFollowUp = (q: string) => {
    setInput(q);
    setTimeout(() => {
      const form = document.querySelector('form');
      form?.requestSubmit();
    }, 50);
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setInput(entry.query);
    setAnswer(entry.answer);
    setSources(entry.sources);
    setError(null);
    setShowHistory(false);
  };

  return (
    <div className="flex h-full gap-4">
      {/* Main content */}
      <div className="flex flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Query Explorer</h1>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                showHistory
                  ? 'border-cortex-500/50 bg-cortex-500/10 text-cortex-400'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              <Clock className="h-3 w-3" />
              History ({history.length})
            </button>
          )}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your codebase..."
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 pl-11 pr-12 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-cortex-500 focus:ring-1 focus:ring-cortex-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-cortex-600 p-1.5 text-white transition-colors hover:bg-cortex-500 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        {/* Loading */}
        {loading && !answer && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cortex-500 border-t-transparent" />
            Searching knowledge graph...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div className="space-y-4">
            <div ref={answerRef} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                {answer}
                {streaming && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-cortex-400" />}
              </div>
            </div>

            {/* Sources */}
            {sources.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Sources ({sources.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sources.map((s, i) => (
                    <button
                      key={s.id ?? `${s.name}-${i}`}
                      onClick={() => navigate(`/graph?search=${encodeURIComponent(s.name)}`)}
                      className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cortex-500/20 text-[10px] font-bold text-cortex-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-200">{s.name}</p>
                        <p className="text-xs text-zinc-500">{s.type}</p>
                        {s.summary && (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{s.summary}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up suggestions */}
            {!loading && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <Sparkles className="h-3 w-3" />
                  Follow-up
                </h3>
                <div className="flex flex-wrap gap-2">
                  {FOLLOW_UP_SUGGESTIONS.slice(0, 3).map((q) => (
                    <button
                      key={q}
                      onClick={() => askFollowUp(q)}
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!answer && !loading && !error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-zinc-500">
            <Network className="h-16 w-16 text-zinc-700" />
            <p className="text-sm">Ask anything about your knowledge graph</p>
            <div className="flex flex-wrap justify-center gap-2">
              {FOLLOW_UP_SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => askFollowUp(q)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-300"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History sidebar */}
      {showHistory && (
        <div className="w-72 shrink-0 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Query History
          </h3>
          {history.map((entry, i) => (
            <button
              key={`${entry.timestamp}-${i}`}
              onClick={() => loadFromHistory(entry)}
              className="w-full rounded-lg border border-zinc-800 p-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
            >
              <p className="truncate text-xs font-medium text-zinc-300">{entry.query}</p>
              <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{entry.answer}</p>
              <p className="mt-1 text-[10px] text-zinc-600">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
