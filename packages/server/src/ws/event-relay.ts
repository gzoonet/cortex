import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { eventBus, createLogger } from '@cortex/core';

const logger = createLogger('server:ws');

const RELAYED_EVENTS = [
  'entity.created',
  'relationship.created',
  'file.ingested',
  'entity.merged',
  'contradiction.detected',
  'budget.warning',
  'budget.exhausted',
  'llm.request.start',
  'llm.request.complete',
];

export interface EventRelayHandle {
  wss: WebSocketServer;
  broadcast: (type: string, payload: unknown) => void;
  close: () => void;
}

export function createEventRelay(server: Server): EventRelayHandle {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const unsubscribers: Array<() => void> = [];

  wss.on('connection', (ws) => {
    logger.debug('WebSocket client connected');

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; channels?: string[] };
        // Future: handle subscribe/unsubscribe per-channel filtering
        // For now, all connected clients get all relayed events
        logger.debug('WebSocket message received', { type: msg.type });
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      logger.debug('WebSocket client disconnected');
    });
  });

  // Subscribe to EventBus events and relay to all connected WebSocket clients
  for (const eventType of RELAYED_EVENTS) {
    const unsub = eventBus.on(eventType, (event) => {
      const message = JSON.stringify({
        type: 'event',
        channel: eventType,
        event: {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp,
          source: event.source,
        },
      });

      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    });
    unsubscribers.push(unsub);
  }

  const broadcast = (type: string, payload: unknown) => {
    const message = JSON.stringify({ type: 'event', channel: type, event: { type, payload, timestamp: new Date().toISOString() } });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  };

  const close = () => {
    for (const unsub of unsubscribers) unsub();
    wss.close();
  };

  logger.info('Event relay initialized', { events: RELAYED_EVENTS.length });
  return { wss, broadcast, close };
}
