import { createLogger, eventBus, type LLMTask, type TokenUsageRecord } from '@cortex/core';

const logger = createLogger('llm:token-tracker');

// Cost per million tokens (USD) for Anthropic models
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0 },
};

const DEFAULT_COST = { input: 3.0, output: 15.0 };

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const costs = MODEL_COSTS[model] ?? DEFAULT_COST;
  return (
    (inputTokens / 1_000_000) * costs.input +
    (outputTokens / 1_000_000) * costs.output
  );
}

export class TokenTracker {
  private records: TokenUsageRecord[] = [];
  private monthlyBudgetUsd: number;
  private warningThresholds: number[];
  private warningsFired: Set<number> = new Set();

  constructor(monthlyBudgetUsd = 25, warningThresholds = [0.5, 0.8, 0.9]) {
    this.monthlyBudgetUsd = monthlyBudgetUsd;
    this.warningThresholds = warningThresholds;
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
    const costUsd = estimateCost(model, inputTokens, outputTokens);

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
    this.checkBudget();

    return record;
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
    return this.records
      .filter((r) => r.timestamp.startsWith(currentMonth))
      .reduce((sum, r) => sum + r.estimatedCostUsd, 0);
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
