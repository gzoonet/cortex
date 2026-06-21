import { createLogger } from '@cortex/core';

const logger = createLogger('ingest:secret-patterns');

/**
 * Compile a secret-detection regex from config.
 * Supports legacy PCRE-style (?i) prefix; always uses case-insensitive matching.
 */
export function compileSecretPattern(pattern: string): RegExp | null {
  try {
    let source = pattern;
    let flags = 'gi';

    if (source.startsWith('(?i)')) {
      source = source.slice(4);
      flags = 'gi';
    }

    return new RegExp(source, flags);
  } catch {
    logger.warn('Invalid secret pattern, skipping', { pattern });
    return null;
  }
}

export function compileSecretPatterns(patterns: string[]): RegExp[] {
  return patterns
    .map((pattern) => compileSecretPattern(pattern))
    .filter((re): re is RegExp => re !== null);
}
