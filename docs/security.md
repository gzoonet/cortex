# GZOO Cortex Security & Privacy

## Data Classification

| Level | Badge | Cloud Behavior | Applied To |
|---|---|---|---|
| `standard` | — | Full content sent per routing table | Default for all dirs |
| `sensitive` | 🟡 | Only entity names/types/metadata to cloud. Full text local. | `cortex privacy set <dir> sensitive` |
| `restricted` | 🔒 | **BLOCKED. Zero data to cloud. Ever.** | `cortex privacy set <dir> restricted` |

Classification is per-directory, inherited by files. Most restrictive wins.

### Auto-Classification (always upgrades, never downgrades)
- `.env*`, `*.pem`, `*.key` → `restricted`
- `*.sqlite`, `*.db` → `sensitive`
- `docker-compose*.yml` with env vars → `sensitive`

## Pre-Transmission Pipeline

**Runs BEFORE every cloud API call, in order:**

1. **Privacy check:** Is content from restricted/sensitive directory? → Block or redact
2. **Secret scan:** Regex patterns for AWS keys, Anthropic keys, GitHub tokens, passwords, connection strings → Replace with `[SECRET_REDACTED]`
3. **PII detection (Phase 3):** Email, phone, SSN, credit card patterns → Replace with `[PII_REDACTED]`
4. **Size validation:** Max 50KB payload per request

If any check fails critically, the request is **blocked** (not queued, not retried to cloud).

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

Every cloud API call is logged to `~/.cortex/transmission.log` (chmod 600):

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

Viewable via `cortex privacy log`.

## File System Security

### Auto-Excluded from Ingestion
`node_modules/`, `.git/objects/`, `dist/`, `build/`, `out/`, `.env*`, `*.key`, `*.pem`, `*.min.js`, `*.min.css`, `package-lock.json`, `yarn.lock`, `__pycache__/`, `*.pyc`, `.DS_Store`, `Thumbs.db`, `~/.cortex/*.db`

### Permissions
- `~/.cortex/` directory: `700`
- `cortex.db`: `600`
- `cortex.config.json`: `600`
- `transmission.log`: `600`
- Log files: `600`

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

### Inbound (Phase 3)
- REST API: `127.0.0.1:3710` (localhost only by default)
- WebSocket: `127.0.0.1:3710`
- If `server.host` changed from localhost: require `server.auth.enabled = true`

## API Key Management

Priority: OS Keychain > Environment Variable > File reference > Raw in config (warn)

On startup: validate API key with minimal API call. Exit code 4 if invalid.
If raw key detected in config: warn on every startup, offer migration to env var.

## Prompt Injection Mitigation

1. **Structured output:** JSON schema + Zod validation rejects non-conforming output
2. **Content isolation:** `---CONTENT START---` / `---CONTENT END---` delimiters
3. **Output validation:** Entity types from enum, confidence 0.0-1.0, relationship types valid
4. **No execution:** Code is stored as text summaries, never executed
