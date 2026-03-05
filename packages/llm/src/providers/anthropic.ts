import Anthropic from '@anthropic-ai/sdk';
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

const logger = createLogger('llm:anthropic');

export interface AnthropicProviderOptions {
  apiKey?: string;
  primaryModel?: string;
  fastModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
  promptCaching?: boolean;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly type = 'cloud' as const;

  private client: Anthropic;
  private primaryModel: string;
  private fastModel: string;
  private promptCaching: boolean;

  readonly capabilities: ProviderCapabilities = {
    supportedTasks: [
      LLMTask.ENTITY_EXTRACTION,
      LLMTask.RELATIONSHIP_INFERENCE,
      LLMTask.CONTRADICTION_DETECTION,
      LLMTask.CONVERSATIONAL_QUERY,
      LLMTask.CONTEXT_RANKING,
    ],
    maxContextTokens: 200_000,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    estimatedTokensPerSecond: 80,
    costPerMillionInputTokens: 3.0,
    costPerMillionOutputTokens: 15.0,
  };

  constructor(options: AnthropicProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env['CORTEX_ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new CortexError(
        LLM_AUTH_FAILED,
        'critical',
        'llm',
        'Anthropic API key not found. Set CORTEX_ANTHROPIC_API_KEY environment variable.',
        undefined,
        'Set CORTEX_ANTHROPIC_API_KEY or run `cortex init`.',
        false,
        401,
      );
    }

    this.client = new Anthropic({
      apiKey,
      timeout: options.timeoutMs ?? 30_000,
      maxRetries: options.maxRetries ?? 3,
    });

    this.primaryModel = options.primaryModel ?? 'claude-sonnet-4-5-20250929';
    this.fastModel = options.fastModel ?? 'claude-haiku-4-5-20251001';
    this.promptCaching = options.promptCaching ?? true;
  }

  getModel(preference: 'primary' | 'fast' = 'primary'): string {
    return preference === 'fast' ? this.fastModel : this.primaryModel;
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
      const systemMessages = systemPrompt
        ? this.buildSystemMessages(systemPrompt)
        : undefined;

      const response = await this.client.messages.create({
        model,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        ...(systemMessages && { system: systemMessages }),
        messages: [{ role: 'user', content: userPrompt }],
        ...(options?.stopSequences?.length && { stop_sequences: options.stopSequences }),
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const content = textBlock?.text ?? '';

      return {
        content,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
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
    // Use text completion with JSON instruction — tool_use could be added later
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
      const systemMessages = systemPrompt
        ? this.buildSystemMessages(systemPrompt)
        : undefined;

      const stream = this.client.messages.stream({
        model,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        ...(systemMessages && { system: systemMessages }),
        messages: [{ role: 'user', content: userPrompt }],
        ...(options?.stopSequences?.length && { stop_sequences: options.stopSequences }),
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }

      const finalMessage = await stream.finalMessage();
      return {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        model,
      };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async embed(_texts: string[]): Promise<Float32Array[]> {
    // Anthropic doesn't provide embeddings — handled locally by LanceDB
    throw new CortexError(
      LLM_PROVIDER_UNAVAILABLE,
      'medium',
      'llm',
      'Anthropic does not support embeddings. Use local embedding model.',
    );
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Minimal API call to check connectivity
      await this.client.messages.create({
        model: this.fastModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  private buildSystemMessages(systemPrompt: string): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> {
    if (this.promptCaching) {
      return [{
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      }];
    }
    return [{ type: 'text' as const, text: systemPrompt }];
  }

  private mapError(err: unknown): CortexError {
    if (err instanceof Anthropic.AuthenticationError) {
      return new CortexError(
        LLM_AUTH_FAILED, 'critical', 'llm',
        'Anthropic API authentication failed. Check your API key.',
        undefined, 'Verify CORTEX_ANTHROPIC_API_KEY is correct.', false, 401,
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return new CortexError(
        LLM_RATE_LIMITED, 'medium', 'llm',
        'Anthropic rate limit exceeded.',
        undefined, 'Wait and retry with backoff.', true, 429,
      );
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return new CortexError(
        LLM_TIMEOUT, 'medium', 'llm',
        'Anthropic API request timed out.',
        undefined, 'Retry the request.', true, 504,
      );
    }
    if (err instanceof Anthropic.APIError) {
      return new CortexError(
        LLM_PROVIDER_UNAVAILABLE, 'high', 'llm',
        `Anthropic API error: ${err.message}`,
        { status: err.status },
        'Retry or check Anthropic status page.', true,
        err.status,
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return new CortexError(
      LLM_PROVIDER_UNAVAILABLE, 'high', 'llm',
      `Anthropic provider error: ${message}`,
      undefined, 'Check network connectivity.', true,
    );
  }
}
