import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../../packages/llm/src/providers/ollama.js';
import { CortexError } from '@cortex/core';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OllamaProvider({
      host: 'http://localhost:11434',
      model: 'mistral:7b-instruct-q5_K_M',
      embeddingModel: 'nomic-embed-text',
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should use default values when no options provided', () => {
      const defaultProvider = new OllamaProvider();
      expect(defaultProvider.name).toBe('ollama');
      expect(defaultProvider.type).toBe('local');
      expect(defaultProvider.getModel()).toBe('mistral:7b-instruct-q5_K_M');
    });

    it('should use provided options', () => {
      const customProvider = new OllamaProvider({
        model: 'llama2:7b',
        host: 'http://remote:11434',
      });
      expect(customProvider.getModel()).toBe('llama2:7b');
    });
  });

  describe('capabilities', () => {
    it('should report zero cost for local provider', () => {
      expect(provider.capabilities.costPerMillionInputTokens).toBe(0);
      expect(provider.capabilities.costPerMillionOutputTokens).toBe(0);
    });

    it('should support embedding generation', () => {
      expect(provider.capabilities.supportedTasks).toContain('embedding_generation');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'mistral:7b-instruct-q5_K_M' }] }),
      });

      const available = await provider.isAvailable();
      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return false when Ollama is not reachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('complete', () => {
    it('should call Ollama generate API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'mistral:7b-instruct-q5_K_M',
          response: 'Hello, world!',
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      const result = await provider.complete('Say hello');
      expect(result).toBe('Hello, world!');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should include system prompt when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'mistral:7b-instruct-q5_K_M',
          response: 'I am helpful.',
          done: true,
          prompt_eval_count: 20,
          eval_count: 10,
        }),
      });

      const result = await provider.completeWithSystem(
        'You are a helpful assistant.',
        'Who are you?',
      );
      
      expect(result.content).toBe('I am helpful.');
      expect(result.inputTokens).toBe(20);
      expect(result.outputTokens).toBe(10);
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.system).toBe('You are a helpful assistant.');
    });

    it('should throw CortexError on connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      await expect(provider.complete('test')).rejects.toThrow(CortexError);
    });

    it('should throw CortexError on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(provider.complete('test')).rejects.toThrow(CortexError);
    });
  });

  describe('embed', () => {
    it('should call Ollama embed API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'nomic-embed-text',
          embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
        }),
      });

      const result = await provider.embed(['text1', 'text2']);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Float32Array);
      expect(result[0][0]).toBeCloseTo(0.1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embed',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should throw CortexError on embed failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Model not found',
      });

      await expect(provider.embed(['test'])).rejects.toThrow(CortexError);
    });
  });

  describe('timeout handling', () => {
    it('should throw timeout error when request takes too long', async () => {
      // Create a provider with very short timeout
      const shortTimeoutProvider = new OllamaProvider({
        host: 'http://localhost:11434',
        model: 'mistral:7b-instruct-q5_K_M',
        timeoutMs: 1,
      });

      // Mock a slow response
      mockFetch.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      await expect(shortTimeoutProvider.complete('test')).rejects.toThrow();
    });
  });
});
