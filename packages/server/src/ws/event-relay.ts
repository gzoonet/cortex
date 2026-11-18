import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { type CortexConfig, eventBus, createLogger } from '@cortex/core';
import { validateWsToken } from '../middleware/auth.js';
import { createRequestGuard } from '../middleware/request-guard.js';

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

export function createEventRelay(server: Server, config?: CortexConfig, host?: string): EventRelayHandle {
  const guard = config && host ? createRequestGuard(config, host) : undefined;
  // Reject bad handshakes before the upgrade completes: cross-site origins (WebSockets
  // bypass CORS) with 403, missing/invalid tokens with 401. The connection-level token
  // check below stays as a second line of defense.
  const verifyClient = config && host && guard
    ? (
        info: { origin: string; req: IncomingMessage },
        done: (ok: boolean, code?: number, message?: string) => void,
      ): void => {
        if (!guard.verifyWsClient(info)) return done(false, 403, 'Forbidden');
        if (!validateWsToken(config, host, info.req.url, info.req.headers.authorization)) {
          logger.warn('WebSocket handshake rejected: invalid or missing token');
          return done(false, 401, 'Unauthorized');
        }
        done(true);
      }
    : undefined;
  const wss = new WebSocketServer({ server, path: '/ws', verifyClient });
  const unsubscribers: Array<() => void> = [];

  wss.on('connection', (ws, req) => {
    if (config && host && !validateWsToken(config, host, req.url, req.headers.authorization)) {
      ws.close(4401, 'Authentication required');
      logger.warn('WebSocket connection rejected — invalid or missing token');
      return;
    }

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
      // Strip sensitive fields from LLM events before broadcasting
      let payload = event.payload;
      if (eventType === 'llm.request.complete' && payload && typeof payload === 'object') {
        const { usage, ...safe } = payload as Record<string, unknown>;
        payload = safe;
      }

      const message = JSON.stringify({
        type: 'event',
        channel: eventType,
        event: {
          type: event.type,
          payload,
          timestamp: event.timestamp,
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
