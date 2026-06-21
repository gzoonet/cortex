import { describe, it, expect } from 'vitest';
import { getDefaultConfig } from '@cortex/core';
import { compileSecretPattern, compileSecretPatterns } from '@cortex/ingest';

describe('compileSecretPattern', () => {
  it('should compile default schema patterns with case-insensitive matching', () => {
    const patterns = getDefaultConfig().privacy.secretPatterns;
    const compiled = compileSecretPatterns(patterns);
    expect(compiled.length).toBe(patterns.length);

    const text = 'API_KEY=abcdefghijklmnopqrstuvwxyz';
    expect(compiled[0]!.test(text)).toBe(true);
    compiled[0]!.lastIndex = 0;
    expect(compiled[0]!.test('api_key=abcdefghijklmnopqrstuvwxyz')).toBe(true);
  });

  it('should support legacy (?i) prefix from older configs', () => {
    const re = compileSecretPattern('(?i)password\\s*[:=]\\s*\\S{8,}');
    expect(re).not.toBeNull();
    expect(re!.test('PASSWORD=secret12345')).toBe(true);
  });

  it('should return null for invalid patterns', () => {
    expect(compileSecretPattern('[')).toBeNull();
  });
});
