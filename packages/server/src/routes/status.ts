import { Router } from 'express';
import { createLogger } from '@cortex/core';
import type { ServerBundle } from '../index.js';
import { readFileSync } from 'node:fs';

const logger = createLogger('server:status');
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let _version = 'unknown';
try {
  let dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'));
      if (pkg.name === 'gzoo-cortex' && pkg.version) { _version = pkg.version; break; }
    } catch { /* not here */ }
    dir = resolve(dir, '..');
  }
} catch { /* ignore */ }

export function createStatusRoutes(bundle: ServerBundle): Router {
  const router = Router();
  const { store, router: llmRouter } = bundle;

  // GET /status
  router.get('/status', async (_req, res) => {
    try {
      const stats = await store.getStats();
      const available = await llmRouter.isAvailable();
      const mode = llmRouter.getMode();

      res.json({
        success: true,
        data: {
          version: _version,
          graph: {
            entityCount: stats.entityCount,
            relationshipCount: stats.relationshipCount,
            fileCount: stats.fileCount,
            projectCount: stats.projectCount,
            contradictionCount: stats.contradictionCount,
            dbSizeBytes: stats.dbSizeBytes,
          },
          llm: {
            mode,
            available,
          },
        },
      });
    } catch (err) {
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  // GET /graph — graph visualization data (nodes + edges)
  router.get('/graph', (req, res) => {
    try {
      const { project, limit = '2000' } = req.query;
      const data = store.getGraphData({
        projectId: project as string | undefined,
        limit: Number(limit),
      });
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  // GET /report
  router.get('/report', (_req, res) => {
    try {
      const data = store.getReportData();
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  return router;
}
