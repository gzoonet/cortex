import type { IncomingMessage } from 'node:http';
import type { Request, Response, NextFunction } from 'express';
import { type CortexConfig, createLogger } from '@cortex/core';
import { isAuthRequired } from './auth.js';

const logger = createLogger('server:guard');

const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Browser-facing protections for the unauthenticated (localhost, auth off) mode.
 *
 * Without a token, the only thing separating the knowledge graph from an
 * arbitrary web page is the browser's same-origin policy. Two gaps remain:
 *  - DNS rebinding: a hostile domain re-resolves to 127.0.0.1, so its pages
 *    become "same-origin" with this server. Checking the Host header closes it.
 *  - WebSockets are exempt from CORS, so any page can open ws://127.0.0.1/ws.
 *    Checking the Origin on the upgrade closes it.
 *
 * When auth is required, the bearer token already blocks both attacks, so the
 * guard stays out of the way of reverse-proxy setups that rewrite Host.
 */
export interface RequestGuard {
  /** True when the guard is enforcing (auth not required). */
  active: boolean;
  isAllowedHost: (hostHeader: string | undefined) => boolean;
  isAllowedWsOrigin: (origin: string | undefined, hostHeader: string | undefined) => boolean;
  httpMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  verifyWsClient: (info: { origin: string; req: IncomingMessage }) => boolean;
}

function hostnameOf(hostHeader: string): string | null {
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function createRequestGuard(config: CortexConfig, host: string): RequestGuard {
  const active = !isAuthRequired(config, host);
  const allowedHostnames = new Set(
    [...LOOPBACK_HOSTNAMES, ...(config.server.allowedHosts ?? [])].map((h) => h.toLowerCase()),
  );
  const allowedOrigins = new Set(config.server.cors ?? []);

  const isAllowedHost = (hostHeader: string | undefined): boolean => {
    if (!active) return true;
    if (!hostHeader) return false;
    const hostname = hostnameOf(hostHeader);
    return hostname !== null && allowedHostnames.has(hostname);
  };

  const isAllowedWsOrigin = (origin: string | undefined, hostHeader: string | undefined): boolean => {
    if (!active) return true;
    // Non-browser clients (CLI, scripts) send no Origin and cannot be driven by a web page.
    if (!origin) return true;
    if (allowedOrigins.has(origin)) return true;
    // Same-origin dashboard: Origin host must equal the (already validated) Host header.
    try {
      return !!hostHeader && new URL(origin).host.toLowerCase() === hostHeader.toLowerCase();
    } catch {
      return false;
    }
  };

  const httpMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (isAllowedHost(req.headers.host)) {
      next();
      return;
    }
    logger.warn('Rejected request with unexpected Host header', { host: req.headers.host });
    res.status(421).json({
      success: false,
      error: {
        code: 'SERVER_HOST_NOT_ALLOWED',
        message: 'Host not allowed. Add it to server.allowedHosts if this is expected.',
      },
    });
  };

  const verifyWsClient = (info: { origin: string; req: IncomingMessage }): boolean => {
    const hostHeader = info.req.headers.host;
    const ok = isAllowedHost(hostHeader) && isAllowedWsOrigin(info.origin || undefined, hostHeader);
    if (!ok) {
      logger.warn('Rejected WebSocket handshake', { origin: info.origin, host: hostHeader });
    }
    return ok;
  };

  return { active, isAllowedHost, isAllowedWsOrigin, httpMiddleware, verifyWsClient };
}
