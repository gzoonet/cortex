export enum LLMTask {
  ENTITY_EXTRACTION = 'entity_extraction',
  RELATIONSHIP_INFERENCE = 'relationship_inference',
  EMBEDDING_GENERATION = 'embedding_generation',
  CONVERSATIONAL_QUERY = 'conversational_query',
  CONTRADICTION_DETECTION = 'contradiction_detection',
  CONTEXT_RANKING = 'context_ranking',
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stopSequences?: string[];
}

export interface RoutingConstraints {
  forceProvider?: 'local' | 'cloud';
  maxLatencyMs?: number;
  maxCostUsd?: number;
  privacyLevel?: 'standard' | 'sensitive' | 'restricted';
}

export interface LLMRequest {
  id: string;
  task: LLMTask;
  prompt: string;
  systemPrompt?: string;
  schema?: Record<string, unknown>;
  options?: CompletionOptions;
  constraints?: RoutingConstraints;
}

export interface LLMResponse {
  id: string;
  requestId: string;
  content: string;
  provider: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
  latencyMs: number;
  cached: boolean;
  timestamp: string;
}

export interface ProviderCapabilities {
  supportedTasks: LLMTask[];
  maxContextTokens: number;
  supportsStructuredOutput: boolean;
  supportsStreaming: boolean;
  estimatedTokensPerSecond: number;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
}

export interface LLMProvider {
  name: string;
  type: 'local' | 'cloud';
  capabilities: ProviderCapabilities;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  completeStructured<T>(
    prompt: string,
    schema: Record<string, unknown>,
    options?: CompletionOptions,
  ): Promise<T>;
  stream(prompt: string, options?: CompletionOptions): AsyncGenerator<string>;
  embed(texts: string[]): Promise<Float32Array[]>;
  isAvailable(): Promise<boolean>;
}

export interface TokenUsageRecord {
  id: string;
  requestId: string;
  task: LLMTask;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  timestamp: string;
}

export interface MonthlySnapshot {
  month: string;
  totalCostUsd: number;
  requestCount: number;
}

export interface CostReport {
  currentMonth: {
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
    costByTask: Record<string, number>;
    costByProvider: Record<string, number>;
    budgetRemainingUsd: number;
    budgetUsedPercent: number;
  };
  history: MonthlySnapshot[];
  projectedMonthlyCost: number;
}
