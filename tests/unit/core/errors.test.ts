import { describe, it, expect } from 'vitest';
import {
  CortexError,
  INGEST_PARSE_FAILED,
  LLM_PROVIDER_UNAVAILABLE,
  LLM_BUDGET_EXHAUSTED,
  GRAPH_DB_ERROR,
  GRAPH_ENTITY_NOT_FOUND,
  CONFIG_INVALID,
  PRIVACY_VIOLATION,
} from '@cortex/core';

describe('CortexError', () => {
  it('should construct with all fields', () => {
    const error = new CortexError(
      INGEST_PARSE_FAILED,
      'medium',
      'ingest',
      'Failed to parse file',
      { filePath: '/test.md' },
      'Check file encoding',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CortexError);
    expect(error.code).toBe('INGEST_PARSE_FAILED');
    expect(error.severity).toBe('medium');
    expect(error.layer).toBe('ingest');
    expect(error.message).toBe('Failed to parse file');
    expect(error.context).toEqual({ filePath: '/test.md' });
    expect(error.recoveryAction).toBe('Check file encoding');
  });

  it('should have correct error codes', () => {
    expect(INGEST_PARSE_FAILED).toBe('INGEST_PARSE_FAILED');
    expect(LLM_PROVIDER_UNAVAILABLE).toBe('LLM_PROVIDER_UNAVAILABLE');
    expect(LLM_BUDGET_EXHAUSTED).toBe('LLM_BUDGET_EXHAUSTED');
    expect(GRAPH_DB_ERROR).toBe('GRAPH_DB_ERROR');
    expect(GRAPH_ENTITY_NOT_FOUND).toBe('GRAPH_ENTITY_NOT_FOUND');
    expect(CONFIG_INVALID).toBe('CONFIG_INVALID');
    expect(PRIVACY_VIOLATION).toBe('PRIVACY_VIOLATION');
  });

  it('should be catchable as Error', () => {
    const error = new CortexError(
      GRAPH_DB_ERROR,
      'critical',
      'graph',
      'Database corruption',
    );

    try {
      throw error;
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(CortexError);
      expect((e as CortexError).code).toBe('GRAPH_DB_ERROR');
    }
  });

  it('should include name in string representation', () => {
    const error = new CortexError(
      LLM_PROVIDER_UNAVAILABLE,
      'high',
      'llm',
      'Provider down',
    );

    expect(error.name).toBe('CortexError');
  });
});
