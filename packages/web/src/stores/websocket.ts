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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

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
