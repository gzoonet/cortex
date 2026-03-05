import { Router } from 'express';
import type { Contradiction } from '@cortex/core';
import type { ServerBundle } from '../index.js';

export function createContradictionRoutes(bundle: ServerBundle): Router {
  const router = Router();
  const { store } = bundle;

  // GET /contradictions
  router.get('/', async (req, res) => {
    try {
      const { status, severity, limit = '50' } = req.query;
      const contradictions = await store.findContradictions({
        status: status as Contradiction['status'] | undefined,
        limit: Number(limit),
      });

      // Filter by severity client-side (store doesn't support severity filter)
      const filtered = severity
        ? contradictions.filter(c => c.severity === severity)
        : contradictions;

      // Enrich with entity names
      const enriched = await Promise.all(filtered.map(async c => {
        const entityA = await store.getEntity(c.entityIds[0]);
        const entityB = await store.getEntity(c.entityIds[1]);
        return {
          ...c,
          entityA: entityA ? { id: entityA.id, name: entityA.name, type: entityA.type, summary: entityA.summary } : null,
          entityB: entityB ? { id: entityB.id, name: entityB.name, type: entityB.type, summary: entityB.summary } : null,
        };
      }));

      res.json({ success: true, data: enriched, meta: { total: enriched.length } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
    }
  });

  // POST /contradictions/:id/resolve
  router.post('/:id/resolve', async (req, res) => {
    try {
      const { action } = req.body as { action: string };
      const validActions: Contradiction['resolvedAction'][] = ['supersede', 'dismiss', 'keep_old', 'both_valid'];

      if (!action || !validActions.includes(action as Contradiction['resolvedAction'])) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: `action must be one of: ${validActions.join(', ')}` },
        });
        return;
      }

      await store.updateContradiction(req.params.id!, {
        status: 'resolved',
        resolvedAction: action as Contradiction['resolvedAction'],
        resolvedAt: new Date().toISOString(),
      });

      res.json({ success: true, data: { id: req.params.id, status: 'resolved', action } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
    }
  });

  return router;
}
