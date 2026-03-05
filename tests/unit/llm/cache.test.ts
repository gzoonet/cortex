import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseCache } from '@cortex/llm';

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ maxEntries: 100, ttlMs: 60000 });
  });

  it('should store and retrieve values', () => {
    cache.set('hash1', 'prompt1', '1.0', 'cached response', 'haiku', 100, 50);
    const result = cache.get('hash1', 'prompt1', '1.0');
    expect(result).not.toBeNull();
    expect(result!.response).toBe('cached response');
  });

  it('should return null for cache miss', () => {
    const result = cache.get('nonexistent', 'prompt', '1.0');
    expect(result).toBeNull();
  });

  it('should differentiate by content hash', () => {
    cache.set('hash1', 'prompt1', '1.0', 'response A', 'haiku', 100, 50);
    cache.set('hash2', 'prompt1', '1.0', 'response B', 'haiku', 100, 50);

    expect(cache.get('hash1', 'prompt1', '1.0')!.response).toBe('response A');
    expect(cache.get('hash2', 'prompt1', '1.0')!.response).toBe('response B');
  });

  it('should differentiate by prompt id', () => {
    cache.set('hash1', 'promptA', '1.0', 'response A', 'haiku', 100, 50);
    cache.set('hash1', 'promptB', '1.0', 'response B', 'haiku', 100, 50);

    expect(cache.get('hash1', 'promptA', '1.0')!.response).toBe('response A');
    expect(cache.get('hash1', 'promptB', '1.0')!.response).toBe('response B');
  });

  it('should differentiate by prompt version', () => {
    cache.set('hash1', 'prompt1', '1.0', 'response V1', 'haiku', 100, 50);
    cache.set('hash1', 'prompt1', '2.0', 'response V2', 'haiku', 100, 50);

    expect(cache.get('hash1', 'prompt1', '1.0')!.response).toBe('response V1');
    expect(cache.get('hash1', 'prompt1', '2.0')!.response).toBe('response V2');
  });

  it('should evict expired entries', async () => {
    const shortCache = new ResponseCache({ maxEntries: 100, ttlMs: 50 });
    shortCache.set('hash1', 'prompt1', '1.0', 'cached', 'haiku', 100, 50);

    expect(shortCache.get('hash1', 'prompt1', '1.0')!.response).toBe('cached');

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(shortCache.get('hash1', 'prompt1', '1.0')).toBeNull();
  });

  it('should clear all entries', () => {
    cache.set('hash1', 'prompt1', '1.0', 'response 1', 'haiku', 100, 50);
    cache.set('hash2', 'prompt2', '1.0', 'response 2', 'haiku', 100, 50);

    cache.clear();

    expect(cache.get('hash1', 'prompt1', '1.0')).toBeNull();
    expect(cache.get('hash2', 'prompt2', '1.0')).toBeNull();
  });
});
