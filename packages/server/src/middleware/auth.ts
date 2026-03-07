import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { type CortexConfig, createLogger } from '@cortex/core';

const logger = createLogger('server:auth');

const LOCALHOST_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function isLocalhost(host: string): boolean {
  return LOCALHOST_HOSTS.has(host);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface AuthMiddlewareOptions {
  config: CortexConfig;
  host: string;
}

export function createAuthMiddleware(
  options: AuthMiddlewareOptions,
): (req: Request, res: Response, next: NextFunction) => void {
  const { config, host } = options;
  const authEnabled = config.server.auth.enabled;
  const token = config.server.auth.token;
  const isLocal = isLocalhost(host);

  // Auth required if explicitly enabled OR if binding to non-localhost
  const authRequired = authEnabled || !isLocal;

  if (!authRequired) {
    return (_req, _res, next) => next();
  }

  if (!token) {
    logger.error('Auth is required but no token configured. All API requests will be rejected.');
    return (_req, res, _next) => {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_AUTH_REQUIRED',
          message: 'Server authentication is required but no token is configured.',
        },
      });
    };
  }

  logger.info('API authentication enabled');

  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: 'SERVER_AUTH_REQUIRED',
          message: 'Authentication required. Provide an Authorization: Bearer <token> header.',
        },
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'SERVER_AUTH_INVALID',
          message: 'Invalid authorization format. Expected: Bearer <token>',
        },
      });
      return;
    }

    const provided = authHeader.slice(7);

    if (!safeEqual(provided, token)) {
      res.status(401).json({
        success: false,
        error: {
          code: 'SERVER_AUTH_INVALID',
          message: 'Invalid authentication token.',
        },
      });
      return;
    }

    next();
  };
}

// NOTE: WebSocket auth uses query string token (?token=...) because the WebSocket
// protocol does not support custom headers during the upgrade handshake. This means
// the token may appear in server access logs and proxy logs. For production use on
// non-localhost, consider additional network-level protections (TLS, firewall rules).
export function validateWsToken(config: CortexConfig, host: string, url: string | undefined): boolean {
  const authEnabled = config.server.auth.enabled;
  const token = config.server.auth.token;
  const isLocal = isLocalhost(host);
  const authRequired = authEnabled || !isLocal;

  if (!authRequired) return true;
  if (!token) return false;

  try {
    const params = new URL(url ?? '', 'http://localhost').searchParams;
    const provided = params.get('token');
    if (!provided) return false;
    return safeEqual(provided, token);
  } catch {
    return false;
  }
}
