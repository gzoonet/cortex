# GZOO Cortex Configuration

> Config file: `cortex.config.json` in project root or `~/.cortex/`
> Resolution order: CLI flag > env var > config file > default
> Validated with Zod on startup and on every `cortex config set`.

## Full Default Config

```json
{
  "$schema": "https://cortex.gzoo.net/schema/v1/config.json",
  "version": "1.0",
  "ingest": {
    "watchDirs": ["."],
    "exclude": [
      "node_modules", "dist", "build", "out", ".git",
      "*.min.js", "*.min.css", "*.map",
      "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
      "__pycache__", "*.pyc", ".DS_Store", "Thumbs.db"
    ],
    "fileTypes": ["md", "ts", "tsx", "js", "jsx", "json", "yaml", "yml"],
    "maxFileSize": 10485760,
    "maxFilesPerDir": 10000,
    "maxTotalFiles": 50000,
    "debounceMs": 500,
    "parseTimeoutMs": 30000,
    "batchSize": 5,
    "followSymlinks": false,
    "confirmCost": true
  },
  "graph": {
    "dbPath": "~/.cortex/cortex.db",
    "vectorDbPath": "~/.cortex/vector.lance",
    "walMode": true,
    "backupOnStartup": true,
    "integrityCheckInterval": "weekly",
    "softDelete": true,
    "mergeConfidenceThreshold": 0.85
  },
  "llm": {
    "mode": "cloud-first",
    "taskRouting": {
      "entity_extraction": "auto",
      "relationship_inference": "auto",
      "contradiction_detection": "auto",
      "conversational_query": "auto",
      "context_ranking": "auto",
      "embedding_generation": "local"
    },
    "temperature": { "extraction": 0.1, "chat": 0.7, "ranking": 0.1, "proactive": 0.5 },
    "maxContextTokens": 50000,
    "cache": { "enabled": true, "ttlDays": 7, "maxSizeMb": 500 },
    "budget": {
      "monthlyLimitUsd": 25,
      "warningThresholds": [0.5, 0.8, 0.9],
      "enforcementAction": "fallback-local"
    },
    "local": {
      "provider": "ollama",
      "host": "http://localhost:11434",
      "model": "mistral:7b-instruct-q5_K_M",
      "embeddingModel": "nomic-embed-text",
      "numCtx": 8192,
      "numGpu": -1,
      "timeoutMs": 60000,
      "keepAlive": "5m"
    },
    "cloud": {
      "provider": "anthropic",
      "apiKeySource": "env:CORTEX_ANTHROPIC_API_KEY",
      "models": {
        "primary": "claude-sonnet-4-5-20250929",
        "fast": "claude-haiku-4-5-20251001"
      },
      "timeoutMs": 30000,
      "maxRetries": 3,
      "promptCaching": true
    }
  },
  "privacy": {
    "defaultLevel": "standard",
    "directoryOverrides": {},
    "autoClassify": true,
    "logTransmissions": true,
    "showTransmissionIndicator": true,
    "secretPatterns": [
      "(?i)(api[_-]?key|secret[_-]?key|access[_-]?token)\\s*[:=]\\s*[\\w\\-]{20,}",
      "AKIA[0-9A-Z]{16}",
      "sk-ant-[a-zA-Z0-9\\-]{40,}",
      "ghp_[a-zA-Z0-9]{36}",
      "(?i)password\\s*[:=]\\s*\\S{8,}"
    ]
  },
  "server": {
    "port": 3710,
    "host": "127.0.0.1",
    "cors": ["http://localhost:5173"]
  },
  "logging": {
    "level": "info",
    "file": "~/.cortex/logs/cortex.log",
    "structured": true,
    "maxSizeMb": 10,
    "maxFiles": 5,
    "redactPrompts": false
  }
}
```

## Environment Variable Overrides

| Variable | Overrides | Example |
|---|---|---|
| `CORTEX_LLM_MODE` | `llm.mode` | `hybrid` |
| `CORTEX_ANTHROPIC_API_KEY` | Cloud API key | `sk-ant-...` |
| `CORTEX_SERVER_PORT` | `server.port` | `4000` |
| `CORTEX_DB_PATH` | `graph.dbPath` | `/data/cortex.db` |
| `CORTEX_LOG_LEVEL` | `logging.level` | `debug` |
| `CORTEX_BUDGET_LIMIT` | `llm.budget.monthlyLimitUsd` | `50` |
| `CORTEX_OLLAMA_HOST` | `llm.local.host` | `http://gpu-box:11434` |
| `CORTEX_CONFIG_PATH` | Config file location | `/etc/cortex/config.json` |

## API Key Source Formats

- `env:VAR_NAME` → read from environment variable (recommended)
- `keychain:ENTRY` → read from OS keychain (Phase 3)
- `file:PATH` → read from file (must be chmod 600)
- **NEVER** store raw keys in config file. Detect and warn on startup.

## Cross-Field Validation Rules

1. If `llm.mode` is `cloud-first` or `hybrid`, cloud API key must be configured
2. If `server.host` is not `127.0.0.1`, `server.auth.enabled` must be `true`
3. If `llm.maxContextTokens` > model's context window, auto-reduce with warning
4. If `llm.mode` is `local-only` and budget > 0, info message (no error)

## Routing Mode → Task Provider Mapping

| Task | cloud-first | hybrid | local-first | local-only |
|---|---|---|---|---|
| entity_extraction | cloud (Haiku) | local | local | local |
| relationship_inference | cloud (Sonnet) | cloud (Sonnet) | local* | local |
| contradiction_detection | cloud (Sonnet) | cloud (Sonnet) | local* | local |
| conversational_query | cloud (Sonnet) | cloud (Sonnet) | local* | local |
| context_ranking | local | local | local | local |
| embedding_generation | local | local | local | local |

*local-first: escalates to cloud when local confidence < 0.6
