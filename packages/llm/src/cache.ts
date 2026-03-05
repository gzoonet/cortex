import { createHash } from 'node:crypto';
import { createLogger } from '@cortex/core';

const logger = createLogger('llm:cache');

interface CacheEntry {
  response: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: number;
}

export interface ResponseCacheOptions {
  enabled?: boolean;
  ttlMs?: number;
  maxEntries?: number;
}

export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private enabled: boolean;
  private ttlMs: number;
  private maxEntries: number;

  constructor(options: ResponseCacheOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.ttlMs = options.ttlMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  private buildKey(contentHash: string, promptId: string, promptVersion: string): string {
    return createHash('sha256')
      .update(`${contentHash}:${promptId}:${promptVersion}`)
      .digest('hex');
  }

  get(
    contentHash: string,
    promptId: string,
    promptVersion: string,
  ): CacheEntry | null {
    if (!this.enabled) return null;

    const key = this.buildKey(contentHash, promptId, promptVersion);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    logger.debug('Cache hit', { promptId, promptVersion });
    return entry;
  }

  set(
    contentHash: string,
    promptId: string,
    promptVersion: string,
    response: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): void {
    if (!this.enabled) return;

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldest = [...this.cache.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }

    const key = this.buildKey(contentHash, promptId, promptVersion);
    this.cache.set(key, {
      response,
      model,
      inputTokens,
      outputTokens,
      createdAt: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
