import { describe, it, expect, beforeEach } from 'vitest';
import { TokenTracker, estimateCost } from '@cortex/llm';
import { LLMTask } from '@cortex/core';

describe('estimateCost', () => {
  it('should calculate cost for Sonnet model', () => {
    // Sonnet: $3/M input, $15/M output
    const cost = estimateCost('claude-sonnet-4-5-20250929', 1000, 500);
    // (1000/1M) * 3 + (500/1M) * 15 = 0.003 + 0.0075 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 4);
  });

  it('should calculate cost for Haiku model', () => {
    // Haiku: $0.80/M input, $4/M output
    const cost = estimateCost('claude-haiku-4-5-20251001', 1000, 500);
    // (1000/1M) * 0.80 + (500/1M) * 4 = 0.0008 + 0.002 = 0.0028
    expect(cost).toBeCloseTo(0.0028, 4);
  });

  it('should use default costs for unknown models', () => {
    const cost = estimateCost('unknown-model', 1000, 500);
    // Default: $3/M input, $15/M output (same as Sonnet)
    expect(cost).toBeCloseTo(0.0105, 4);
  });
});

describe('TokenTracker', () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker(25, [0.5, 0.8, 0.9]);
  });

  it('should record token usage', () => {
    tracker.record(
      'req-1',
      LLMTask.ENTITY_EXTRACTION,
      'anthropic',
      'claude-haiku-4-5-20251001',
      1000,
      500,
      200,
    );

    const records = tracker.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0]!.task).toBe(LLMTask.ENTITY_EXTRACTION);
    expect(records[0]!.inputTokens).toBe(1000);
    expect(records[0]!.outputTokens).toBe(500);
    expect(records[0]!.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('should track current month spend', () => {
    tracker.record(
      'req-1',
      LLMTask.ENTITY_EXTRACTION,
      'anthropic',
      'claude-haiku-4-5-20251001',
      1000,
      500,
      200,
    );

    const spend = tracker.getCurrentMonthSpend();
    expect(spend).toBeGreaterThan(0);
  });

  it('should detect budget exhaustion', () => {
    // With $25 budget and Haiku costs, we need lots of tokens
    // Haiku: $0.80/M input, $4/M output
    // To reach $25: ~6M output tokens
    expect(tracker.isBudgetExhausted()).toBe(false);

    // Record enough to exhaust budget
    for (let i = 0; i < 100; i++) {
      tracker.record(
        `req-${i}`,
        LLMTask.ENTITY_EXTRACTION,
        'anthropic',
        'claude-sonnet-4-5-20250929',
        100000,
        100000,
        200,
      );
    }

    expect(tracker.isBudgetExhausted()).toBe(true);
    expect(tracker.getBudgetRemaining()).toBe(0);
  });

  it('should generate summary', () => {
    tracker.record('req-1', LLMTask.ENTITY_EXTRACTION, 'anthropic', 'claude-haiku-4-5-20251001', 1000, 500, 200);
    tracker.record('req-2', LLMTask.CONVERSATIONAL_QUERY, 'anthropic', 'claude-sonnet-4-5-20250929', 2000, 1000, 300);

    const summary = tracker.getSummary();
    expect(summary.requestCount).toBe(2);
    expect(summary.totalInputTokens).toBe(3000);
    expect(summary.totalOutputTokens).toBe(1500);
    expect(summary.costByTask[LLMTask.ENTITY_EXTRACTION]).toBeGreaterThan(0);
    expect(summary.costByTask[LLMTask.CONVERSATIONAL_QUERY]).toBeGreaterThan(0);
    expect(summary.costByProvider['anthropic']).toBeGreaterThan(0);
  });
});
