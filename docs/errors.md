# GZOO Cortex Error Handling

> All errors use `CortexError` class from `@cortex/core`. Format: `LAYER_CATEGORY_DETAIL`.

## CortexError Class

```typescript
class CortexError extends Error {
  constructor(
    public readonly code: string,
    public readonly severity: 'critical' | 'high' | 'medium' | 'low',
    public readonly layer: 'ingest' | 'graph' | 'llm' | 'interface' | 'config' | 'privacy',
    message: string,
    public readonly context?: Record<string, unknown>,
    public readonly recoveryAction?: string,
    public readonly retryable: boolean = false,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'CortexError';
  }
}
```

## Retry Config

```typescript
const RETRY_CONFIGS = {
  network:          { maxRetries: 3, baseDelayMs: 1000,  maxDelayMs: 30000,  backoffMultiplier: 2, jitterMs: 500 },
  rate_limit:       { maxRetries: 5, baseDelayMs: 5000,  maxDelayMs: 120000, backoffMultiplier: 2, jitterMs: 2000 },
  ollama_cold_start:{ maxRetries: 3, baseDelayMs: 3000,  maxDelayMs: 15000,  backoffMultiplier: 1.5, jitterMs: 1000 },
  parse_error:      { maxRetries: 0 }, // not retryable
};
```

## Complete Error Registry

### Ingest Layer

| Code | Severity | Retryable | Behavior |
|---|---|---|---|
| `INGEST_PARSE_FAILED` | Medium | No (auto on file save) | Skip file, add to DLQ, continue pipeline |
| `INGEST_FILE_TOO_LARGE` | Low | No | Skip with warning. Not added to DLQ. |
| `INGEST_WATCHER_ERROR` | High | Yes (60s interval, 5x) | Pause affected dir watcher, retry. Others continue. |
| `INGEST_PERMISSION_DENIED` | Low | No (auto on permission change) | Skip file, may be intentional |
| `INGEST_UNSUPPORTED_TYPE` | Low | No | Skip file silently |
| `INGEST_ENCODING_ERROR` | Low | No | Skip file, warn |
| `INGEST_TIMEOUT` | Medium | No | Skip file, add to DLQ |

### LLM Layer

| Code | HTTP | Severity | Retryable | Behavior |
|---|---|---|---|---|
| `LLM_PROVIDER_UNAVAILABLE` | 503 | High | Yes (30s health check) | Fallback to other provider. Queue tasks. |
| `LLM_EXTRACTION_FAILED` | 500 | Medium | Yes (1x with correction prompt) | Retry once, then DLQ |
| `LLM_CONTEXT_OVERFLOW` | 413 | Medium | No | Trim context by relevance, retry |
| `LLM_RATE_LIMITED` | 429 | Medium | Yes (Retry-After header) | Backoff, continue local, auto-reduce batch |
| `LLM_BUDGET_EXHAUSTED` | 402 | High | No | Switch all tasks to local |
| `LLM_AUTH_FAILED` | 401 | Critical | No | Exit with code 4, suggest key rotation |
| `LLM_MODEL_NOT_FOUND` | 404 | High | No | Warn, suggest `ollama pull` |
| `LLM_TIMEOUT` | 504 | Medium | Yes | Retry per network config |

### Graph Layer

| Code | HTTP | Severity | Behavior |
|---|---|---|---|
| `GRAPH_DB_ERROR` | 500 | Critical | Map SQLite error to guidance. SQLITE_BUSY: retry 3x/100ms. |
| `GRAPH_ENTITY_NOT_FOUND` | 404 | Low | Check merge log for redirect, else 404 |
| `GRAPH_RELATIONSHIP_INVALID` | 400 | Low | Orphan reference, log warning |
| `GRAPH_VECTOR_ERROR` | 500 | High | Fallback to keyword FTS search |
| `GRAPH_MERGE_CONFLICT` | 409 | Medium | Log, require manual resolution |
| `GRAPH_INTEGRITY_ERROR` | 500 | High | Run repair, log orphans |

### Privacy / Config / Interface

| Code | Severity | Behavior |
|---|---|---|
| `PRIVACY_VIOLATION` | Critical | **BLOCK transmission. Never retry to cloud.** Re-route to local. |
| `PRIVACY_SECRET_DETECTED` | Medium | Redact secret, log, continue |
| `CONFIG_INVALID` | Critical | Collect all errors, display, exit code 3 |
| `CONFIG_MISSING` | Critical | Prompt `cortex init`, exit code 3 |
| `INTERFACE_PORT_IN_USE` | High | Show blocking process, exit code 1 |

## Graceful Degradation Chain

```
Level 0: Full capability (all providers available)
Level 1: Cloud unavailable → all tasks to local, quality reduced for reasoning
Level 2: Local unavailable → all tasks to cloud, cost increases
Level 3: Both down → serve cached results, queue new tasks, graph queries still work
Level 4: Database error → read-only mode
Level 5: Fatal → clean shutdown with exit code
```

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Configuration error |
| 4 | LLM unavailable (auth failed, no provider) |
| 5 | Budget exhausted |
