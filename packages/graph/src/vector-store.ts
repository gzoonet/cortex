import { connect, type Connection, type Table } from '@lancedb/lancedb';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { createLogger } from '@cortex/core';

const logger = createLogger('graph:vector-store');

function resolveHomePath(p: string): string {
  return p.startsWith('~') ? p.replace('~', homedir()) : p;
}

export interface VectorSearchResult {
  entityId: string;
  distance: number;
  text: string;
}

export interface VectorStoreOptions {
  dbPath?: string;
  dimensions?: number;
}

const TABLE_NAME = 'entity_embeddings';

export class VectorStore {
  private db: Connection | null = null;
  private table: Table | null = null;
  private dbPath: string;
  private dimensions: number;

  constructor(options: VectorStoreOptions = {}) {
    this.dbPath = resolveHomePath(options.dbPath ?? '~/.cortex/vector.lance');
    this.dimensions = options.dimensions ?? 384;
  }

  async initialize(): Promise<void> {
    mkdirSync(this.dbPath, { recursive: true });
    this.db = await connect(this.dbPath);

    try {
      this.table = await this.db.openTable(TABLE_NAME);
    } catch {
      // Table doesn't exist yet — will be created on first add
      logger.debug('Vector table does not exist yet, will create on first add');
    }
  }

  private async ensureTable(): Promise<Table> {
    if (this.table) return this.table;
    if (!this.db) throw new Error('VectorStore not initialized');

    // Create table with an initial record to establish schema
    this.table = await this.db.createTable(TABLE_NAME, [
      {
        id: '_init',
        entityId: '_init',
        vector: new Array(this.dimensions).fill(0) as number[],
        text: '',
      } as Record<string, unknown>,
    ]);

    // Remove the placeholder row
    await this.table.delete('id = "_init"');
    return this.table;
  }

  async addVectors(
    records: Array<{ entityId: string; vector: Float32Array; text: string }>,
  ): Promise<void> {
    if (records.length === 0) return;
    const table = await this.ensureTable();

    const rows = records.map((r) => ({
      id: r.entityId,
      entityId: r.entityId,
      vector: Array.from(r.vector),
      text: r.text,
    } as Record<string, unknown>));

    await table.add(rows);
    logger.debug(`Added ${rows.length} vectors`);
  }

  async search(
    queryVector: Float32Array,
    limit = 20,
  ): Promise<VectorSearchResult[]> {
    if (!this.table) return [];

    const results = await this.table
      .search(Array.from(queryVector))
      .limit(limit)
      .toArray();

    return results.map((r) => ({
      entityId: r.entityId as string,
      distance: r._distance as number,
      text: r.text as string,
    }));
  }

  async deleteByEntityId(entityId: string): Promise<void> {
    if (!this.table) return;
    await this.table.delete(`entityId = "${entityId}"`);
  }

  async count(): Promise<number> {
    if (!this.table) return 0;
    return await this.table.countRows();
  }
}
