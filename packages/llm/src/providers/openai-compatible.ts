import OpenAI from 'openai';
import {
  type CompletionOptions,
  type LLMProvider,
  type ProviderCapabilities,
  LLMTask,
  CortexError,
  LLM_AUTH_FAILED,
  LLM_PROVIDER_UNAVAILABLE,
  LLM_RATE_LIMITED,
  LLM_TIMEOUT,
  createLogger,
} from '@cortex/core';

const logger = createLogger('llm:openai-compatible');

export interface OpenAICompatibleProviderOptions {
  baseUrl: string;
  apiKey?: string;
  primaryModel?: string;
  fastModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = 'openai-compatible';
  readonly type = 'cloud' as const;

  private client: OpenAI;
  private primaryModel: string;
  private fastModel: string;
  private isGemini: boolean;

  readonly capabilities: ProviderCapabilities = {
    supportedTasks: [
      LLMTask.ENTITY_EXTRACTION,
      LLMTask.RELATIONSHIP_INFERENCE,
      LLMTask.CONTRADICTION_DETECTION,
      LLMTask.CONVERSATIONAL_QUERY,
      LLMTask.CONTEXT_RANKING,
    ],
    maxContextTokens: 128_000,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    estimatedTokensPerSecond: 80,
    // Set to 0 — pricing varies by provider; budget tracking is approximate
    costPerMillionInputTokens: 0,
    costPerMillionOutputTokens: 0,
  };

  constructor(options: OpenAICompatibleProviderOptions) {
    if (!options.apiKey) {
      throw new CortexError(
        LLM_AUTH_FAILED,
        'critical',
        'llm',
        'OpenAI-compatible API key not found. Check llm.cloud.apiKeySource in your config.',
        undefined,
        'Set the environment variable specified in llm.cloud.apiKeySource.',
        false,
        401,
      );
    }

    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
      timeout: options.timeoutMs ?? 60_000,
      maxRetries: options.maxRetries ?? 3,
    });

    this.primaryModel = options.primaryModel ?? 'gpt-4o';
    this.fastModel = options.fastModel ?? 'gpt-4o-mini';
    this.isGemini = options.baseUrl.includes('generativelanguage.googleapis.com');

    logger.info('OpenAI-compatible provider initialized', {
      baseUrl: options.baseUrl,
      primaryModel: this.primaryModel,
      fastModel: this.fastModel,
    });
  }

  getModel(preference: 'primary' | 'fast' = 'primary'): string {
    return preference === 'fast' ? this.fastModel : this.primaryModel;
  }

  /** Gemini uses max_completion_tokens; others use max_tokens */
  private tokenLimitParams(maxTokens: number): Record<string, number> {
    return this.isGemini
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens };
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const result = await this.completeWithSystem(undefined, prompt, options);
    return result.content;
  }

  async completeWithSystem(
    systemPrompt: string | undefined,
    userPrompt: string,
    options?: CompletionOptions,
    modelPreference: 'primary' | 'fast' = 'primary',
  ): Promise<{ content: string; inputTokens: number; outputTokens: number; model: string }> {
    const model = this.getModel(modelPreference);

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: userPrompt });

      const response = await this.client.chat.completions.create({
        model,
        ...this.tokenLimitParams(options?.maxTokens ?? 4096),
        temperature: options?.temperature ?? 0.7,
        messages,
        ...(options?.stopSequences?.length && { stop: options.stopSequences }),
      });

      const content = response.choices[0]?.message?.content ?? '';

      return {
        content,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model,
      };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async completeStructured<T>(
    prompt: string,
    _schema: Record<string, unknown>,
    options?: CompletionOptions,
  ): Promise<T> {
    const result = await this.complete(prompt, options);
    return JSON.parse(result) as T;
  }

  async *stream(
    prompt: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    yield* this.streamWithSystem(undefined, prompt, options);
  }

  async *streamWithSystem(
    systemPrompt: string | undefined,
    userPrompt: string,
    options?: CompletionOptions,
    modelPreference: 'primary' | 'fast' = 'primary',
  ): AsyncGenerator<string, { inputTokens: number; outputTokens: number; model: string }> {
    const model = this.getModel(modelPreference);

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: userPrompt });

      const stream = await this.client.chat.completions.create({
        model,
        ...this.tokenLimitParams(options?.maxTokens ?? 4096),
        temperature: options?.temperature ?? 0.7,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(options?.stopSequences?.length && { stop: options.stopSequences }),
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
        // Usage is reported in the final chunk when stream_options.include_usage = true
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }

      return { inputTokens, outputTokens, model };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async embed(_texts: string[]): Promise<Float32Array[]> {
    throw new CortexError(
      LLM_PROVIDER_UNAVAILABLE,
      'medium',
      'llm',
      'OpenAI-compatible provider does not handle embeddings. Use local embedding model.',
    );
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.fastModel,
        ...this.tokenLimitParams(1),
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  private mapError(err: unknown): CortexError {
    if (err instanceof OpenAI.AuthenticationError) {
      return new CortexError(
        LLM_AUTH_FAILED, 'critical', 'llm',
        'OpenAI-compatible API authentication failed. Check your API key.',
        undefined, 'Verify the environment variable in llm.cloud.apiKeySource is correct.', false, 401,
      );
    }
    if (err instanceof OpenAI.RateLimitError) {
      return new CortexError(
        LLM_RATE_LIMITED, 'medium', 'llm',
        'OpenAI-compatible API rate limit exceeded.',
        undefined, 'Wait and retry with backoff.', true, 429,
      );
    }
    if (err instanceof OpenAI.APIConnectionTimeoutError) {
      return new CortexError(
        LLM_TIMEOUT, 'medium', 'llm',
        'OpenAI-compatible API request timed out.',
        undefined, 'Retry the request or increase llm.cloud.timeoutMs.', true, 504,
      );
    }
    if (err instanceof OpenAI.APIError) {
      const body = typeof err.error === 'object' ? JSON.stringify(err.error) : String(err.error ?? '');
      logger.debug('API error details', { status: err.status, body, headers: err.headers });
      return new CortexError(
        LLM_PROVIDER_UNAVAILABLE, 'high', 'llm',
        `OpenAI-compatible API error: ${err.status} ${err.message}${body ? ` — ${body}` : ''}`,
        { status: err.status },
        'Retry or check your provider status page.', true,
        err.status,
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return new CortexError(
      LLM_PROVIDER_UNAVAILABLE, 'high', 'llm',
      `OpenAI-compatible provider error: ${message}`,
      undefined, 'Check network connectivity and llm.cloud.baseUrl configuration.', true,
    );
  }
}
