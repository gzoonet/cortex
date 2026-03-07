import {
  type CompletionOptions,
  type LLMProvider,
  type ProviderCapabilities,
  LLMTask,
  CortexError,
  LLM_PROVIDER_UNAVAILABLE,
  LLM_TIMEOUT,
  createLogger,
} from '@cortex/core';

const logger = createLogger('llm:ollama');

export interface OllamaProviderOptions {
  host?: string;
  model?: string;
  embeddingModel?: string;
  numCtx?: number;
  numGpu?: number;
  timeoutMs?: number;
  keepAlive?: string;
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream: boolean;
  options?: {
    temperature?: number;
    num_ctx?: number;
    num_gpu?: number;
    num_predict?: number;
    stop?: string[];
  };
  keep_alive?: string;
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaEmbedRequest {
  model: string;
  input: string | string[];
}

interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
}

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    model: string;
    modified_at: string;
    size: number;
  }>;
}

// IPs that must never be used as Ollama host (cloud metadata, link-local)
const BLOCKED_HOST_PATTERNS = [
  /^169\.254\./,          // AWS/Azure metadata link-local
  /^fd[0-9a-f]{2}:/i,    // IPv6 unique local (fd00::/8)
  /^fe80:/i,              // IPv6 link-local
];

function validateOllamaHost(host: string): void {
  let parsed: URL;
  try {
    parsed = new URL(host);
  } catch {
    throw new CortexError(
      LLM_PROVIDER_UNAVAILABLE, 'high', 'llm',
      `Invalid Ollama host URL: ${host}`,
      { host },
      'Set a valid URL like http://localhost:11434',
      false,
    );
  }

  const hostname = parsed.hostname;

  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new CortexError(
        LLM_PROVIDER_UNAVAILABLE, 'high', 'llm',
        `Ollama host "${hostname}" is blocked — it matches a link-local or cloud metadata IP range.`,
        { host },
        'Use a non-link-local address for Ollama.',
        false,
      );
    }
  }

  const localhostNames = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
  if (!localhostNames.has(hostname)) {
    logger.warn(
      `Ollama host is not localhost (${hostname}). ` +
      'Ensure the remote Ollama instance is trusted and network-secured.',
    );
  }
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly type = 'local' as const;

  private host: string;
  private model: string;
  private embeddingModel: string;
  private numCtx: number;
  private numGpu: number;
  private timeoutMs: number;
  private keepAlive: string;
  private streamInactivityTimeoutMs: number;

  readonly capabilities: ProviderCapabilities = {
    supportedTasks: [
      LLMTask.ENTITY_EXTRACTION,
      LLMTask.RELATIONSHIP_INFERENCE,
      LLMTask.CONTRADICTION_DETECTION,
      LLMTask.CONVERSATIONAL_QUERY,
      LLMTask.CONTEXT_RANKING,
      LLMTask.EMBEDDING_GENERATION,
    ],
    maxContextTokens: 8192,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    estimatedTokensPerSecond: 30,
    costPerMillionInputTokens: 0,
    costPerMillionOutputTokens: 0,
  };

  constructor(options: OllamaProviderOptions = {}) {
    this.host = options.host ?? process.env['CORTEX_OLLAMA_HOST'] ?? 'http://localhost:11434';
    validateOllamaHost(this.host);
    this.model = options.model ?? 'mistral:7b-instruct-q5_K_M';
    this.embeddingModel = options.embeddingModel ?? 'nomic-embed-text';
    this.numCtx = options.numCtx ?? 8192;
    this.numGpu = options.numGpu ?? -1;
    this.timeoutMs = options.timeoutMs ?? 300_000; // 5 minutes - allows for cold start model loading
    this.keepAlive = options.keepAlive ?? '5m';
    this.streamInactivityTimeoutMs = 60_000; // 60s inactivity timeout during streaming

    // Update max context tokens based on config
    this.capabilities.maxContextTokens = this.numCtx;
  }

  getModel(): string {
    return this.model;
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const result = await this.completeWithSystem(undefined, prompt, options);
    return result.content;
  }

  async completeWithSystem(
    systemPrompt: string | undefined,
    userPrompt: string,
    options?: CompletionOptions,
    _modelPreference: 'primary' | 'fast' = 'primary',
  ): Promise<{ content: string; inputTokens: number; outputTokens: number; model: string }> {
    // Cap num_predict to half the context window so the prompt has room
    const numPredict = options?.maxTokens
      ? Math.min(options.maxTokens, Math.floor(this.numCtx / 2))
      : undefined;

    const requestBody: OllamaGenerateRequest = {
      model: this.model,
      prompt: userPrompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_ctx: this.numCtx,
        num_gpu: this.numGpu,
        ...(numPredict !== undefined && { num_predict: numPredict }),
        ...(options?.stopSequences?.length && { stop: options.stopSequences }),
      },
      keep_alive: this.keepAlive,
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const result = await response.json() as OllamaGenerateResponse;

      // Ollama provides token counts in the response
      const inputTokens = result.prompt_eval_count ?? 0;
      const outputTokens = result.eval_count ?? 0;

      logger.debug('Ollama completion', {
        model: this.model,
        inputTokens,
        outputTokens,
        durationMs: result.total_duration ? Math.round(result.total_duration / 1_000_000) : undefined,
      });

      return {
        content: result.response,
        inputTokens,
        outputTokens,
        model: this.model,
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
    _modelPreference: 'primary' | 'fast' = 'primary',
  ): AsyncGenerator<string, { inputTokens: number; outputTokens: number; model: string }> {
    const streamNumPredict = options?.maxTokens
      ? Math.min(options.maxTokens, Math.floor(this.numCtx / 2))
      : undefined;

    const requestBody: OllamaGenerateRequest = {
      model: this.model,
      prompt: userPrompt,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_ctx: this.numCtx,
        num_gpu: this.numGpu,
        ...(streamNumPredict !== undefined && { num_predict: streamNumPredict }),
        ...(options?.stopSequences?.length && { stop: options.stopSequences }),
      },
      keep_alive: this.keepAlive,
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body from Ollama');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let inputTokens = 0;
      let outputTokens = 0;

      // Per-chunk inactivity timeout — aborts if model stalls mid-stream
      const streamController = new AbortController();
      let inactivityTimer = setTimeout(
        () => streamController.abort(),
        this.streamInactivityTimeoutMs,
      );

      try {
        while (true) {
          const readPromise = reader.read();
          // Race the read against the inactivity abort
          const raceResult = await Promise.race([
            readPromise,
            new Promise<never>((_, reject) => {
              streamController.signal.addEventListener('abort', () =>
                reject(new Error('Stream inactivity timeout')),
                { once: true },
              );
              if (streamController.signal.aborted) {
                reject(new Error('Stream inactivity timeout'));
              }
            }),
          ]);

          const { done, value } = raceResult;
          if (done) break;

          // Reset inactivity timer on each chunk
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(
            () => streamController.abort(),
            this.streamInactivityTimeoutMs,
          );

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line) as OllamaGenerateResponse;
              if (data.response) {
                yield data.response;
              }
              if (data.done) {
                inputTokens = data.prompt_eval_count ?? 0;
                outputTokens = data.eval_count ?? 0;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      } finally {
        clearTimeout(inactivityTimer);
      }

      return {
        inputTokens,
        outputTokens,
        model: this.model,
      };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const requestBody: OllamaEmbedRequest = {
        model: this.embeddingModel,
        input: texts,
      };

      const response = await fetch(`${this.host}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama embed API error (${response.status}): ${errorText}`);
      }

      const result = await response.json() as OllamaEmbedResponse;

      logger.debug('Ollama embeddings', {
        model: this.embeddingModel,
        count: texts.length,
        dimensions: result.embeddings[0]?.length,
      });

      return result.embeddings.map(emb => new Float32Array(emb));
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.host}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const result = await response.json() as OllamaTagsResponse;
      
      // Check if the required model is available
      const hasModel = result.models.some(m => m.name === this.model || m.model === this.model);
      if (!hasModel) {
        logger.warn('Ollama model not found', { model: this.model, available: result.models.map(m => m.name) });
      }

      return true;
    } catch {
      return false;
    }
  }

  async ensureModel(): Promise<void> {
    const available = await this.isAvailable();
    if (!available) {
      throw new CortexError(
        LLM_PROVIDER_UNAVAILABLE,
        'high',
        'llm',
        `Ollama is not running or not reachable at ${this.host}`,
        undefined,
        'Start Ollama with `ollama serve` or check the host configuration.',
        false,
      );
    }

    // Check if model needs to be pulled
    const response = await fetch(`${this.host}/api/tags`);
    const result = await response.json() as OllamaTagsResponse;
    const hasModel = result.models.some(m => m.name === this.model || m.model === this.model);

    if (!hasModel) {
      logger.info('Pulling Ollama model', { model: this.model });
      // Note: Model pulling is a long operation, user should do this manually
      throw new CortexError(
        LLM_PROVIDER_UNAVAILABLE,
        'high',
        'llm',
        `Ollama model "${this.model}" is not installed.`,
        { model: this.model },
        `Run: ollama pull ${this.model}`,
        false,
      );
    }
  }

  async listModels(): Promise<Array<{ name: string; sizeBytes: number; modifiedAt: string }>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${this.host}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) return [];
      const result = await response.json() as OllamaTagsResponse;
      return result.models.map((m) => ({ name: m.name, sizeBytes: m.size, modifiedAt: m.modified_at }));
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  getHost(): string {
    return this.host;
  }

  getNumCtx(): number {
    return this.numCtx;
  }

  getNumGpu(): number {
    return this.numGpu;
  }

  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  private mapError(err: unknown): CortexError {
    if (err instanceof CortexError) {
      return err;
    }

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return new CortexError(
          LLM_TIMEOUT,
          'medium',
          'llm',
          `Ollama request timed out after ${this.timeoutMs}ms`,
          { timeoutMs: this.timeoutMs },
          'Increase timeout or check if model is loaded.',
          true,
          504,
        );
      }

      if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
        return new CortexError(
          LLM_PROVIDER_UNAVAILABLE,
          'high',
          'llm',
          `Cannot connect to Ollama at ${this.host}`,
          { host: this.host },
          'Start Ollama with `ollama serve` or check the host configuration.',
          false,
        );
      }

      return new CortexError(
        LLM_PROVIDER_UNAVAILABLE,
        'high',
        'llm',
        `Ollama provider error: ${err.message}`,
        undefined,
        'Check Ollama logs for details.',
        true,
      );
    }

    return new CortexError(
      LLM_PROVIDER_UNAVAILABLE,
      'high',
      'llm',
      `Ollama provider error: ${String(err)}`,
      undefined,
      'Check Ollama logs for details.',
      true,
    );
  }
}
