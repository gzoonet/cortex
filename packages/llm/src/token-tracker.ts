import { createLogger, eventBus, type LLMTask, type TokenUsageRecord } from '@cortex/core';

const logger = createLogger('llm:token-tracker');

// Cost per million tokens (USD). Rates are cache-miss / standard list prices.
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0 },
  // DeepSeek V4 Flash (deepseek-chat / deepseek-reasoner aliases) — api-docs.deepseek.com
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.14, output: 0.28 },
  'deepseek-v4-flash': { input: 0.14, output: 0.28 },
  // Google Gemini (generativelanguage.googleapis.com pricing)
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'google/gemini-2.0-flash-001': { input: 0.10, output: 0.40 },
  'google/gemini-2.0-flash-lite-001': { input: 0.075, output: 0.30 },
  // Groq (groq.com/pricing)
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
};

/** Fallback when model is not in MODEL_COSTS (Anthropic Sonnet-class). */
const DEFAULT_COST = { input: 3.0, output: 15.0 };

/** Conservative default for openai-compatible providers without a known model rate. */
const OPENAI_COMPATIBLE_DEFAULT_COST = { input: 0.14, output: 0.28 };

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  provider?: string,
): number {
  const costs = MODEL_COSTS[model];
  if (!costs) {
    const fallback =
      provider === 'openai-compatible' ? OPENAI_COMPATIBLE_DEFAULT_COST : DEFAULT_COST;
    logger.warn('Unknown model for cost estimation — using fallback rates', {
      model,
      provider: provider ?? 'unknown',
      fallbackInputPerM: fallback.input,
      fallbackOutputPerM: fallback.output,
    });
    return (
      (inputTokens / 1_000_000) * fallback.input +
      (outputTokens / 1_000_000) * fallback.output
    );
  }

  return (
    (inputTokens / 1_000_000) * costs.input +
    (outputTokens / 1_000_000) * costs.output
  );
}

const MAX_IN_MEMORY_RECORDS = 10_000;

export type PersistFn = (record: TokenUsageRecord) => void;

export class TokenTracker {
  private records: TokenUsageRecord[] = [];
  private monthlyBudgetUsd: number;
  private warningThresholds: number[];
  private warningsFired: Set<number> = new Set();
  private persistFn?: PersistFn;
  private hydratedSpendUsd = 0;

  constructor(monthlyBudgetUsd = 25, warningThresholds = [0.5, 0.8, 0.9]) {
    this.monthlyBudgetUsd = monthlyBudgetUsd;
    this.warningThresholds = warningThresholds;
  }

  /** Set a callback to persist each record (e.g. to SQLite) */
  setPersist(fn: PersistFn): void {
    this.persistFn = fn;
  }

  /**
   * Hydrate tracker with spend already recorded in SQLite.
   * This ensures budget enforcement works across separate CLI processes.
   */
  hydrateSpend(currentMonthSpendUsd: number): void {
    this.hydratedSpendUsd = currentMonthSpendUsd;
    // Re-check budget thresholds with hydrated data
    this.checkBudget();
  }

  record(
    requestId: string,
    task: LLMTask,
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
  ): TokenUsageRecord {
    const costUsd = estimateCost(model, inputTokens, outputTokens, provider);

    const record: TokenUsageRecord = {
      id: crypto.randomUUID(),
      requestId,
      task,
      provider,
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: costUsd,
      latencyMs,
      timestamp: new Date().toISOString(),
    };

    this.records.push(record);
    this.trimOldRecords();
    this.checkBudget();

    if (this.persistFn) {
      try { this.persistFn(record); } catch { /* don't fail on persist errors */ }
    }

    return record;
  }

  private trimOldRecords(): void {
    if (this.records.length <= MAX_IN_MEMORY_RECORDS) return;

    // Keep all current-month records; drop oldest records from prior months
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthRecords = this.records.filter((r) => r.timestamp.startsWith(currentMonth));
    const priorRecords = this.records.filter((r) => !r.timestamp.startsWith(currentMonth));

    if (currentMonthRecords.length >= MAX_IN_MEMORY_RECORDS) {
      // Even current month alone exceeds cap — keep only the most recent records
      this.records = currentMonthRecords.slice(-MAX_IN_MEMORY_RECORDS);
    } else {
      // Keep all current month + most recent prior month records to fill cap
      const keepFromPrior = MAX_IN_MEMORY_RECORDS - currentMonthRecords.length;
      this.records = [...priorRecords.slice(-keepFromPrior), ...currentMonthRecords];
    }
  }

  private checkBudget(): void {
    const spent = this.getCurrentMonthSpend();
    const usedPercent = this.monthlyBudgetUsd > 0 ? spent / this.monthlyBudgetUsd : 0;
    const ts = new Date().toISOString();

    for (const threshold of this.warningThresholds) {
      if (usedPercent >= threshold && !this.warningsFired.has(threshold)) {
        this.warningsFired.add(threshold);
        const remaining = this.monthlyBudgetUsd - spent;
        logger.warn(`Budget warning: ${(usedPercent * 100).toFixed(1)}% used`, {
          spent,
          budget: this.monthlyBudgetUsd,
          remaining,
        });
        eventBus.emit({
          type: 'budget.warning',
          payload: { usedPercent: Math.round(usedPercent * 100), remainingUsd: remaining },
          timestamp: ts,
          source: 'llm:token-tracker',
        });
      }
    }

    // Emit exhausted event once when budget is fully consumed
    if (this.monthlyBudgetUsd > 0 && usedPercent >= 1.0 && !this.warningsFired.has(1.0)) {
      this.warningsFired.add(1.0);
      logger.warn('Budget exhausted', { spent, budget: this.monthlyBudgetUsd });
      eventBus.emit({
        type: 'budget.exhausted',
        payload: { totalSpentUsd: spent },
        timestamp: ts,
        source: 'llm:token-tracker',
      });
    }
  }

  getCurrentMonthSpend(): number {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const inMemorySpend = this.records
      .filter((r) => r.timestamp.startsWith(currentMonth))
      .reduce((sum, r) => sum + r.estimatedCostUsd, 0);
    // hydratedSpendUsd covers spend from previous processes (read from SQLite)
    // inMemorySpend covers spend from this process (may overlap if persist wrote them)
    // Use max to avoid double-counting while still catching both sources
    return Math.max(this.hydratedSpendUsd, 0) + inMemorySpend;
  }

  isBudgetExhausted(): boolean {
    return this.getCurrentMonthSpend() >= this.monthlyBudgetUsd;
  }

  getBudgetRemaining(): number {
    return Math.max(0, this.monthlyBudgetUsd - this.getCurrentMonthSpend());
  }

  getRecords(): TokenUsageRecord[] {
    return [...this.records];
  }

  getSummary(): {
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
    costByTask: Record<string, number>;
    costByProvider: Record<string, number>;
  } {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthRecords = this.records.filter((r) => r.timestamp.startsWith(currentMonth));

    const costByTask: Record<string, number> = {};
    const costByProvider: Record<string, number> = {};
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;

    for (const r of monthRecords) {
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;
      totalCost += r.estimatedCostUsd;
      costByTask[r.task] = (costByTask[r.task] ?? 0) + r.estimatedCostUsd;
      costByProvider[r.provider] = (costByProvider[r.provider] ?? 0) + r.estimatedCostUsd;
    }

    return {
      totalCostUsd: totalCost,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      requestCount: monthRecords.length,
      costByTask,
      costByProvider,
    };
  }
}
