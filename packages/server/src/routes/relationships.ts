import { Router } from 'express';
import { createLogger } from '@cortex/core';
import type { ServerBundle } from '../index.js';

const logger = createLogger('server:relationships');

export function createRelationshipRoutes(bundle: ServerBundle): Router {
  const router = Router();
  const { store } = bundle;

  // GET /relationships — list/filter
  router.get('/', async (req, res) => {
    try {
      const { type, sourceId, targetId, limit: rawLimit = '100' } = req.query;
      const parsedLimit = Math.max(1, Math.min(Number(rawLimit) || 100, 500));

      if (sourceId && typeof sourceId === 'string') {
        const rels = await store.getRelationshipsForEntity(sourceId, 'out');
        const filtered = type ? rels.filter(r => r.type === type) : rels;
        res.json({ success: true, data: filtered.slice(0, parsedLimit) });
        return;
      }

      if (targetId && typeof targetId === 'string') {
        const rels = await store.getRelationshipsForEntity(targetId, 'in');
        const filtered = type ? rels.filter(r => r.type === type) : rels;
        res.json({ success: true, data: filtered.slice(0, parsedLimit) });
        return;
      }

      res.json({
        success: true,
        data: [],
        meta: { message: 'Provide sourceId or targetId to query relationships' },
      });
    } catch (err) {
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  // GET /relationships/:id
  router.get('/:id', async (req, res) => {
    try {
      const rel = await store.getRelationship(req.params.id!);
      if (!rel) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Relationship not found' } });
        return;
      }
      res.json({ success: true, data: rel });
    } catch (err) {
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  return router;
}
