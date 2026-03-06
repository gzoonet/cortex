import { Router } from 'express';
import { createLogger } from '@cortex/core';
import type { ServerBundle } from '../index.js';

const logger = createLogger('server:projects');

export function createProjectRoutes(bundle: ServerBundle): Router {
  const router = Router();
  const { store } = bundle;

  // GET /projects
  router.get('/', async (_req, res) => {
    try {
      const projects = await store.listProjects();
      res.json({ success: true, data: projects });
    } catch (err) {
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  // GET /projects/:id
  router.get('/:id', async (req, res) => {
    try {
      const project = await store.getProject(req.params.id!);
      if (!project) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
        return;
      }
      res.json({ success: true, data: project });
    } catch (err) {
      logger.error('Request failed', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

  return router;
}
