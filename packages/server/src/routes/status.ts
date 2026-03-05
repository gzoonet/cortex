import { Router } from 'express';
import type { ServerBundle } from '../index.js';

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
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
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
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
    }
  });

  // GET /report
  router.get('/report', (_req, res) => {
    try {
      const data = store.getReportData();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: String(err) } });
    }
  });

  return router;
}
