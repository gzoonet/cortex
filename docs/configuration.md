# GZOO Cortex Configuration Guide

Complete reference for configuring GZOO Cortex. All settings can be managed via config files, environment variables, or the `cortex config` CLI commands.

---

## Config File Locations

Cortex uses a layered configuration system. Settings are resolved in the following order (later sources override earlier ones):

| Priority | Location | Scope | Description |
|----------|----------|-------|-------------|
| 1 (lowest) | Built-in defaults | Global | Hardcoded sensible defaults |
| 2 | `~/.cortex/cortex.config.json` | Global | User-level config (shared across all projects) |
| 3 | `./cortex.config.json` | Project | Project-level overrides (in project root) |
| 4 (highest) | Environment variables | Session | `CORTEX_*` env vars override everything |

**API keys** are stored separately in `~/.cortex/.env` (never in config JSON files).

### File Format

Config files use JSON format. The project-level file only needs to contain the keys you want to override — it merges with the global config.

```json
{
  "ingest": {
    "maxFileSize": 200000
  },
  "llm": {
    "mode": "local"
  }
}
```

---

## Environment Variable Overrides

These environment variables override any config file setting:

| Variable | Config Equivalent | Type | Description |
|----------|-------------------|------|-------------|
| `CORTEX_LLM_MODE` | `llm.mode` | string | LLM routing mode: `cloud`, `local`, `hybrid` |
| `CORTEX_SERVER_PORT` | `server.port` | number | Web dashboard / API server port |
| `CORTEX_DB_PATH` | `graph.dbPath` | string | Path to SQLite database file |
| `CORTEX_LOG_LEVEL` | `logging.level` | string | Log level: `debug`, `info`, `warn`, `error` |
| `CORTEX_BUDGET_LIMIT` | `llm.budget.monthlyLimit` | number | Monthly cost limit in USD |
| `CORTEX_OLLAMA_HOST` | `llm.local.host` | string | Ollama server URL |
| `CORTEX_ANTHROPIC_API_KEY` | (stored in .env) | string | Anthropic API key for cloud LLM |

---

## Config Sections Reference

### ingest

Controls file watching and ingestion behavior.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ingest.watchDirs` | string[] | `["."]` | Directories to watch for file changes |
| `ingest.exclude` | string[] | (see below) | Glob patterns to exclude from watching |
| `ingest.fileTypes` | string[] | `[".md", ".ts", ".js", ".json", ".yaml", ".yml"]` | File extensions to process |
| `ingest.maxFileSize` | number | `100000` | Maximum file size in bytes (files larger than this are skipped) |
| `ingest.debounceMs` | number | `300` | Debounce delay in ms before processing a changed file |
| `ingest.batchSize` | number | `5` | Number of files to process concurrently |
| `ingest.followSymlinks` | boolean | `false` | Whether to follow symbolic links |
| `ingest.confirmCost` | boolean | `true` | Prompt for confirmation before cloud LLM calls during watch |

#### Default Exclude Patterns

The following patterns are excluded by default. Use `cortex config exclude add/remove` to modify them safely.

| Category | Patterns |
|----------|----------|
| **Package managers** | `node_modules`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` |
| **Build output** | `dist`, `build`, `out` |
| **Version control** | `.git` |
| **Minified files** | `*.min.js`, `*.min.css`, `*.map` |
| **Python** | `__pycache__`, `*.pyc` |
| **OS files** | `.DS_Store`, `Thumbs.db` |

Full default list:

```json
[
  "node_modules", "dist", "build", "out", ".git",
  "*.min.js", "*.min.css", "*.map",
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "__pycache__", "*.pyc",
  ".DS_Store", "Thumbs.db"
]
```

---

### llm

Controls LLM provider configuration, routing, budgets, and caching.

#### llm.mode

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `llm.mode` | string | `"cloud"` | Routing mode: `"cloud"`, `"local"`, or `"hybrid"` |

- **cloud** — All LLM calls go to Anthropic API (requires API key)
- **local** — All LLM calls go to Ollama (requires Ollama running)
- **hybrid** — Smart routing: uses local for cheap tasks, cloud for complex ones

#### llm.cloud

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `llm.cloud.provider` | string | `"anthropic"` | Cloud provider name |
| `llm.cloud.baseUrl` | string | `"https://api.anthropic.com"` | API base URL |
| `llm.cloud.apiKeySource` | string | `"env:CORTEX_ANTHROPIC_API_KEY"` | Where to find the API key |
| `llm.cloud.models.primary` | string | `"claude-sonnet-4-20250514"` | Primary model (reasoning, queries) |
| `llm.cloud.models.fast` | string | `"claude-haiku-4-20250414"` | Fast model (extraction, high-volume) |
| `llm.cloud.timeoutMs` | number | `30000` | Request timeout in milliseconds |
| `llm.cloud.maxRetries` | number | `3` | Maximum retry attempts on failure |

#### llm.local

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `llm.local.host` | string | `"http://localhost:11434"` | Ollama server URL |
| `llm.local.model` | string | `"mistral"` | Default model for local inference |
| `llm.local.embeddingModel` | string | `"nomic-embed-text"` | Model used for embeddings |
| `llm.local.numCtx` | number | `4096` | Context window size (tokens) |
| `llm.local.numGpu` | number | `-1` | GPU layers (-1 = auto, 0 = CPU only) |
| `llm.local.timeoutMs` | number | `120000` | Request timeout in milliseconds |

#### llm.taskRouting

Controls which model handles which task type (used in `hybrid` mode).

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `llm.taskRouting.extraction` | string | `"fast"` | Entity extraction: `"fast"` (Haiku/local) or `"primary"` |
| `llm.taskRouting.relationship` | string | `"primary"` | Relationship inference: `"fast"` or `"primary"` |
| `llm.taskRouting.query` | string | `"primary"` | Conversational queries: `"fast"` or `"primary"` |
| `llm.taskRouting.contradiction` | string | `"primary"` | Contradiction detection: `"fast"` or `"primary"` |

#### llm.budget

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `llm.budget.monthlyLimit` | number | `10.00` | Monthly spending limit in USD |
| `llm.budget.warningThreshold` | number | `0.8` | Warn when this fraction of budget is used (0.0-1.0) |
| `llm.budget.hardStop` | boolean | `true` | Stop cloud calls when budget is exhausted |

#### llm.cache

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `llm.cache.enabled` | boolean | `true` | Enable response caching |
| `llm.cache.ttlMs` | number | `86400000` | Cache TTL in milliseconds (default: 24h) |
| `llm.cache.maxEntries` | number | `1000` | Maximum cached responses |

#### llm.temperature

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `llm.temperature` | number | `0.1` | LLM temperature (0.0-1.0). Lower = more deterministic. |

---

### graph

Controls the knowledge graph database and vector store.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `graph.dbPath` | string | `"~/.cortex/cortex.db"` | Path to SQLite database file |
| `graph.vectorDbPath` | string | `"~/.cortex/vectors"` | Path to LanceDB vector store directory |
| `graph.walMode` | boolean | `true` | Enable SQLite WAL mode (recommended for performance) |
| `graph.backupOnStartup` | boolean | `false` | Create a database backup on each startup |
| `graph.softDelete` | boolean | `true` | Soft-delete entities instead of hard delete |
| `graph.mergeConfidenceThreshold` | number | `0.85` | Confidence threshold for auto-merging duplicate entities (0.0-1.0) |

---

### privacy

Controls data classification and cloud transmission behavior.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `privacy.defaultLevel` | string | `"internal"` | Default privacy level for files: `"public"`, `"internal"`, `"confidential"`, `"restricted"` |
| `privacy.directoryOverrides` | object | `{}` | Map of directory paths to privacy levels |
| `privacy.autoClassify` | boolean | `true` | Automatically detect and classify sensitive content |
| `privacy.logTransmissions` | boolean | `true` | Log all data sent to cloud APIs |

**Privacy levels (from least to most restrictive):**

| Level | Cloud allowed? | Description |
|-------|---------------|-------------|
| `public` | Yes | Open content, no restrictions |
| `internal` | Yes | Internal content, sent to cloud with standard handling |
| `confidential` | Redacted | Sensitive content — secrets are stripped before transmission |
| `restricted` | No | Never sent to cloud APIs; local-only processing |

---

### server

Controls the web dashboard and REST API server.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `server.port` | number | `3710` | Server port |
| `server.host` | string | `"localhost"` | Server bind address |
| `server.cors` | string[] | `["http://localhost:5173"]` | Allowed CORS origins |

---

### logging

Controls logging behavior.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `logging.level` | string | `"info"` | Log level: `"debug"`, `"info"`, `"warn"`, `"error"` |
| `logging.file` | string | `"~/.cortex/cortex.log"` | Path to log file |
| `logging.structured` | boolean | `true` | Use structured JSON logging |
| `logging.maxSizeMb` | number | `10` | Maximum log file size in MB before rotation |
| `logging.maxFiles` | number | `3` | Number of rotated log files to keep |

---

## Example Config File

A complete `~/.cortex/cortex.config.json` with commonly adjusted settings:

```json
{
  "ingest": {
    "watchDirs": ["."],
    "exclude": [
      "node_modules", "dist", "build", "out", ".git",
      "*.min.js", "*.min.css", "*.map",
      "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
      "__pycache__", "*.pyc",
      ".DS_Store", "Thumbs.db"
    ],
    "fileTypes": [".md", ".ts", ".js", ".json", ".yaml", ".yml"],
    "maxFileSize": 100000,
    "debounceMs": 300,
    "batchSize": 5,
    "followSymlinks": false,
    "confirmCost": true
  },
  "llm": {
    "mode": "hybrid",
    "cloud": {
      "provider": "anthropic",
      "baseUrl": "https://api.anthropic.com",
      "apiKeySource": "env:CORTEX_ANTHROPIC_API_KEY",
      "models": {
        "primary": "claude-sonnet-4-20250514",
        "fast": "claude-haiku-4-20250414"
      },
      "timeoutMs": 30000,
      "maxRetries": 3
    },
    "local": {
      "host": "http://localhost:11434",
      "model": "mistral",
      "embeddingModel": "nomic-embed-text",
      "numCtx": 4096,
      "numGpu": -1,
      "timeoutMs": 120000
    },
    "taskRouting": {
      "extraction": "fast",
      "relationship": "primary",
      "query": "primary",
      "contradiction": "primary"
    },
    "budget": {
      "monthlyLimit": 10.00,
      "warningThreshold": 0.8,
      "hardStop": true
    },
    "cache": {
      "enabled": true,
      "ttlMs": 86400000,
      "maxEntries": 1000
    },
    "temperature": 0.1
  },
  "graph": {
    "dbPath": "~/.cortex/cortex.db",
    "vectorDbPath": "~/.cortex/vectors",
    "walMode": true,
    "backupOnStartup": false,
    "softDelete": true,
    "mergeConfidenceThreshold": 0.85
  },
  "privacy": {
    "defaultLevel": "internal",
    "directoryOverrides": {
      "./secrets": "restricted",
      "./docs/public": "public"
    },
    "autoClassify": true,
    "logTransmissions": true
  },
  "server": {
    "port": 3710,
    "host": "localhost",
    "cors": ["http://localhost:5173"]
  },
  "logging": {
    "level": "info",
    "file": "~/.cortex/cortex.log",
    "structured": true,
    "maxSizeMb": 10,
    "maxFiles": 3
  }
}
```

---

## Managing Config via CLI

### Reading values

```bash
cortex config get llm.mode              # Get a single value
cortex config get llm.cloud.models      # Get a nested object
cortex config list                      # Show all config
cortex config list --json               # Show all config as JSON
```

### Setting values

```bash
cortex config set llm.mode hybrid
cortex config set server.port 8080
cortex config set llm.budget.monthlyLimit 25.00
cortex config set graph.backupOnStartup true
```

> **WARNING: Array Overwrite Behavior**
>
> `cortex config set` on array values **OVERWRITES the entire array**.
> For example:
>
> ```bash
> # DANGEROUS: This replaces ALL exclude patterns with just "*.log"
> cortex config set ingest.exclude ["*.log"]
> ```
>
> **Use `cortex config exclude add/remove` instead to safely modify arrays:**
>
> ```bash
> cortex config exclude add "*.log"      # Safe: appends to existing patterns
> cortex config exclude remove "*.map"   # Safe: removes one pattern
> cortex exclude add "*.tmp"             # Shortcut form
> ```

### Validating config

```bash
cortex config validate                  # Check for errors
```

### Resetting config

```bash
cortex config reset                     # Reset all settings to defaults
```

---

## API Keys and .env File

API keys are stored in `~/.cortex/.env`, not in config files. This file is created by `cortex init`.

```bash
# ~/.cortex/.env
CORTEX_ANTHROPIC_API_KEY=sk-ant-...
```

You can also set the API key as a regular environment variable in your shell profile.

---

## See Also

- [CLI Reference](./cli-reference.md) — Full command reference
- [Getting Started](./getting-started.md) — First-time setup walkthrough
- [Security & Privacy](./security.md) — Privacy model and threat model
