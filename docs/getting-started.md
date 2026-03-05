# Getting Started with GZOO Cortex

A step-by-step guide to installing, configuring, and using Cortex.

## 1. Install

```bash
npm install -g gzoo-cortex
```

Verify it worked:

```bash
cortex --version
```

## 2. Run the Setup Wizard

```bash
cortex init
```

The wizard walks you through:

1. **Local LLM** — Do you have Ollama running? If yes, it detects your GPU and recommends a model.
2. **Cloud LLM** — Pick a provider (Anthropic, Google Gemini, Groq, OpenRouter) and paste your API key.
3. **Routing mode** — How to split work between cloud and local:
   - `cloud-first` — All tasks go to cloud. Best quality, costs money.
   - `hybrid` — Bulk tasks (extraction, ranking) go to Ollama, reasoning tasks go to cloud. Cheapest good option.
   - `local-first` — Everything goes to Ollama, cloud only as fallback. Minimal cost.
   - `local-only` — Never touches the internet. Free. Requires Ollama.
4. **Watch directories** — Which directories Cortex should monitor for file changes.
5. **Budget** — Monthly LLM spend cap (default $25).

Config is saved to `~/.cortex/cortex.config.json`. API keys go in `~/.cortex/.env`.

## 3. Register Your Projects

Tell Cortex which projects to track:

```bash
cortex projects add my-app ~/projects/my-app
cortex projects add api ~/projects/api
cortex projects add docs ~/projects/docs
```

Verify:

```bash
cortex projects list
```

## 4. Start Watching

```bash
cortex watch
```

Cortex now monitors your watch directories for file changes. When a file is saved, it:
1. Parses the file (markdown, TypeScript, JSON, YAML)
2. Extracts entities (decisions, patterns, components, etc.)
3. Infers relationships between entities
4. Detects contradictions
5. Stores everything in your local knowledge graph

Watch a specific project:

```bash
cortex watch my-app
```

Stop watching with **Ctrl+C**.

## 5. Ingest Existing Files

The watcher only picks up new changes. To ingest files that already exist:

```bash
cortex ingest "~/projects/my-app/src/**/*.ts"
cortex ingest ~/projects/my-app/README.md
```

Preview what would be extracted without writing to the DB:

```bash
cortex ingest "~/projects/my-app/docs/*.md" --dry-run
```

## 6. Query Your Knowledge

```bash
cortex query "what caching strategies am I using?"
cortex query "what decisions have I made about authentication?"
cortex query "what are the dependencies between my projects?"
```

Responses include source citations so you can trace back to the original files.

Filter to a specific project:

```bash
cortex query "what patterns does this project use?" --project my-app
```

## 7. Find Specific Entities

```bash
cortex find "PostgreSQL"
cortex find "PostgreSQL" --expand 2    # show 2 hops of relationships
cortex find "auth" --type Decision     # only decisions matching "auth"
```

## 8. Check Status

```bash
cortex status
```

Shows: entity/relationship counts, LLM provider status, budget usage, storage size.

## 9. Web Dashboard

```bash
cortex serve
```

Opens a web dashboard at `http://localhost:3710` with:
- **Dashboard** — stats, recent entities, entity type breakdown
- **Graph** — interactive knowledge graph visualization
- **Live Feed** — real-time ingestion events (shows DB stats on load)
- **Query** — natural language queries with streaming responses
- **Contradictions** — review and resolve conflicting decisions

Access from another machine on your network:

```bash
cortex serve --host 0.0.0.0
```

## 10. Manage Exclusions

Cortex ignores `node_modules`, `dist`, `.git`, and other common directories by default.

Add more exclusions:

```bash
cortex config exclude add "**/generated/**"
cortex config exclude add "**/*.min.js"
cortex config exclude add "vendor"
```

See what's excluded:

```bash
cortex config exclude list
```

Remove an exclusion:

```bash
cortex config exclude remove "vendor"
```

> **Important:** `cortex config set ingest.exclude '[...]'` **overwrites** the entire exclude list.
> Always use `cortex config exclude add` to append without losing existing patterns.

## 11. Handle Contradictions

When Cortex detects conflicting decisions across your projects:

```bash
cortex contradictions                  # list active contradictions
cortex contradictions --all            # include resolved ones
cortex resolve <id> --action supersede # the newer decision wins
cortex resolve <id> --action dismiss   # ignore this contradiction
cortex resolve <id> --action both-valid
```

## 12. Monitor Costs

```bash
cortex costs                           # this month's spending
cortex costs --period today            # today only
cortex costs --by model                # breakdown by model
cortex costs --csv                     # export for spreadsheets
```

## 13. Privacy Controls

Mark sensitive directories so they're never sent to cloud LLMs:

```bash
cortex privacy set ~/projects/client-work restricted
cortex privacy set ~/projects/internal sensitive
cortex privacy list                    # show all classifications
```

Privacy levels:
- `standard` — can be sent to cloud LLMs
- `sensitive` — sent to cloud but with extra scrubbing
- `restricted` — **never** leaves your machine, local LLM only

## Common Config Changes

```bash
cortex config set llm.mode hybrid                    # switch routing mode
cortex config set llm.budget.monthlyLimitUsd 10      # lower budget
cortex config set llm.local.model "llama3:8b"        # change Ollama model
cortex config set server.port 8080                    # change dashboard port
cortex config list                                    # see all non-default values
cortex config get ingest.exclude                      # check a specific value
```

## Environment Variables

These override config file values:

| Variable | Overrides |
|----------|-----------|
| `CORTEX_LLM_MODE` | `llm.mode` |
| `CORTEX_SERVER_PORT` | `server.port` |
| `CORTEX_DB_PATH` | `graph.dbPath` |
| `CORTEX_LOG_LEVEL` | `logging.level` |
| `CORTEX_BUDGET_LIMIT` | `llm.budget.monthlyLimitUsd` |
| `CORTEX_OLLAMA_HOST` | `llm.local.host` |

## Troubleshooting

### "Invalid argument" errors during watch
The file is too large. Exclude it:
```bash
cortex config exclude add "**/prisma/runtime/**"
```

### Watch won't stop with Ctrl+C
Upgrade to v0.2.5+. If still stuck, press Ctrl+C twice for a force exit.

### tsconfig.json fails to parse
Upgrade to v0.2.4+. JSONC comments and trailing commas are now supported.

### "API key not set" but I configured it
Upgrade to v0.2.3+. Older versions only checked for the Anthropic key variable.

### Too many log lines during watch
Upgrade to v0.2.6+, or use `--verbose` only when debugging. Log lines are suppressed by default.

### Live Feed shows 0 entities
Upgrade to v0.2.7+. The Live Feed now loads existing DB stats on page load. New events appear when files are modified while `cortex serve` is running.
