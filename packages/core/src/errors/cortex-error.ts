export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorLayer = 'ingest' | 'graph' | 'llm' | 'interface' | 'config' | 'privacy';

export class CortexError extends Error {
  override readonly name = 'CortexError';

  constructor(
    public readonly code: string,
    public readonly severity: ErrorSeverity,
    public readonly layer: ErrorLayer,
    message: string,
    public readonly context?: Record<string, unknown>,
    public readonly recoveryAction?: string,
    public readonly retryable: boolean = false,
    public readonly httpStatus?: number,
  ) {
    super(message);
  }
}

// --- Ingest Layer ---

export const INGEST_PARSE_FAILED = 'INGEST_PARSE_FAILED';
export const INGEST_FILE_TOO_LARGE = 'INGEST_FILE_TOO_LARGE';
export const INGEST_WATCHER_ERROR = 'INGEST_WATCHER_ERROR';
export const INGEST_PERMISSION_DENIED = 'INGEST_PERMISSION_DENIED';
export const INGEST_UNSUPPORTED_TYPE = 'INGEST_UNSUPPORTED_TYPE';
export const INGEST_ENCODING_ERROR = 'INGEST_ENCODING_ERROR';
export const INGEST_TIMEOUT = 'INGEST_TIMEOUT';

// --- LLM Layer ---

export const LLM_PROVIDER_UNAVAILABLE = 'LLM_PROVIDER_UNAVAILABLE';
export const LLM_EXTRACTION_FAILED = 'LLM_EXTRACTION_FAILED';
export const LLM_CONTEXT_OVERFLOW = 'LLM_CONTEXT_OVERFLOW';
export const LLM_RATE_LIMITED = 'LLM_RATE_LIMITED';
export const LLM_BUDGET_EXHAUSTED = 'LLM_BUDGET_EXHAUSTED';
export const LLM_AUTH_FAILED = 'LLM_AUTH_FAILED';
export const LLM_MODEL_NOT_FOUND = 'LLM_MODEL_NOT_FOUND';
export const LLM_TIMEOUT = 'LLM_TIMEOUT';

// --- Graph Layer ---

export const GRAPH_DB_ERROR = 'GRAPH_DB_ERROR';
export const GRAPH_ENTITY_NOT_FOUND = 'GRAPH_ENTITY_NOT_FOUND';
export const GRAPH_RELATIONSHIP_INVALID = 'GRAPH_RELATIONSHIP_INVALID';
export const GRAPH_VECTOR_ERROR = 'GRAPH_VECTOR_ERROR';
export const GRAPH_MERGE_CONFLICT = 'GRAPH_MERGE_CONFLICT';
export const GRAPH_INTEGRITY_ERROR = 'GRAPH_INTEGRITY_ERROR';

// --- Privacy / Config / Interface ---

export const PRIVACY_VIOLATION = 'PRIVACY_VIOLATION';
export const PRIVACY_SECRET_DETECTED = 'PRIVACY_SECRET_DETECTED';
export const CONFIG_INVALID = 'CONFIG_INVALID';
export const CONFIG_MISSING = 'CONFIG_MISSING';
export const INTERFACE_PORT_IN_USE = 'INTERFACE_PORT_IN_USE';
export const SERVER_AUTH_REQUIRED = 'SERVER_AUTH_REQUIRED';
export const SERVER_AUTH_INVALID = 'SERVER_AUTH_INVALID';

// --- Exit Codes ---

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGUMENTS: 2,
  CONFIG_ERROR: 3,
  LLM_UNAVAILABLE: 4,
  BUDGET_EXHAUSTED: 5,
} as const;

// --- Retry Configs ---

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterMs?: number;
}

export const RETRY_CONFIGS: Record<string, RetryConfig> = {
  network: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2, jitterMs: 500 },
  rate_limit: { maxRetries: 5, baseDelayMs: 5000, maxDelayMs: 120000, backoffMultiplier: 2, jitterMs: 2000 },
  ollama_cold_start: { maxRetries: 3, baseDelayMs: 3000, maxDelayMs: 15000, backoffMultiplier: 1.5, jitterMs: 1000 },
  parse_error: { maxRetries: 0 },
};
