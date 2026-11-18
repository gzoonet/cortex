import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { getDefaultConfig, type CortexConfig } from '../../../packages/core/src/index.js';
import { createRequestGuard } from '../../../packages/server/src/middleware/request-guard.js';

function makeConfig(overrides: Partial<CortexConfig['server']> = {}): CortexConfig {
  const config = getDefaultConfig();
  config.server = { ...config.server, ...overrides };
  return config;
}

function wsInfo(origin: string, host: string | undefined): { origin: string; req: IncomingMessage } {
  return { origin, req: { headers: host ? { host } : {} } as IncomingMessage };
}

describe('request guard (unauthenticated localhost mode)', () => {
  const guard = createRequestGuard(makeConfig(), '127.0.0.1');

  it('is active when auth is not required', () => {
    expect(guard.active).toBe(true);
  });

  it('accepts loopback Host headers', () => {
    expect(guard.isAllowedHost('127.0.0.1:3710')).toBe(true);
    expect(guard.isAllowedHost('localhost:3710')).toBe(true);
    expect(guard.isAllowedHost('LOCALHOST')).toBe(true);
    expect(guard.isAllowedHost('[::1]:3710')).toBe(true);
  });

  it('rejects DNS-rebinding Host headers', () => {
    expect(guard.isAllowedHost('evil.example:3710')).toBe(false);
    expect(guard.isAllowedHost('127.0.0.1.evil.example')).toBe(false);
    expect(guard.isAllowedHost('localhost.evil.example:3710')).toBe(false);
    expect(guard.isAllowedHost(undefined)).toBe(false);
    expect(guard.isAllowedHost('')).toBe(false);
  });

  it('accepts hosts listed in server.allowedHosts', () => {
    const g = createRequestGuard(makeConfig({ allowedHosts: ['cortex.internal'] }), '127.0.0.1');
    expect(g.isAllowedHost('cortex.internal')).toBe(true);
    expect(g.isAllowedHost('cortex.internal:8443')).toBe(true);
  });

  it('allows same-origin, configured-CORS and non-browser WebSocket clients', () => {
    expect(guard.verifyWsClient(wsInfo('http://127.0.0.1:3710', '127.0.0.1:3710'))).toBe(true);
    expect(guard.verifyWsClient(wsInfo('http://localhost:5173', 'localhost:5173'))).toBe(true);
    expect(guard.verifyWsClient(wsInfo('', '127.0.0.1:3710'))).toBe(true);
  });

  it('rejects cross-site WebSocket handshakes', () => {
    expect(guard.verifyWsClient(wsInfo('https://evil.example', '127.0.0.1:3710'))).toBe(false);
    expect(guard.verifyWsClient(wsInfo('http://localhost:9999', '127.0.0.1:3710'))).toBe(false);
    expect(guard.verifyWsClient(wsInfo('null', '127.0.0.1:3710'))).toBe(false);
    // Rebinding: Origin matches Host, but the Host itself is not allowed.
    expect(guard.verifyWsClient(wsInfo('http://evil.example:3710', 'evil.example:3710'))).toBe(false);
  });
});

describe('request guard (auth required)', () => {
  it('defers to token auth when auth is enabled', () => {
    const g = createRequestGuard(makeConfig({ auth: { enabled: true, token: 't' } }), '127.0.0.1');
    expect(g.active).toBe(false);
    expect(g.isAllowedHost('proxy.example.com')).toBe(true);
  });

  it('defers to token auth when bound to a non-localhost address', () => {
    const g = createRequestGuard(makeConfig(), '0.0.0.0');
    expect(g.active).toBe(false);
    expect(g.verifyWsClient(wsInfo('https://cortex.example.com', 'cortex.example.com'))).toBe(true);
  });
});
