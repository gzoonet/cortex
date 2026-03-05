# GZOO Cortex CLI Reference

Complete reference for all `cortex` commands, flags, and options.

## Installation

```bash
npm install -g gzoo-cortex
```

After installation, the `cortex` command is available globally.

---

## Global Flags

These flags can be used with any command.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--config <path>` | string | — | Path to a custom config file |
| `--verbose` | boolean | false | Enable verbose/debug output |
| `--quiet` | boolean | false | Suppress all non-essential output |
| `--json` | boolean | false | Output results as JSON (machine-readable) |
| `--no-color` | boolean | false | Disable colored terminal output |
| `--version` | boolean | — | Print version number and exit |
| `--help` | boolean | — | Show help for any command |

**Examples:**

```bash
cortex --version
cortex query "what did I decide?" --json --verbose
cortex status --no-color
cortex --config ./my-config.json watch
```

---

## Commands

### cortex init

Initialize GZOO Cortex in the current directory. Creates configuration files and sets up the database.

```bash
cortex init [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--mode <mode>` | string | `cloud` | LLM routing mode: `cloud`, `local`, or `hybrid` |
| `--non-interactive` | boolean | false | Skip interactive prompts; use defaults |

**Examples:**

```bash
cortex init                       # Interactive setup wizard
cortex init --mode local          # Initialize for local-only LLM (Ollama)
cortex init --non-interactive     # Accept all defaults, no prompts
```

**What it does:**
- Creates `~/.cortex/cortex.config.json` (global config)
- Creates `~/.cortex/.env` for API keys
- Creates `./cortex.config.json` (project-level overrides)
- Initializes the SQLite database and vector store

---

### cortex watch

Start the file watcher and ingestion pipeline. Monitors configured directories for file changes and automatically extracts entities and relationships.

```bash
cortex watch [project] [options]
```

| Argument/Flag | Type | Default | Description |
|---------------|------|---------|-------------|
| `[project]` | string | current directory name | Project to watch |
| `--no-confirm` | boolean | false | Skip cost confirmation prompts |

**Examples:**

```bash
cortex watch                      # Watch current project
cortex watch my-api               # Watch a named project
cortex watch --no-confirm         # Skip cost estimates, start immediately
```

**Notes:**
- **If you are using the web dashboard (`cortex serve`), you do not need `cortex watch`.** The server includes its own file watcher. Running both at the same time will cause them to compete for file changes.
- Use `cortex watch` when you want CLI-only ingestion without the dashboard.
- Press `Ctrl+C` to stop watching.
- File changes are debounced (default 300ms) to avoid redundant processing.
- Respects exclude patterns from config (see `cortex config exclude list`).

---

### cortex query

Ask a natural language question about your knowledge graph. Returns answers with source citations.

```bash
cortex query <question> [options]
```

| Argument/Flag | Type | Default | Description |
|---------------|------|---------|-------------|
| `<question>` | string | **required** | Natural language question (quote it) |
| `--project <name>` | string | all projects | Scope query to a specific project |
| `--type <type>` | string | all types | Filter by entity type (see Entity Types below) |
| `--since <date>` | string | — | Only include entities created after this date (ISO 8601) |
| `--before <date>` | string | — | Only include entities created before this date (ISO 8601) |
| `--raw` | boolean | false | Return raw LLM response without formatting |
| `--no-stream` | boolean | false | Wait for complete response instead of streaming |

**Examples:**

```bash
cortex query "what authentication method did we choose?"
cortex query "list all API dependencies" --type Dependency
cortex query "recent architecture decisions" --since 2025-01-01
cortex query "risks in the billing module" --project billing-api --json
cortex query "summarize all patterns" --no-stream --raw
```

---

### cortex find

Look up a specific entity by name. Expands relationships by default.

```bash
cortex find <name> [options]
```

| Argument/Flag | Type | Default | Description |
|---------------|------|---------|-------------|
| `<name>` | string | **required** | Entity name or partial match |
| `--expand <depth>` | number | 1 | Relationship expansion depth (0 = no expansion) |
| `--type <type>` | string | all types | Filter by entity type |

**Examples:**

```bash
cortex find "JWT authentication"
cortex find "database" --type Component --expand 2
cortex find "rate-limit" --json
cortex find "REST API" --expand 0           # Entity only, no relationships
```

---

### cortex ingest

Manually ingest one or more files (or globs) into the knowledge graph. Useful for one-off imports or files outside watched directories.

```bash
cortex ingest <file-or-glob> [options]
```

| Argument/Flag | Type | Default | Description |
|---------------|------|---------|-------------|
| `<file-or-glob>` | string | **required** | File path or glob pattern |
| `--project <name>` | string | current directory name | Assign to a project |
| `--dry-run` | boolean | false | Show what would be ingested without processing |

**Examples:**

```bash
cortex ingest ./docs/adr-001.md
cortex ingest "./notes/**/*.md" --project my-project
cortex ingest ./meeting-notes.md --dry-run
cortex ingest ./chat-export.json --project research
```

---

### cortex status

Show a system dashboard with graph statistics, LLM status, and cost summary.

```bash
cortex status
```

**Output includes:**
- Total entities and relationships in the graph
- Entities by type breakdown
- Active projects
- LLM provider status (cloud/local connectivity)
- Current period cost usage
- Database size

**Examples:**

```bash
cortex status
cortex status --json          # Machine-readable output
```

---

### cortex costs

Show detailed LLM cost reporting.

```bash
cortex costs [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--period <period>` | string | `month` | Time period: `day`, `week`, `month`, `all` |
| `--by <grouping>` | string | `model` | Group costs by: `model`, `task`, `project`, `day` |
| `--csv` | boolean | false | Export as CSV format |

**Examples:**

```bash
cortex costs
cortex costs --period week --by task
cortex costs --period all --by project --csv > costs.csv
cortex costs --by day --json
```

---

### cortex serve

Start the web dashboard, REST API server, and file watcher. This is the recommended way to run Cortex — it combines the dashboard with automatic file watching, so you do not need `cortex watch` separately.

```bash
cortex serve [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--port <port>` | number | 3710 | Server port |
| `--host <host>` | string | `localhost` | Server host/bind address |
| `--no-watch` | boolean | false | Start server without file watching |

**Examples:**

```bash
cortex serve                          # Start at http://localhost:3710
cortex serve --port 8080
cortex serve --host 0.0.0.0          # Expose to network (use with caution)
cortex serve --no-watch              # Dashboard only, no file watching
```

---

### cortex projects

Manage tracked projects.

```bash
cortex projects <subcommand> [args]
```

| Subcommand | Arguments | Description |
|------------|-----------|-------------|
| `list` | — | List all tracked projects |
| `add <path>` | path to project directory | Add a project to track |
| `remove <name>` | project name | Remove a project from tracking |
| `show <name>` | project name | Show details for a project |

**Examples:**

```bash
cortex projects list
cortex projects add /home/user/my-api
cortex projects remove old-prototype
cortex projects show billing-api --json
```

---

### cortex contradictions

List detected contradictions in the knowledge graph. Contradictions are found when entities or decisions conflict with each other.

```bash
cortex contradictions [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--all` | boolean | false | Include resolved contradictions |
| `--severity <level>` | string | all | Filter by severity: `low`, `medium`, `high` |

**Examples:**

```bash
cortex contradictions
cortex contradictions --all
cortex contradictions --severity high --json
```

---

### cortex resolve

Resolve a detected contradiction by choosing an action.

```bash
cortex resolve <id> [options]
```

| Argument/Flag | Type | Default | Description |
|---------------|------|---------|-------------|
| `<id>` | string | **required** | Contradiction ID (from `cortex contradictions`) |
| `--action <action>` | string | **required** | Resolution action (see table below) |

**Resolution actions:**

| Action | Description |
|--------|-------------|
| `supersede` | The newer entity supersedes the older one |
| `dismiss` | Dismiss the contradiction as a false positive |
| `keep-old` | Keep the older entity, mark the newer one as outdated |
| `both-valid` | Both entities are valid (different contexts) |

**Examples:**

```bash
cortex resolve abc123 --action supersede
cortex resolve def456 --action both-valid
cortex resolve ghi789 --action dismiss
```

---

### cortex config

Read, write, and validate configuration.

```bash
cortex config <subcommand> [args]
```

| Subcommand | Arguments | Description |
|------------|-----------|-------------|
| `get <key>` | config key (dot notation) | Get a config value |
| `set <key> <value>` | config key and value | Set a config value |
| `list` | — | Show all current config values |
| `reset` | — | Reset config to defaults |
| `validate` | — | Validate current config against schema |

> **WARNING: Array Overwrite Behavior**
>
> `cortex config set` on array values **OVERWRITES the entire array**.
> For example, running:
>
> ```bash
> cortex config set ingest.exclude ["*.log"]
> ```
>
> will **replace all existing exclude patterns** with just `*.log` — every default
> pattern (`node_modules`, `dist`, `.git`, etc.) will be lost.
>
> **To safely add or remove individual items from arrays, use these commands instead:**
>
> ```bash
> cortex config exclude add "*.log"      # Appends to the array
> cortex config exclude remove "*.map"   # Removes from the array
> ```
>
> This warning applies to any array-typed config value.

**Examples:**

```bash
cortex config get llm.mode
cortex config set llm.mode hybrid
cortex config set server.port 8080
cortex config list
cortex config list --json
cortex config validate
cortex config reset                   # Reset ALL config to defaults
```

#### cortex config exclude

Manage the `ingest.exclude` array safely without overwriting.

```bash
cortex config exclude <subcommand> [pattern]
```

| Subcommand | Arguments | Description |
|------------|-----------|-------------|
| `list` | — | Show current exclude patterns |
| `add <pattern>` | glob pattern | Add an exclude pattern |
| `remove <pattern>` | glob pattern | Remove an exclude pattern |

**Shortcut:** `cortex exclude add <pattern>` works as an alias for `cortex config exclude add <pattern>`.

**Examples:**

```bash
cortex config exclude list
cortex config exclude add "*.log"
cortex config exclude add "vendor/**"
cortex config exclude remove "*.map"

# Shortcut form:
cortex exclude add "*.tmp"
```

---

### cortex privacy

Manage privacy settings and view cloud transmission logs.

```bash
cortex privacy <subcommand> [args]
```

| Subcommand | Arguments | Description |
|------------|-----------|-------------|
| `set <path> <level>` | directory path, privacy level | Set privacy level for a directory |
| `list` | — | List all privacy overrides |
| `log` | — | Show cloud transmission log |

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--last <n>` | number | 20 | Number of log entries to show (for `log` subcommand) |

**Privacy levels:** `public`, `internal`, `confidential`, `restricted`

**Examples:**

```bash
cortex privacy set ./secrets restricted
cortex privacy set ./docs public
cortex privacy list
cortex privacy log
cortex privacy log --last 50
```

---

### cortex models

Manage local LLM models (Ollama integration).

```bash
cortex models <subcommand> [args]
```

| Subcommand | Arguments | Description |
|------------|-----------|-------------|
| `list` | — | List available models (local and cloud) |
| `pull <model>` | model name | Pull/download a model via Ollama |
| `test <model>` | model name | Run a quick test on a model |
| `info <model>` | model name | Show model details (size, parameters, etc.) |

**Examples:**

```bash
cortex models list
cortex models pull mistral
cortex models pull llama3.2
cortex models test mistral
cortex models info mistral --json
```

---

### cortex report

Show ingestion reports and processing history.

```bash
cortex report [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--failed` | boolean | false | Show only failed ingestion attempts |

**Examples:**

```bash
cortex report
cortex report --failed
cortex report --json
```

---

### cortex mcp

Start GZOO Cortex as an MCP (Model Context Protocol) server. This allows AI assistants like Claude to use Cortex as a tool.

```bash
cortex mcp [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--config-dir <path>` | string | `~/.cortex` | Path to Cortex config directory |

**Examples:**

```bash
cortex mcp
cortex mcp --config-dir /path/to/config
```

**MCP tools exposed:**
- `query_cortex` — Natural language queries against the knowledge graph
- `find_entity` — Direct entity lookup
- `get_status` — System status
- `list_projects` — List tracked projects

---

### cortex db

Database maintenance commands.

```bash
cortex db <subcommand> [options]
```

| Subcommand | Arguments | Description |
|------------|-----------|-------------|
| `clean` | — | Remove orphaned records and optimize database |
| `reset` | — | Delete all data and reinitialize (destructive!) |
| `prune` | — | Remove soft-deleted entities older than 30 days |

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--force` | boolean | false | Skip confirmation prompts (required for `reset`) |

**Examples:**

```bash
cortex db clean
cortex db prune
cortex db reset --force              # WARNING: deletes all data
```

---

## Entity Types

These are the entity types that Cortex extracts and tracks:

| Type | Description |
|------|-------------|
| `Decision` | Architectural or design decisions |
| `Requirement` | Functional or non-functional requirements |
| `Pattern` | Recurring design or code patterns |
| `Component` | System components, services, or modules |
| `Dependency` | External libraries, APIs, or services |
| `Interface` | APIs, contracts, or integration points |
| `Constraint` | Technical or business constraints |
| `ActionItem` | Tasks, TODOs, or follow-ups |
| `Risk` | Identified risks or concerns |
| `Note` | General notes and observations |

Use with the `--type` flag on `query` and `find` commands.

---

## Relationship Types

These are the relationship types between entities:

| Type | Description |
|------|-------------|
| `depends_on` | Entity A depends on Entity B |
| `implements` | Entity A implements Entity B |
| `contradicts` | Entity A contradicts Entity B |
| `evolved_from` | Entity A is an evolution of Entity B |
| `relates_to` | General relationship between entities |
| `uses` | Entity A uses Entity B |
| `constrains` | Entity A constrains Entity B |
| `resolves` | Entity A resolves Entity B |
| `documents` | Entity A documents Entity B |
| `derived_from` | Entity A is derived from Entity B |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CORTEX_ANTHROPIC_API_KEY` | Anthropic API key for cloud LLM |
| `CORTEX_LLM_MODE` | Override LLM mode (`cloud`, `local`, `hybrid`) |
| `CORTEX_SERVER_PORT` | Override server port |
| `CORTEX_DB_PATH` | Override database path |
| `CORTEX_LOG_LEVEL` | Override log level (`debug`, `info`, `warn`, `error`) |
| `CORTEX_BUDGET_LIMIT` | Override monthly budget limit (USD) |
| `CORTEX_OLLAMA_HOST` | Ollama server URL (default: `http://localhost:11434`) |

---

## See Also

- [Configuration Guide](./configuration.md) — Full config file reference
- [Getting Started](./getting-started.md) — First-time setup walkthrough
- [API Contracts](./api-contracts.md) — REST API and WebSocket reference
