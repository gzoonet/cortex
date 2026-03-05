import type { ZodSchema } from 'zod';
import {
  LLMTask,
  type CortexConfig,
  CortexError,
  LLM_BUDGET_EXHAUSTED,
  LLM_PROVIDER_UNAVAILABLE,
  createLogger,
  eventBus,
} from '@cortex/core';
import { AnthropicProvider } from './providers/anthropic.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.js';
import { TokenTracker } from './token-tracker.js';
import { ResponseCache } from './cache.js';
import { parseStructuredOutput, buildCorrectionPrompt } from './output-parser.js';

const logger = createLogger('llm:router');

export type LLMMode = 'cloud-first' | 'hybrid' | 'local-first' | 'local-only';
export type TaskRouting = 'auto' | 'local' | 'cloud';

export interface RouterOptions {
  config: CortexConfig;
  apiKey?: string;
}

export interface CompleteRequest {
  systemPrompt?: string;
  userPrompt: string;
  promptId: string;
  promptVersion: string;
  task: LLMTask;
  modelPreference?: 'primary' | 'fast';
  temperature?: number;
  maxTokens?: number;
  contentHash?: string;
  forceProvider?: 'local' | 'cloud';
}

export interface CompleteResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  latencyMs: number;
  costUsd: number;
  provider: 'anthropic' | 'ollama' | 'openai-compatible';
}

interface ProviderWithSystem {
  completeWithSystem(
    systemPrompt: string | undefined,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number },
    modelPreference?: 'primary' | 'fast',
  ): Promise<{ content: string; inputTokens: number; outputTokens: number; model: string }>;
  streamWithSystem(
    systemPrompt: string | undefined,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number },
    modelPreference?: 'primary' | 'fast',
  ): AsyncGenerator<string, { inputTokens: number; outputTokens: number; model: string }>;
  getModel(preference?: 'primary' | 'fast'): string;
  isAvailable(): Promise<boolean>;
}

type CloudProvider = AnthropicProvider | OpenAICompatibleProvider;

function resolveApiKeySource(source: string): string | undefined {
  if (source.startsWith('env:')) {
    return process.env[source.slice(4)];
  }
  return undefined;
}

export class Router {
  private cloudProvider: CloudProvider | null = null;
  private localProvider: OllamaProvider | null = null;
  private mode: LLMMode;
  private taskRouting: Record<string, TaskRouting>;
  private tracker: TokenTracker;
  private cache: ResponseCache;
  private config: CortexConfig;

  constructor(options: RouterOptions) {
    const { config } = options;
    this.config = config;
    this.mode = config.llm.mode as LLMMode;
    this.taskRouting = config.llm.taskRouting as Record<string, TaskRouting>;

    // Initialize providers based on mode
    if (this.mode !== 'local-only') {
      try {
        if (config.llm.cloud.provider === 'openai-compatible') {
          const baseUrl = config.llm.cloud.baseUrl;
          if (!baseUrl) {
            logger.warn('openai-compatible provider requires llm.cloud.baseUrl — skipping cloud');
          } else {
            this.cloudProvider = new OpenAICompatibleProvider({
              baseUrl,
              apiKey: options.apiKey ?? resolveApiKeySource(config.llm.cloud.apiKeySource),
              primaryModel: config.llm.cloud.models.primary,
              fastModel: config.llm.cloud.models.fast,
              timeoutMs: config.llm.cloud.timeoutMs,
              maxRetries: config.llm.cloud.maxRetries,
            });
          }
        } else {
          this.cloudProvider = new AnthropicProvider({
            apiKey: options.apiKey,
            primaryModel: config.llm.cloud.models.primary,
            fastModel: config.llm.cloud.models.fast,
            timeoutMs: config.llm.cloud.timeoutMs,
            maxRetries: config.llm.cloud.maxRetries,
            promptCaching: config.llm.cloud.promptCaching,
          });
        }
      } catch (err) {
        // Cloud provider initialization failed (e.g., no API key)
        if (this.mode === 'cloud-first') {
          throw err; // Cloud is required in cloud-first mode
        }
        logger.warn('Cloud provider unavailable, falling back to local-only', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (this.mode !== 'cloud-first' || !this.cloudProvider) {
      this.localProvider = new OllamaProvider({
        host: config.llm.local.host,
        model: config.llm.local.model,
        embeddingModel: config.llm.local.embeddingModel,
        numCtx: config.llm.local.numCtx,
        numGpu: config.llm.local.numGpu,
        timeoutMs: config.llm.local.timeoutMs,
        keepAlive: config.llm.local.keepAlive,
      });
    }

    this.tracker = new TokenTracker(
      config.llm.budget.monthlyLimitUsd,
      config.llm.budget.warningThresholds,
    );

    this.cache = new ResponseCache({
      enabled: config.llm.cache.enabled,
      ttlMs: config.llm.cache.ttlDays * 24 * 60 * 60 * 1000,
    });

    logger.info('Router initialized', {
      mode: this.mode,
      hasCloud: !!this.cloudProvider,
      hasLocal: !!this.localProvider,
    });
  }

  /**
   * Select provider based on mode, task routing, and availability
   */
  private async selectProvider(
    task: LLMTask,
    forceProvider?: 'local' | 'cloud',
  ): Promise<{ provider: ProviderWithSystem; name: CompleteResult['provider'] }> {
    const cloudName = (): CompleteResult['provider'] =>
      (this.cloudProvider?.name ?? 'anthropic') as CompleteResult['provider'];

    // Handle forced provider
    if (forceProvider === 'cloud') {
      if (!this.cloudProvider) {
        throw new CortexError(
          LLM_PROVIDER_UNAVAILABLE,
          'high',
          'llm',
          'Cloud provider requested but not available.',
          { mode: this.mode },
          'Set your cloud API key or change LLM mode.',
          false,
        );
      }
      return { provider: this.cloudProvider, name: cloudName() };
    }

    if (forceProvider === 'local') {
      if (!this.localProvider) {
        throw new CortexError(
          LLM_PROVIDER_UNAVAILABLE,
          'high',
          'llm',
          'Local provider requested but not configured.',
          { mode: this.mode },
          'Change LLM mode to include local provider.',
          false,
        );
      }
      return { provider: this.localProvider, name: 'ollama' };
    }

    // Check task-specific routing
    const taskRoute = this.taskRouting[task] ?? 'auto';
    if (taskRoute === 'cloud' && this.cloudProvider) {
      return { provider: this.cloudProvider, name: cloudName() };
    }
    if (taskRoute === 'local' && this.localProvider) {
      return { provider: this.localProvider, name: 'ollama' };
    }

    // Auto routing based on mode
    switch (this.mode) {
      case 'local-only':
        if (!this.localProvider) {
          throw new CortexError(
            LLM_PROVIDER_UNAVAILABLE,
            'high',
            'llm',
            'Local-only mode but Ollama provider not available.',
            undefined,
            'Ensure Ollama is running with `ollama serve`.',
            false,
          );
        }
        return { provider: this.localProvider, name: 'ollama' };

      case 'local-first':
        // Try local first, fall back to cloud
        if (this.localProvider && await this.localProvider.isAvailable()) {
          return { provider: this.localProvider, name: 'ollama' };
        }
        if (this.cloudProvider) {
          logger.info('Local provider unavailable, falling back to cloud');
          return { provider: this.cloudProvider, name: cloudName() };
        }
        throw new CortexError(
          LLM_PROVIDER_UNAVAILABLE,
          'high',
          'llm',
          'No LLM provider available.',
          { mode: this.mode },
          'Start Ollama or configure cloud API key.',
          false,
        );

      case 'hybrid':
        // Use local for cheap/high-volume tasks, cloud for reasoning-heavy tasks
        const cheapTasks = [
          LLMTask.ENTITY_EXTRACTION,
          LLMTask.CONTEXT_RANKING,
          LLMTask.EMBEDDING_GENERATION,
        ];
        if (cheapTasks.includes(task) && this.localProvider && await this.localProvider.isAvailable()) {
          logger.debug('Hybrid routing to local provider', { task });
          return { provider: this.localProvider, name: 'ollama' };
        }
        if (this.cloudProvider) {
          logger.debug('Hybrid routing to cloud provider', { task });
          return { provider: this.cloudProvider, name: cloudName() };
        }
        // Cloud unavailable — fall back to local for everything
        if (this.localProvider) {
          logger.warn('Cloud provider unavailable in hybrid mode, falling back to local', { task });
          return { provider: this.localProvider, name: 'ollama' };
        }
        throw new CortexError(
          LLM_PROVIDER_UNAVAILABLE,
          'high',
          'llm',
          'No LLM provider available.',
          { mode: this.mode },
          'Configure cloud API key or start Ollama.',
          false,
        );

      case 'cloud-first':
      default:
        // Prefer cloud, fall back to local if budget exhausted
        if (this.cloudProvider && !this.tracker.isBudgetExhausted()) {
          return { provider: this.cloudProvider, name: cloudName() };
        }
        if (this.localProvider && this.config.llm.budget.enforcementAction === 'fallback-local') {
          logger.info('Budget exhausted or cloud unavailable, falling back to local');
          return { provider: this.localProvider, name: 'ollama' };
        }
        if (!this.cloudProvider) {
          throw new CortexError(
            LLM_PROVIDER_UNAVAILABLE,
            'high',
            'llm',
            'Cloud provider not available.',
            { mode: this.mode },
            'Set your cloud API key or change LLM mode.',
            false,
          );
        }
        // Cloud available but budget exhausted and no fallback
        throw new CortexError(
          LLM_BUDGET_EXHAUSTED,
          'high',
          'llm',
          'Monthly budget exhausted.',
          { spent: this.tracker.getCurrentMonthSpend() },
          'Increase budget, wait for next month, or enable local fallback.',
          false,
          402,
        );
    }
  }

  // Keep legacy provider getter for backward compatibility
  get provider(): ProviderWithSystem {
    return this.cloudProvider ?? this.localProvider!;
  }

  async complete(request: CompleteRequest): Promise<CompleteResult> {
    // Select provider based on mode and task
    const { provider, name: providerName } = await this.selectProvider(
      request.task,
      request.forceProvider,
    );

    // Check cache
    if (request.contentHash) {
      const cached = this.cache.get(
        request.contentHash,
        request.promptId,
        request.promptVersion,
      );
      if (cached) {
        return {
          content: cached.response,
          model: cached.model,
          inputTokens: cached.inputTokens,
          outputTokens: cached.outputTokens,
          cached: true,
          latencyMs: 0,
          costUsd: 0,
          provider: providerName,
        };
      }
    }

    // Emit start event
    const requestId = crypto.randomUUID();
    eventBus.emit({
      type: 'llm.request.start',
      payload: { requestId, task: request.task, provider: providerName },
      timestamp: new Date().toISOString(),
      source: 'llm:router',
    });

    const startMs = performance.now();

    const result = await provider.completeWithSystem(
      request.systemPrompt,
      request.userPrompt,
      {
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      },
      request.modelPreference ?? 'primary',
    );

    const latencyMs = Math.round(performance.now() - startMs);

    // Track tokens
    const usageRecord = this.tracker.record(
      requestId,
      request.task,
      providerName,
      result.model,
      result.inputTokens,
      result.outputTokens,
      latencyMs,
    );

    // Cache the result
    if (request.contentHash) {
      this.cache.set(
        request.contentHash,
        request.promptId,
        request.promptVersion,
        result.content,
        result.model,
        result.inputTokens,
        result.outputTokens,
      );
    }

    // Emit complete event
    eventBus.emit({
      type: 'llm.request.complete',
      payload: {
        requestId,
        task: request.task,
        provider: providerName,
        model: result.model,
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd: usageRecord.estimatedCostUsd,
        },
        latencyMs,
      },
      timestamp: new Date().toISOString(),
      source: 'llm:router',
    });

    return {
      content: result.content,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cached: false,
      latencyMs,
      costUsd: usageRecord.estimatedCostUsd,
      provider: providerName,
    };
  }

  async completeStructured<T>(
    request: CompleteRequest,
    schema: ZodSchema<T>,
  ): Promise<{ data: T } & CompleteResult> {
    const result = await this.complete(request);

    try {
      const data = parseStructuredOutput(result.content, schema);

      // Step 9: local-first confidence escalation
      // If the local provider returned low-confidence entities, retry with cloud
      if (
        this.mode === 'local-first' &&
        result.provider === 'ollama' &&
        this.cloudProvider &&
        !request.forceProvider
      ) {
        const entities = (data as Record<string, unknown>).entities;
        if (Array.isArray(entities) && entities.length > 0) {
          const confidences = entities
            .map((e) => (typeof (e as Record<string, unknown>).confidence === 'number' ? (e as Record<string, unknown>).confidence as number : null))
            .filter((c): c is number => c !== null)
            .sort((a, b) => a - b);

          if (confidences.length > 0) {
            const mid = Math.floor(confidences.length / 2);
            const median = confidences.length % 2 !== 0
              ? confidences[mid]!
              : ((confidences[mid - 1]! + confidences[mid]!) / 2);

            if (median < 0.6) {
              logger.info('Local confidence below threshold, escalating to cloud', {
                median: Math.round(median * 100) / 100,
                task: request.task,
              });
              const cloudResult = await this.complete({ ...request, forceProvider: 'cloud', contentHash: undefined });
              const cloudData = parseStructuredOutput(cloudResult.content, schema);
              return { ...cloudResult, data: cloudData };
            }
          }
        }
      }

      return { ...result, data };
    } catch (firstErr) {
      // Retry once with correction prompt
      logger.warn('Structured output parse failed, retrying with correction', {
        promptId: request.promptId,
        error: firstErr instanceof Error ? firstErr.message : String(firstErr),
      });

      const correctedPrompt = buildCorrectionPrompt(
        request.userPrompt,
        result.content,
        firstErr instanceof Error ? firstErr.message : String(firstErr),
      );

      const retryResult = await this.complete({
        ...request,
        userPrompt: correctedPrompt,
        contentHash: undefined, // Don't cache correction attempts
      });

      const data = parseStructuredOutput(retryResult.content, schema);
      return { ...retryResult, data };
    }
  }

  async *stream(
    request: Omit<CompleteRequest, 'contentHash'>,
  ): AsyncGenerator<string, CompleteResult> {
    // Select provider based on mode and task
    const { provider, name: providerName } = await this.selectProvider(
      request.task,
      request.forceProvider,
    );

    const requestId = crypto.randomUUID();
    eventBus.emit({
      type: 'llm.request.start',
      payload: { requestId, task: request.task, provider: providerName },
      timestamp: new Date().toISOString(),
      source: 'llm:router',
    });

    const startMs = performance.now();
    let fullContent = '';

    const gen = provider.streamWithSystem(
      request.systemPrompt,
      request.userPrompt,
      {
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      },
      request.modelPreference ?? 'primary',
    );

    let streamResult: { inputTokens: number; outputTokens: number; model: string } | undefined;

    while (true) {
      const { value, done } = await gen.next();
      if (done) {
        streamResult = value as { inputTokens: number; outputTokens: number; model: string };
        break;
      }
      fullContent += value;
      yield value as string;
    }

    const latencyMs = Math.round(performance.now() - startMs);
    const tokens = streamResult ?? { inputTokens: 0, outputTokens: 0, model: provider.getModel() };

    const usageRecord = this.tracker.record(
      requestId,
      request.task,
      providerName,
      tokens.model,
      tokens.inputTokens,
      tokens.outputTokens,
      latencyMs,
    );

    eventBus.emit({
      type: 'llm.request.complete',
      payload: {
        requestId,
        task: request.task,
        provider: providerName,
        model: tokens.model,
        usage: {
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          estimatedCostUsd: usageRecord.estimatedCostUsd,
        },
        latencyMs,
      },
      timestamp: new Date().toISOString(),
      source: 'llm:router',
    });

    return {
      content: fullContent,
      model: tokens.model,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cached: false,
      latencyMs,
      costUsd: usageRecord.estimatedCostUsd,
      provider: providerName,
    };
  }

  getTracker(): TokenTracker {
    return this.tracker;
  }

  getCache(): ResponseCache {
    return this.cache;
  }

  getLocalProvider(): OllamaProvider | null {
    return this.localProvider;
  }

  getCloudProvider(): CloudProvider | null {
    return this.cloudProvider;
  }

  getMode(): LLMMode {
    return this.mode;
  }

  async isAvailable(): Promise<boolean> {
    // Check based on mode
    switch (this.mode) {
      case 'local-only':
        return this.localProvider?.isAvailable() ?? false;
      case 'cloud-first':
        return this.cloudProvider?.isAvailable() ?? false;
      default:
        // hybrid or local-first: either provider works
        const localAvailable = await this.localProvider?.isAvailable() ?? false;
        const cloudAvailable = await this.cloudProvider?.isAvailable() ?? false;
        return localAvailable || cloudAvailable;
    }
  }
}
