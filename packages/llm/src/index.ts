// Router (main entry point for all LLM calls)
export { Router, type RouterOptions, type CompleteRequest, type CompleteResult, type LLMMode, type TaskRouting } from './router.js';

// Providers
export { AnthropicProvider, type AnthropicProviderOptions } from './providers/anthropic.js';
export { OllamaProvider, type OllamaProviderOptions } from './providers/ollama.js';
export { OpenAICompatibleProvider, type OpenAICompatibleProviderOptions } from './providers/openai-compatible.js';

// Utilities
export { TokenTracker, estimateCost } from './token-tracker.js';
export { ResponseCache, type ResponseCacheOptions } from './cache.js';
export { parseStructuredOutput, buildCorrectionPrompt } from './output-parser.js';

// Prompts
export * as entityExtractionPrompt from './prompts/entity-extraction.js';
export * as relationshipInferencePrompt from './prompts/relationship-inference.js';
export * as mergeDetectionPrompt from './prompts/merge-detection.js';
export * as contradictionDetectionPrompt from './prompts/contradiction-detection.js';
export * as conversationalQueryPrompt from './prompts/conversational-query.js';
export * as contextRankingPrompt from './prompts/context-ranking.js';
export * as followUpGenerationPrompt from './prompts/follow-up-generation.js';
