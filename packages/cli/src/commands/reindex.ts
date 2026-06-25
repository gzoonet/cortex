import { Command } from 'commander';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { loadConfig, createLogger } from '@cortex/core';
import { SQLiteStore, VectorStore, entityEmbeddingText } from '@cortex/graph';
import { Router } from '@cortex/llm';
import { wireTokenPersistence } from '../index.js';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:reindex');

interface ReindexOpts {
  project?: string;
  yes: boolean;
  batch: string;
}

export function registerReindexCommand(program: Command): void {
  program
    .command('reindex [project]')
    .description('Rebuild the semantic (embedding) search index for already-ingested entities')
    .option('--project <name>', 'Only reindex a specific project (same as the positional argument)')
    .option('--yes', 'Skip the confirmation prompt', false)
    .option('--batch <n>', 'Embedding batch size', '32')
    .action(async (projectArg: string | undefined, opts: ReindexOpts) => {
      const globals = program.opts<GlobalOptions>();
      await runReindex(projectArg, opts, globals);
    });
}

async function runReindex(
  projectArg: string | undefined,
  opts: ReindexOpts,
  globals: GlobalOptions,
): Promise<void> {
  const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });

  const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });
  const router = new Router({ config });
  wireTokenPersistence(router, store);

  if (!router.hasEmbeddings()) {
    console.error(chalk.red('Semantic search is not enabled — no embedding provider configured.'));
    console.log(chalk.dim('Enable a cloud embeddings provider, e.g. OpenAI:'));
    console.log(chalk.dim('  cortex config set llm.embeddings.enabled true'));
    console.log(chalk.dim('  cortex config set llm.embeddings.baseUrl https://api.openai.com/v1'));
    console.log(chalk.dim('  cortex config set llm.embeddings.model text-embedding-3-small'));
    console.log(chalk.dim('  cortex config set llm.embeddings.apiKeySource env:OPENAI_API_KEY'));
    console.log(chalk.dim('  # then add OPENAI_API_KEY=... to ~/.cortex/.env'));
    store.close();
    process.exit(1);
  }

  // Resolve optional project filter (positional arg takes precedence over --project)
  const name = projectArg ?? opts.project;
  let projectId: string | undefined;
  let projectLabel = 'all projects';
  if (name) {
    const projects = await store.listProjects();
    const proj = projects.find((p) => p.name === name);
    if (!proj) {
      console.error(chalk.red(`Project "${name}" is not registered.`));
      console.log(chalk.dim('See registered projects with: cortex projects list'));
      store.close();
      process.exit(1);
    }
    projectId = proj.id;
    projectLabel = proj.name;
  }

  const dimensions = router.embeddingDimensions();
  const vectorStore = new VectorStore({ dbPath: config.graph.vectorDbPath, dimensions });
  await vectorStore.initialize();

  const entities = await store.findEntities(
    projectId ? { projectId, limit: 1_000_000 } : { limit: 1_000_000 },
  );

  if (entities.length === 0) {
    console.log(chalk.yellow('No entities to index. Ingest some files first with `cortex ingest` or `cortex serve`.'));
    store.close();
    return;
  }

  const model = config.llm.embeddings?.model ?? 'embedding model';
  if (!opts.yes && !globals.json && process.stdin.isTTY) {
    console.log(
      `About to (re)embed ${chalk.bold(entities.length)} entities for ${chalk.bold(projectLabel)} via ${chalk.bold(model)}.`,
    );
    process.stdout.write(chalk.bold('Proceed? [y/N] '));
    const answer = await new Promise<string>((res) => {
      process.stdin.setEncoding('utf-8');
      process.stdin.once('data', (d) => res(d.toString().trim().toLowerCase()));
      setTimeout(() => res(''), 30_000);
    });
    if (answer !== 'y' && answer !== 'yes') {
      console.log(chalk.dim('Aborted.'));
      store.close();
      process.exit(0);
    }
  }

  // Clear existing vectors for a clean rebuild (scoped to the project, or all).
  if (projectId) {
    for (const e of entities) await vectorStore.deleteByEntityId(e.id);
  } else {
    await vectorStore.clear();
  }

  const batchSize = Math.max(1, Number.parseInt(opts.batch, 10) || 32);
  let done = 0;
  let failed = 0;

  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    const texts = batch.map((e) => entityEmbeddingText(e));
    try {
      const vectors = await router.embed(texts);
      await vectorStore.addVectors(
        batch.map((e, j) => ({ entityId: e.id, vector: vectors[j]!, text: texts[j]! })),
      );
      done += batch.length;
    } catch (err) {
      failed += batch.length;
      logger.warn('reindex batch failed', {
        at: i,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (!globals.quiet && !globals.json) {
      process.stdout.write(`\r  embedded ${done}/${entities.length}${failed ? ` (${failed} failed)` : ''}   `);
    }
  }
  if (!globals.quiet && !globals.json) process.stdout.write('\n');

  const total = await vectorStore.count();
  if (globals.json) {
    console.log(JSON.stringify({ reindexed: done, failed, vectorRows: total, project: projectLabel }));
  } else {
    console.log(
      chalk.green(`Reindexed ${done} entities`) +
        chalk.dim(` — ${total} vectors total${failed ? `, ${failed} failed` : ''}`),
    );
  }

  store.close();
  process.exit(failed > 0 ? 1 : 0);
}
