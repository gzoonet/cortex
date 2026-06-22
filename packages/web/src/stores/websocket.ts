import { create } from 'zustand';

export interface WsEvent {
  type: string;
  channel: string;
  payload: Record<string, unknown>;
  timestamp: string;
  source?: string;
}

interface WebSocketState {
  connected: boolean;
  events: WsEvent[];
  maxEvents: number;
  /** Cumulative counters since connect */
  counters: {
    entities: number;
    relationships: number;
    files: number;
    contradictions: number;
  };
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
  setInitialCounters: (c: WebSocketState["counters"]) => void;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const TOKEN_STORAGE_KEY = 'cortex-auth-token';

function getAuthToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  // Mirror api.ts: prefer the server-injected token (authenticated load) and
  // persist it per-tab so refreshes/reconnects keep working; fall back to the
  // stored value. Anonymous loads receive no token from the server.
  const win = window as typeof window & { __CORTEX_TOKEN__?: string };
  const injected =
    win.__CORTEX_TOKEN__ ??
    document.querySelector('meta[name="cortex-auth-token"]')?.getAttribute('content') ??
    undefined;
  if (injected) {
    try { sessionStorage.setItem(TOKEN_STORAGE_KEY, injected); } catch { /* storage unavailable */ }
    return injected;
  }

  try { return sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? undefined; } catch { return undefined; }
}

function buildWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = `${protocol}//${window.location.host}/ws`;
  const token = getAuthToken();
  if (!token) return base;
  return `${base}?token=${encodeURIComponent(token)}`;
}

const COUNTER_CHANNELS: Record<string, keyof WebSocketState['counters']> = {
  'entity.created': 'entities',
  'relationship.created': 'relationships',
  'file.ingested': 'files',
  'contradiction.detected': 'contradictions',
};

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  connected: false,
  events: [],
  maxEvents: 200,
  counters: { entities: 0, relationships: 0, files: 0, contradictions: 0 },

  connect: () => {
    if (ws && ws.readyState <= WebSocket.OPEN) return;

    const url = buildWsUrl();

    ws = new WebSocket(url);

    ws.onopen = () => {
      set({ connected: true });
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (msg) => {
      try {
        const raw = JSON.parse(msg.data as string) as {
          type: string;
          channel: string;
          event: { type: string; payload: Record<string, unknown>; timestamp: string; source?: string };
        };

        if (raw.type !== 'event' || !raw.event) return;

        const event: WsEvent = {
          type: raw.event.type,
          channel: raw.channel,
          payload: raw.event.payload ?? {},
          timestamp: raw.event.timestamp ?? new Date().toISOString(),
          source: raw.event.source,
        };

        set((state) => {
          const counterKey = COUNTER_CHANNELS[raw.channel];
          const counters = counterKey
            ? { ...state.counters, [counterKey]: state.counters[counterKey] + 1 }
            : state.counters;

          return {
            events: [event, ...state.events].slice(0, state.maxEvents),
            counters,
          };
        });
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      set({ connected: false });
      ws = null;
      reconnectTimer = setTimeout(() => get().connect(), 3000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  },

  disconnect: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    ws?.close();
    ws = null;
    set({ connected: false });
  },

  clearEvents: () => {
    set({ events: [], counters: { entities: 0, relationships: 0, files: 0, contradictions: 0 } });
  },

  setInitialCounters: (c) => {
    set({ counters: c });
  },
}));
