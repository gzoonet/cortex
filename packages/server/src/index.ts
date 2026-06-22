import { readFileSync } from 'node:fs';
import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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
import { createAuthMiddleware, validateWsToken } from './middleware/auth.js';

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
  // Hydrate tracker with existing spend so budget enforcement works
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01T00:00:00.000Z';
  const summary = store.getTokenUsageSummary(currentMonth);
  router.getTracker().hydrateSpend(summary.totalCostUsd);

  // Persist token usage to SQLite so costs accumulate across sessions
  router.getTracker().setPersist((record) => {
    store.insertTokenUsage(record);
  });
  return { store, queryEngine, router };
}

export async function startServer(options: ServerOptions): Promise<void> {
  const { config, enableWatch = true } = options;
  const port = options.port ?? config.server?.port ?? 3710;
  const host = options.host ?? config.server?.host ?? '127.0.0.1';

  const bundle = createBundle(config);
  const app = express();
  const server = createServer(app);

  // First-run hint: projects registered but graph is empty
  try {
    const stats = await bundle.store.getStats();
    const projects = await bundle.store.listProjects();
    if (projects.length > 0 && stats.entityCount === 0 && stats.fileCount === 0) {
      logger.info(
        'Knowledge graph is empty but projects are registered. ' +
        'Run `cortex ingest <project>` to backfill existing files.',
      );
      console.log(
        '\n  Tip: Graph is empty. Run `cortex ingest` to backfill registered projects.\n',
      );
    }
  } catch {
    // Non-fatal — continue starting server
  }

  // Trust reverse proxy (nginx) — required for correct IP detection and rate limiting
  app.set('trust proxy', 1);

  // Middleware — CORS. Allow only the explicitly configured origins (e.g. the
  // Vite dev server). The dashboard is served same-origin with the API, so it
  // needs no CORS grant; reflecting arbitrary localhost:* origins would let any
  // local page read the user's private knowledge graph cross-origin (CWE-346/942).
  const corsOrigin = config.server?.cors ?? [];
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (curl, server-to-server, same-origin navigations)
      if (!origin) return callback(null, true);
      if (corsOrigin.includes(origin)) return callback(null, true);
      logger.warn('CORS rejected', { origin, allowed: corsOrigin });
      callback(new Error('CORS not allowed'));
    },
  }));
  app.use(express.json({ limit: '1mb' }));

  // Warn if non-localhost without auth
  const isLocal = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  if (!isLocal && !config.server.auth.enabled) {
    logger.warn(
      'Server bound to non-localhost without auth enabled. ' +
      'Set server.auth.enabled=true and server.auth.token in config, ' +
      'or set CORTEX_SERVER_AUTH_TOKEN env var.',
    );
  }

  // Simple in-memory rate limiter for LLM-backed endpoints
  const rateLimitWindow = 60_000; // 1 minute
  const rateLimitMax = 30; // max requests per window
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  // Periodically clean up expired rate limit entries to prevent memory leak
  const rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now >= entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 60_000);
  rateLimitCleanupInterval.unref(); // Don't keep process alive for cleanup

  const rateLimiter: express.RequestHandler = (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now >= entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + rateLimitWindow });
      return next();
    }
    entry.count++;
    if (entry.count > rateLimitMax) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
      });
      return;
    }
    next();
  };

  // API routes
  const api = express.Router();
  api.use(rateLimiter);
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
    app.use(express.static(webDist, { index: false }));

    const injectAuthToken = (html: string): string => {
      const token = config.server.auth.token;
      if (!config.server.auth.enabled || !token) return html;

      const tokenMeta = `<meta name="cortex-auth-token" content="${token}" />`;
      const tokenScript = `<script>window.__CORTEX_TOKEN__=${JSON.stringify(token)};</script>`;

      if (html.includes('</head>')) {
        return html.replace('</head>', `    ${tokenMeta}\n    ${tokenScript}\n  </head>`);
      }
      return `${tokenMeta}\n${tokenScript}\n${html}`;
    };

    // SPA fallback: serve index.html for all non-API routes.
    const spaLimiter = rateLimit({ windowMs: 60_000, max: 60 });
    app.get('*', spaLimiter, (req, res) => {
      const indexPath = resolve(webDist, 'index.html');
      const authActive = config.server.auth.enabled && !!config.server.auth.token;
      // Only embed the auth token for a requester that already proves possession
      // of it (Authorization: Bearer, or ?token=... on the initial document load).
      // Anonymous clients get the app shell WITHOUT the token, so the credential
      // is never disclosed to unauthenticated callers (CWE-312/CWE-522).
      if (authActive && validateWsToken(config, host, req.url, req.headers.authorization)) {
        res.type('html').send(injectAuthToken(readFileSync(indexPath, 'utf-8')));
      } else {
        res.sendFile(indexPath);
      }
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
              secretPatterns: config.privacy.secretPatterns,
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
    if (host === '127.0.0.1' || host === 'localhost') {
      console.log(`\n  Tip: To access remotely, use --host 0.0.0.0 (or put behind a reverse proxy)`);
    }
    console.log('');
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    clearInterval(rateLimitCleanupInterval);
    relay.close();
    server.close();
    bundle.store.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
