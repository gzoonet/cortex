import { Router } from 'express';
import type { EntityType } from '@cortex/core';
import type { ServerBundle } from '../index.js';

export function createEntityRoutes(bundle: ServerBundle): Router {
  const router = Router();
  const { store } = bundle;

  // GET /entities — search/list
  router.get('/', async (req, res) => {
    try {
      const { type, project, search, limit = '50', offset = '0', status = 'active' } = req.query;

      if (search && typeof search === 'string') {
        const results = await store.searchEntities(search, Number(limit));
        res.json({ success: true, data: results, meta: { total: results.length, limit: Number(limit), offset: 0 } });
        return;
      }

      const entities = await store.findEntities({
        type: type as EntityType | undefined,
        projectId: project as string | undefined,
        status: status as string | undefined,
        limit: Number(limit),
        offset: Number(offset),
      });

      res.json({ success: true, data: entities, meta: { limit: Number(limit), offset: Number(offset) } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
    }
  });

  // GET /entities/:id
  router.get('/:id', async (req, res) => {
    try {
      const entity = await store.getEntity(req.params.id!);
      if (!entity) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Entity not found' } });
        return;
      }
      res.json({ success: true, data: entity });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
    }
  });

  // GET /entities/:id/relationships
  router.get('/:id/relationships', async (req, res) => {
    try {
      const { direction = 'both' } = req.query;
      const relationships = await store.getRelationshipsForEntity(
        req.params.id!,
        direction as 'in' | 'out' | 'both',
      );
      res.json({ success: true, data: relationships });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
    }
  });

  return router;
}
