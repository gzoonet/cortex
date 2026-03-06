import { Router } from 'express';
import type { EntityType } from '@cortex/core';
import { createLogger } from '@cortex/core';
import type { ServerBundle } from '../index.js';

const logger = createLogger('server:entities');

export function createEntityRoutes(bundle: ServerBundle): Router {
  const router = Router();
  const { store } = bundle;

  // GET /entities — search/list
  router.get('/', async (req, res) => {
    try {
      const { type, project, search, limit: rawLimit = '50', offset: rawOffset = '0', status = 'active' } = req.query;
      const parsedLimit = Math.max(1, Math.min(Number(rawLimit) || 50, 500));
      const parsedOffset = Math.max(0, Number(rawOffset) || 0);

      if (search && typeof search === 'string') {
        const results = await store.searchEntities(search, parsedLimit);
        res.json({ success: true, data: results, meta: { total: results.length, limit: parsedLimit, offset: 0 } });
        return;
      }

      const entities = await store.findEntities({
        type: type as EntityType | undefined,
        projectId: project as string | undefined,
        status: status as string | undefined,
        limit: parsedLimit,
        offset: parsedOffset,
      });

      res.json({ success: true, data: entities, meta: { limit: parsedLimit, offset: parsedOffset } });
    } catch (err) {
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
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
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
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
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  return router;
}
