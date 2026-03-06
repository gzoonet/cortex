# GZOO Cortex Security & Privacy

## Data Classification

| Level | Badge | Cloud Behavior | Applied To |
|---|---|---|---|
| `standard` | — | Full content sent per routing table | Default for all dirs |
| `sensitive` | 🟡 | Only entity names/types/metadata to cloud. Full text local. | `cortex privacy set <dir> sensitive` |
| `restricted` | 🔒 | **BLOCKED. Zero data to cloud. Ever.** | `cortex privacy set <dir> restricted` |

Classification is per-directory, inherited by files. Most restrictive wins.

### Auto-Classification (always upgrades, never downgrades)

> **Status: Planned.** Auto-classification is not yet implemented. Files matching these patterns are excluded from ingestion (see Auto-Excluded list below), but privacy levels are not automatically assigned based on file type. Use `cortex privacy set <dir> <level>` to classify manually.

- `.env*`, `*.pem`, `*.key` → `restricted`
- `*.sqlite`, `*.db` → `sensitive`
- `docker-compose*.yml` with env vars → `sensitive`

## Pre-Transmission Pipeline

**Runs BEFORE every cloud API call, in order:**

1. **Privacy check:** Is content from restricted/sensitive directory? → Block or redact
2. **Secret scan:** Regex patterns for AWS keys, Anthropic keys, GitHub tokens, passwords, connection strings → Replace with `[SECRET_REDACTED]`
3. **PII detection:** Email, phone, SSN, credit card patterns → Replace with `[PII_REDACTED]`
4. **Size validation:** Max 50KB payload per request

If any check fails critically, the request is **blocked** (not queued, not retried to cloud).

> **Implementation status:**
> - Step 1 (privacy check): Enforced during ingestion and query paths. `restricted` entities are excluded from query context entirely. `sensitive` entities have their `content` redacted to `[REDACTED]` before being sent to cloud LLMs. Applies to all query entry points (REST API, CLI, MCP).
> - Step 2 (secret scan): `secretPatterns` are defined in config but **not applied** before cloud transmission. Planned.
> - Step 3 (PII detection): Planned for future release.
> - Step 4 (size validation): Not yet implemented.

## Sensitive Content Redaction

When `sensitive` content needs cloud processing, send a redacted version:

```typescript
interface RedactedEntity {
  name: string;           // kept
  type: EntityType;       // kept
  summary: string;        // kept (metadata level)
  content: '[REDACTED]';  // replaced
  properties: {};         // stripped
}
```

## Transmission Logging

> **Status: Planned.** Transmission logging is not yet implemented. The `cortex privacy log` command exists but returns empty results. The interface below describes the target design.

Every cloud API call will be logged to `~/.cortex/transmission.log` (chmod 600):

```typescript
interface TransmissionLogEntry {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  task: LLMTask;
  requestSizeBytes: number;
  sourceFiles: string[];
  privacyLevels: string[];
  redactionsApplied: number;
  secretsDetected: number;
  status: 'sent' | 'blocked' | 'error';
}
```

Will be viewable via `cortex privacy log`.

## File System Security

### Auto-Excluded from Ingestion
`node_modules/`, `.git/objects/`, `dist/`, `build/`, `out/`, `.env*`, `*.key`, `*.pem`, `*.min.js`, `*.min.css`, `package-lock.json`, `yarn.lock`, `__pycache__/`, `*.pyc`, `.DS_Store`, `Thumbs.db`, `~/.cortex/*.db`

### Permissions

> **Status: Partially implemented.** `cortex.config.json` is written with `600` permissions. Directory and DB permissions are not yet explicitly set — they inherit from umask. Backup files (`cortex.db.backup`) do not have explicit permissions. See [issue #12](https://github.com/gzoonet/cortex/issues/12).

- `~/.cortex/` directory: `700` *(planned)*
- `cortex.db`: `600` *(planned)*
- `cortex.config.json`: `600` *(implemented)*
- `transmission.log`: `600` *(planned — logging not yet implemented)*
- Log files: `600` *(planned)*

### Resource Limits
- Max file size: 10MB (configurable)
- Max files per directory: 10,000
- Max total watched files: 50,000
- Max parse time per file: 30s
- Max LLM extraction time: 60s
- Max context window per query: 50,000 tokens

## Network Security

### Outbound (allowed)
- `https://api.anthropic.com` (Anthropic API)
- `https://api.openai.com` (OpenAI API)
- `http://localhost:11434` (Ollama, local only)

### Zero telemetry
No analytics, no update checks, no phone-home. Ever.

### Inbound
- REST API: `127.0.0.1:3710` (localhost only by default)
- WebSocket: `127.0.0.1:3710`
- **Authentication:** Bearer token auth on all `/api/v1/*` routes and WebSocket connections. Enforced automatically when `server.host` is non-localhost. Can be enabled explicitly via `server.auth.enabled = true` or `CORTEX_SERVER_AUTH_TOKEN` env var. Tokens are compared using `timingSafeEqual`. When serving on a non-localhost host without a configured token, one is auto-generated and saved to `~/.cortex/.env`.
- WebSocket auth uses query string: `ws://host:port/ws?token=<token>`
- No rate limiting on API endpoints yet. See [issue #9](https://github.com/gzoonet/cortex/issues/9).

## API Key Management

Priority: OS Keychain > Environment Variable > File reference > Raw in config (warn)

> **Implementation status:**
> - `env:VAR_NAME` format: Implemented and recommended.
> - OS Keychain (`keychain:ENTRY`): Planned for future release.
> - File reference (`file:PATH`): Planned for future release.
> - Raw key detection/warning: Not yet implemented. Raw keys in `apiKeySource` silently fail (return `undefined`). See [issue #15](https://github.com/gzoonet/cortex/issues/15).
> - Startup API key validation via minimal API call: Implemented in `isAvailable()`, but this incurs real API cost on every call without caching. See [issue #11](https://github.com/gzoonet/cortex/issues/11).

## Prompt Injection Mitigation

1. **Structured output:** JSON schema + Zod validation rejects non-conforming output
2. **Content isolation:** `---CONTENT START---` / `---CONTENT END---` delimiters
3. **Output validation:** Entity types from enum, confidence 0.0-1.0, relationship types valid
4. **No execution:** Code is stored as text summaries, never executed
