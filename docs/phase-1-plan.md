# Phase 1 Build Plan

> **Start here.** This is the exact order to build Phase 1.
> Each step produces working, testable code. Don't skip ahead.

## Prerequisites

- Node.js 20+
- npm 10+
- `CORTEX_ANTHROPIC_API_KEY` environment variable set
- No GPU needed. No Ollama needed. Cloud-first mode.

---

## Step 1: Monorepo Scaffold

**Create the monorepo structure with npm workspaces.**

```
cortex/
├── package.json              ← workspace root
├── tsconfig.base.json        ← shared TypeScript config (strict mode)
├── packages/
│   ├── core/package.json     ← @cortex/core
│   ├── ingest/package.json   ← @cortex/ingest (depends on core)
│   ├── graph/package.json    ← @cortex/graph (depends on core)
│   ├── llm/package.json      ← @cortex/llm (depends on core)
│   └── cli/package.json      ← @cortex/cli (depends on all)
```

**Root package.json:**
```json
{
  "name": "cortex",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "dev": "npm run dev --workspace=packages/cli"
  }
}
```

**tsconfig.base.json:** Enable `strict: true`, `module: "ESNext"`, `target: "ES2022"`, `moduleResolution: "bundler"`. Use project references.

**Test:** `npm install` succeeds, `npx tsc --build` succeeds.

---

## Step 2: Core Package — Types + EventBus + Errors

**Files to create:**

1. `packages/core/src/types/entity.ts` — Entity, EntityType, ExtractionMetadata
2. `packages/core/src/types/relationship.ts` — Relationship, RelationshipType
3. `packages/core/src/types/project.ts` — Project
4. `packages/core/src/types/file.ts` — FileRecord
5. `packages/core/src/types/llm.ts` — LLMTask, LLMRequest, LLMResponse, LLMProvider, CompletionOptions, RoutingConstraints
6. `packages/core/src/types/events.ts` — CortexEvent, EventBus interface
7. `packages/core/src/types/config.ts` — CortexConfig (full Zod schema)
8. `packages/core/src/types/index.ts` — re-export everything
9. `packages/core/src/events/event-bus.ts` — EventBus class (emit/on/off/once)
10. `packages/core/src/errors/cortex-error.ts` — CortexError class + all error codes as const enum
11. `packages/core/src/config/loader.ts` — Load config: CLI flag → env → file → defaults. Validate with Zod.
12. `packages/core/src/config/schema.ts` — Complete Zod schema for cortex.config.json
13. `packages/core/src/index.ts` — re-export

**Specs:** `docs/types.md`, `docs/config.md`, `docs/errors.md`

**Test:** Types compile. EventBus emit/on/off works. Config loader validates and rejects bad config. CortexError has all codes.

---

## Step 3: Graph Package — SQLite Store

**Files to create:**

1. `packages/graph/src/sqlite-store.ts` — GraphStore implementation using better-sqlite3
2. `packages/graph/src/migrations/001-initial.ts` — SQL schema (see `docs/api-contracts.md`)
3. `packages/graph/src/vector-store.ts` — LanceDB wrapper (create table, add vectors, search)
4. `packages/graph/src/query-engine.ts` — Context assembly: given a query, find relevant entities via FTS + vector search, assemble context window
5. `packages/graph/src/index.ts`

**Dependencies:** `better-sqlite3`, `@lancedb/lancedb`

**Key behaviors:**
- WAL mode on by default
- Foreign keys ON
- Backup on startup (copy db file)
- Soft delete (mark deleted_at, exclude from queries)
- FTS5 virtual table synced with entities table (triggers or manual sync)
- Upsert files by path (content_hash change = re-ingest)

**Test:** Create entity → read back. Create relationship → query by entity. FTS search. Upsert file with changed hash. Vector search returns nearest neighbors. Stats are accurate.

---

## Step 4: LLM Package — Anthropic Provider + Prompts

**Files to create:**

1. `packages/llm/src/providers/anthropic.ts` — Anthropic provider implementing LLMProvider interface
2. `packages/llm/src/prompts/entity-extraction.ts` — P1 prompt (system, user template, Zod schema, config)
3. `packages/llm/src/prompts/relationship-inference.ts` — P2 prompt
4. `packages/llm/src/prompts/contradiction-detection.ts` — P4 prompt
5. `packages/llm/src/prompts/conversational-query.ts` — P5 prompt (streaming)
6. `packages/llm/src/prompts/context-ranking.ts` — P6 prompt
7. `packages/llm/src/prompts/follow-up-generation.ts` — P7 prompt
8. `packages/llm/src/prompts/merge-detection.ts` — P3 prompt
9. `packages/llm/src/router.ts` — Phase 1: simple pass-through to Anthropic. Wraps all calls with token tracking, cost calculation, caching.
10. `packages/llm/src/cache.ts` — Response cache keyed on content_hash + prompt_hash. SQLite table.
11. `packages/llm/src/output-parser.ts` — Strip fences, find JSON, parse, validate with Zod, retry once on failure
12. `packages/llm/src/token-tracker.ts` — Record usage, calculate costs, budget tracking
13. `packages/llm/src/index.ts`

**Dependencies:** `@anthropic-ai/sdk`, `zod`

**Anthropic provider specifics:**
- Use `tool_use` for structured output where possible (better JSON compliance)
- Enable `prompt_caching` for system prompts
- Map tasks to models: extraction/ranking → Haiku, reasoning/chat → Sonnet
- Streaming via `stream()` method for conversational queries

**Test:** Extract entities from a sample markdown file → valid JSON matching schema. Relationship inference between 5 entities → valid relationships. Cache hit on identical request. Token usage recorded. Budget tracking increments correctly.

---

## Step 5: Ingest Package — Parsers + Watcher

**Files to create:**

1. `packages/ingest/src/parsers/markdown.ts` — Parse markdown into sections (headings, paragraphs, code blocks, lists)
2. `packages/ingest/src/parsers/typescript.ts` — Parse TS/JS via tree-sitter (functions, classes, interfaces, exports, comments)
3. `packages/ingest/src/parsers/json-parser.ts` — Parse JSON (package.json, tsconfig, etc.)
4. `packages/ingest/src/parsers/yaml-parser.ts` — Parse YAML/YML
5. `packages/ingest/src/parsers/index.ts` — Parser registry: extension → parser mapping
6. `packages/ingest/src/chunker.ts` — Split parsed content into chunks (2,000 tokens, 200 token overlap, split on section boundaries)
7. `packages/ingest/src/watcher.ts` — Chokidar wrapper with debouncing, exclude patterns, file type filtering
8. `packages/ingest/src/pipeline.ts` — Full ingestion pipeline: file → parse → chunk → extract entities → infer relationships → store in graph
9. `packages/ingest/src/index.ts`

**Dependencies:** `chokidar`, `tree-sitter`, `tree-sitter-typescript`, `unified`, `remark-parse`, `yaml`

**Pipeline flow:**
```
file changed
  → check exclusions (glob match)
  → check file size
  → read + detect encoding
  → parse with appropriate parser
  → chunk content (2K tokens, 200 overlap)
  → for each chunk: LLM entity extraction
  → deduplicate entities across chunks
  → LLM relationship inference (batch entities)
  → store entities + relationships in graph
  → update file record (content_hash, entity_ids, status)
  → emit events (entity.created, relationship.created, file.ingested)
```

**Test:** Parse a real markdown file → structured sections. Parse a real TypeScript file → functions/interfaces extracted. Chunker produces correct overlapping chunks. Full pipeline: markdown file → entities in database → relationships in database.

---

## Step 6: CLI Package — All Phase 1 Commands

**Files to create:**

1. `packages/cli/src/index.ts` — Commander.js program with global flags
2. `packages/cli/src/commands/init.ts` — Interactive setup wizard
3. `packages/cli/src/commands/watch.ts` — Start watcher + ingestion + progress display
4. `packages/cli/src/commands/query.ts` — Natural language query with streaming + citations
5. `packages/cli/src/commands/find.ts` — Entity lookup with relationship expansion
6. `packages/cli/src/commands/status.ts` — System dashboard
7. `packages/cli/src/commands/costs.ts` — Cost reporting
8. `packages/cli/src/commands/config.ts` — get/set/list/reset/validate
9. `packages/cli/src/commands/privacy.ts` — set/list/log
10. `packages/cli/src/commands/contradictions.ts` — List contradictions
11. `packages/cli/src/commands/resolve.ts` — Resolve contradiction
12. `packages/cli/src/formatting/` — Shared terminal formatting (colors, tables, progress bars)

**Dependencies:** `commander`, `chalk`, `ora` (spinner), `cli-table3` (tables), `inquirer` (prompts for init)

**Specs:** See `docs/cli-commands.md` for exact flags, output formats, and behaviors.

**Test:** `cortex init --non-interactive` creates valid config. `cortex config validate` passes. `cortex status --json` returns valid JSON.

---

## Step 7: Integration Testing

**End-to-end tests:**

1. `cortex init --non-interactive --mode cloud-first` → config file created
2. Copy test fixtures (5 markdown + 3 TypeScript files) to temp dir
3. `cortex watch --no-confirm` → files parsed, entities extracted, relationships created
4. `cortex status` → shows entity/relationship counts
5. `cortex query "What decisions were made?"` → returns answer with citations
6. `cortex find "ComponentName"` → returns entity with relationships
7. `cortex costs` → shows non-zero cost for cloud calls
8. Modify a file → watcher detects change → re-ingestion occurs
9. `cortex query --json` → valid JSON response for scripting

---

## Step 8: Polish + README

1. Write `README.md` with installation, quickstart, examples
2. Add `bin` entry to CLI package.json for `cortex` command
3. Add `npm link` instructions for local development
4. Create test fixtures directory with realistic sample files
5. Add npm scripts: `build`, `test`, `dev`, `lint`

---

## Definition of Done (Phase 1)

- [ ] `npm install && npm run build` succeeds with zero errors
- [ ] `cortex init` creates valid config interactively
- [ ] `cortex watch` ingests 50+ files with progress bar and cost display
- [ ] `cortex query` returns cited, relevant answers via streaming
- [ ] `cortex find` returns entity with expanded relationships
- [ ] `cortex status` shows accurate graph stats and costs
- [ ] `cortex costs` shows per-task and per-model breakdown
- [ ] `cortex config validate` catches bad config
- [ ] `cortex privacy set/list/log` works
- [ ] File watcher detects changes with 500ms debounce
- [ ] Budget warnings at 50%, 80%, 90% thresholds
- [ ] All errors use CortexError with typed codes
- [ ] Pre-transmission privacy check blocks restricted content
- [ ] Secret scanning redacts API keys in outbound content
- [ ] Response caching avoids duplicate LLM calls
- [ ] Dead letter queue captures and reprocesses failures
