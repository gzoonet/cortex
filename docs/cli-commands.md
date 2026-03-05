# GZOO Cortex CLI Commands

> All commands: `packages/cli/src/commands/<name>.ts`
> Framework: Commander.js. Entry: `packages/cli/src/index.ts`
> Global flags apply to all commands.

## Global Flags

| Flag | Type | Default | Description |
|---|---|---|---|
| `--config <path>` | string | (auto-detect) | Config file path |
| `--verbose` | boolean | false | Show debug-level output |
| `--quiet` | boolean | false | Suppress all non-error output |
| `--json` | boolean | false | Output as JSON (for scripting) |
| `--no-color` | boolean | false | Disable color output |
| `--version` | boolean | | Show version |
| `--help` | boolean | | Show help |

---

## cortex init (Phase 1)

Interactive setup wizard. Creates `cortex.config.json`.

**Flags:**
| Flag | Default | Description |
|---|---|---|
| `--mode <mode>` | (prompt) | cloud-first, hybrid, local-first, local-only |
| `--non-interactive` | false | Use defaults, no prompts (for CI) |

**Interactive flow:**
1. Select routing mode → sets `llm.mode`
2. Enter API key (if cloud mode) → stored as env var reference
3. Select directories to watch → sets `ingest.watchDirs`
4. Set monthly budget → sets `llm.budget.monthlyLimitUsd`
5. Write `cortex.config.json` (chmod 600)
6. Add to `.gitignore`

---

## cortex watch (Phase 1)

Start file watcher + ingestion pipeline.

**Subcommands:** `add <dir>`, `remove <dir>`, `list`, `pause`, `resume`

**Flags:**
| Flag | Default | Description |
|---|---|---|
| `--no-confirm` | false | Skip cost confirmation for bulk ingestion |

**Behavior:**
1. Load config, validate
2. Initialize SQLite + LanceDB
3. Scan watched directories → identify new/changed/deleted files
4. If new files > 10: show cost estimate, confirm (unless `--no-confirm`)
5. Parse files → chunk content → extract entities via LLM → store in graph
6. Start Chokidar watcher for ongoing changes
7. Display progress bar during bulk ingestion

**Output format:**
```
Watching 3 directories (347 files)
New: 12 | Changed: 3 | Deleted: 0

Ingesting 15 files...
  Parsing:     ████████████████████ 15/15
  Extracting:  ████████████░░░░░░░░ 9/15  (est. $2.40)
  Relationships: pending...

✓ Ingestion complete: 47 entities, 128 relationships ($2.35)
⚡ Watching for changes (Ctrl+C to stop)
```

---

## cortex query (Phase 1)

Natural language query with citations.

**Usage:** `cortex query "<question>" [flags]`

**Flags:**
| Flag | Default | Description |
|---|---|---|
| `--project <name>` | (all) | Filter to specific project |
| `--type <type>` | (all) | Filter entity type |
| `--since <date>` | | Only entities after date |
| `--before <date>` | | Only entities before date |
| `--raw` | false | Show debug info (context assembly, token counts) |
| `--no-stream` | false | Wait for full response instead of streaming |

**Pipeline:**
1. Generate embedding for query → semantic search → candidate entities
2. Context ranking (P6 prompt) → select top entities
3. Assemble context window with entity content + relationships
4. Conversational synthesis (P5 prompt) → streaming response
5. Follow-up generation (P7 prompt) → suggest next questions

**Output format:**
```
Based on your codebase, Stripe was chosen for payment processing in BookFlow
because of its Connect platform for marketplace payments [source:e4f2a1b3].
This decision was made in the original architecture phase and hasn't been
revisited, though there's a note about evaluating Square for in-person
terminals [source:a7c3b2d1].

Follow-ups:
  → What alternatives to Stripe were considered?
  → How is Stripe Connect configured in BookFlow?
  → Are there any Stripe-related action items?
```

---

## cortex find (Phase 1)

Direct entity lookup with relationship expansion.

**Usage:** `cortex find <name-or-id> [flags]`

**Flags:**
| Flag | Default | Description |
|---|---|---|
| `--expand <depth>` | 0 | Show N hops of relationships (0=entity only, 1=direct, 2=2-hop) |
| `--type <type>` | (all) | Filter entity type |

---

## cortex status (Phase 1)

Full system dashboard.

**Output format:**
```
CORTEX STATUS
─────────────────────────────
Graph:     1,247 entities | 3,891 relationships | 2 contradictions
Projects:  3 watched (bookflow, taskrunner, gzoo)
Files:     347 tracked | 2 in dead letter queue
Storage:   48.2 MB (SQLite) | 124.6 MB (vectors)

LLM:       ✓ Anthropic (Claude Sonnet 4.5 / Haiku 4.5)
Mode:      cloud-first
Cost:      $12.45 / $25.00 this month (49.8%)

Status:    ✓ Fully operational
Uptime:    2h 14m | Last activity: 3 minutes ago
```

---

## cortex costs (Phase 1)

Detailed cost reporting.

**Flags:**
| Flag | Default | Description |
|---|---|---|
| `--period <period>` | month | today, week, month, all |
| `--by <grouping>` | task | task, model, provider, day |
| `--csv` | false | Export as CSV |

---

## cortex config (Phase 1)

**Subcommands:**
- `get <key>` → Print value
- `set <key> <value>` → Validate and write
- `list` → Show all non-default values
- `reset [key]` → Reset to default (all if no key)
- `validate` → Check config without starting system

---

## cortex privacy (Phase 1)

**Subcommands:**
- `set <directory> <level>` → Set privacy level (standard/sensitive/restricted)
- `list` → Show all directory classifications
- `log [--last N]` → Show transmission audit log

---

## cortex contradictions (Phase 1 — display only)

List active contradictions. `cortex resolve` for resolution (also Phase 1).

---

## cortex resolve (Phase 1)

**Usage:** `cortex resolve <contradiction-id> --action <action>`

**Actions:** `supersede` (newer wins), `dismiss` (ignore), `keep-old`, `both-valid`
