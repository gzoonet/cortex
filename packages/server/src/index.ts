import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import cors from 'cors';
import { type CortexConfig, createLogger } from '@cortex/core';
import { SQLiteStore, QueryEngine, VectorStore } from '@cortex/graph';
import { Router as LLMRouter } from '@cortex/llm';
import { createEntityRoutes } from './routes/entities.js';
import { createRelationshipRoutes } from './routes/relationships.js';
import { createProjectRoutes } from './routes/projects.js';
import { createQueryRoutes } from './routes/query.js';
import { createContradictionRoutes } from './routes/contradictions.js';
import { createStatusRoutes } from './routes/status.js';
import { createEventRelay } from './ws/event-relay.js';
import { createAuthMiddleware } from './middleware/auth.js';

const logger = createLogger('server');

export interface ServerOptions {
  config: CortexConfig;
  port?: number;
  host?: string;
  enableWatch?: boolean;
  webDistPath?: string;
}

export interface ServerBundle {
  store: SQLiteStore;
  queryEngine: QueryEngine;
  router: LLMRouter;
}

function createBundle(config: CortexConfig): ServerBundle {
  const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });
  const vectorStore = new VectorStore();
  const queryEngine = new QueryEngine(store, vectorStore);
  const router = new LLMRouter({ config });
  return { store, queryEngine, router };
}

export async function startServer(options: ServerOptions): Promise<void> {
  const { config, enableWatch = true } = options;
  const port = options.port ?? config.server?.port ?? 3710;
  const host = options.host ?? config.server?.host ?? '127.0.0.1';

  const bundle = createBundle(config);
  const app = express();
  const server = createServer(app);

  // Middleware — CORS
  const corsOrigin = config.server?.cors ?? [];
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin) return callback(null, true);
      // Check explicit whitelist first
      if (corsOrigin.includes(origin)) return callback(null, true);
      // Allow any localhost/127.0.0.1 origin (any port)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error('CORS not allowed'));
    },
  }));
  app.use(express.json());

  // Warn if non-localhost without auth
  const isLocal = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  if (!isLocal && !config.server.auth.enabled) {
    logger.warn(
      'Server bound to non-localhost without auth enabled. ' +
      'Set server.auth.enabled=true and server.auth.token in config, ' +
      'or set CORTEX_SERVER_AUTH_TOKEN env var.',
    );
  }

  // API routes
  const api = express.Router();
  api.use(createAuthMiddleware({ config, host }));
  api.use('/entities', createEntityRoutes(bundle));
  api.use('/relationships', createRelationshipRoutes(bundle));
  api.use('/projects', createProjectRoutes(bundle));
  api.use('/query', createQueryRoutes(bundle));
  api.use('/contradictions', createContradictionRoutes(bundle));
  api.use('/', createStatusRoutes(bundle));
  app.use('/api/v1', api);

  // WebSocket event relay
  const relay = createEventRelay(server, config, host);
  logger.info('WebSocket relay attached', { path: '/ws' });

  // Serve static web dashboard if available
  if (options.webDistPath) {
    const webDist = resolve(options.webDistPath);
    app.use(express.static(webDist));
    // SPA fallback: serve index.html for all non-API routes
    app.get('*', (_req, res) => {
      res.sendFile(resolve(webDist, 'index.html'));
    });
    logger.info('Serving web dashboard', { path: webDist });
  }

  // Start file watcher if enabled
  if (enableWatch) {
    try {
      const { FileWatcher, IngestionPipeline } = await import('@cortex/ingest');
      const projects = await bundle.store.listProjects();

      if (projects.length > 0) {
        for (const project of projects) {
          const pipeline = new IngestionPipeline(
            bundle.router,
            bundle.store,
            {
              projectId: project.id,
              projectName: project.name,
              projectRoot: project.rootPath,
              maxFileSize: config.ingest.maxFileSize,
              batchSize: config.ingest.batchSize,
              projectPrivacyLevel: project.privacyLevel,
              mergeConfidenceThreshold: 0.85,
            },
          );

          const watcher = new FileWatcher({
            dirs: [project.rootPath],
            exclude: config.ingest.exclude,
            fileTypes: config.ingest.fileTypes,
            debounceMs: config.ingest.debounceMs,
            followSymlinks: config.ingest.followSymlinks,
            maxFileSize: config.ingest.maxFileSize,
            ignoreInitial: true, // Don't re-ingest existing files on server start
          });

          watcher.onFileChange(async (filePath, changeType) => {
            if (changeType === 'add' || changeType === 'change') {
              await pipeline.ingestFile(filePath);
            }
          });

          watcher.start();
          logger.info('Watching project', { name: project.name, path: project.rootPath });
        }
      } else {
        logger.warn('No projects registered — file watcher not started. Run `cortex init` first.');
      }
    } catch (err) {
      logger.warn('File watcher failed to start', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Start listening
  server.listen(port, host, () => {
    logger.info(`Cortex server running at http://${host}:${port}`);
    console.log(`\n  Cortex server running at http://${host}:${port}`);
    console.log(`  API:       http://${host}:${port}/api/v1`);
    console.log(`  WebSocket: ws://${host}:${port}/ws`);
    if (options.webDistPath) {
      console.log(`  Dashboard: http://${host}:${port}/`);
    }
    if (enableWatch) {
      console.log(`  Watcher:   active`);
    }
    console.log('');
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    relay.close();
    server.close();
    bundle.store.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
