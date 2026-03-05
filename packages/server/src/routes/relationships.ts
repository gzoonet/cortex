import { Router } from 'express';
import type { ServerBundle } from '../index.js';

export function createRelationshipRoutes(bundle: ServerBundle): Router {
  const router = Router();
  const { store } = bundle;

  // GET /relationships — list/filter
  router.get('/', async (req, res) => {
    try {
      const { type, sourceId, targetId, limit = '100' } = req.query;

      if (sourceId && typeof sourceId === 'string') {
        const rels = await store.getRelationshipsForEntity(sourceId, 'out');
        const filtered = type ? rels.filter(r => r.type === type) : rels;
        res.json({ success: true, data: filtered.slice(0, Number(limit)) });
        return;
      }

      if (targetId && typeof targetId === 'string') {
        const rels = await store.getRelationshipsForEntity(targetId, 'in');
        const filtered = type ? rels.filter(r => r.type === type) : rels;
        res.json({ success: true, data: filtered.slice(0, Number(limit)) });
        return;
      }

      res.json({
        success: true,
        data: [],
        meta: { message: 'Provide sourceId or targetId to query relationships' },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
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
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
    }
  });

  return router;
}
