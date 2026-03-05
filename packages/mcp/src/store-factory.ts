import { loadConfig } from '@cortex/core';
import { SQLiteStore, VectorStore, QueryEngine } from '@cortex/graph';

export interface StoreBundle {
  store: SQLiteStore;
  queryEngine: QueryEngine;
  cleanup: () => void;
}

export async function createStoreBundle(configDir?: string): Promise<StoreBundle> {
  const config = loadConfig({ configDir });

  const store = new SQLiteStore({
    dbPath: config.graph.dbPath,
    walMode: config.graph.walMode,
    backupOnStartup: false, // never backup on MCP startup — adds latency, not needed
  });

  const vectorStore = new VectorStore({
    dbPath: config.graph.vectorDbPath,
  });
  await vectorStore.initialize();

  const queryEngine = new QueryEngine(store, vectorStore, {
    maxContextTokens: config.llm.maxContextTokens,
    maxResultEntities: 10, // keep LLM context small for fast MCP responses
  });

  return {
    store,
    queryEngine,
    cleanup: () => store.close(),
  };
}
