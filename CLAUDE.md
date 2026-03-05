# CLAUDE.md — GZOO Cortex Project Instructions

> **Read this file on every session.** It is the single source of truth for working on GZOO Cortex.
> Detailed specs live in `/docs/` — reference them before implementing any component.

## What Is GZOO Cortex

GZOO Cortex is a **local-first knowledge orchestrator** that watches your project files, extracts entities and relationships using LLMs, stores them in a knowledge graph, and lets you query your own decisions, patterns, and context via natural language CLI and web interface.

**Core value prop:** You work across 5+ projects. GZOO Cortex remembers what you decided, why, and where — so you never lose context switching between projects.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20+ with TypeScript (strict mode) | Fast I/O, native file watching |
| Database | SQLite via better-sqlite3 (WAL mode) | Zero-config, single-file, fast |
| Vector DB | LanceDB (embedded) | Columnar vectors, no server |
| LLM (Cloud) | Anthropic Claude Sonnet 4.5 / Haiku 4.5 | Primary cloud provider |
| LLM (Local) | Ollama + Mistral 7B | Local inference for hybrid/local modes |
| File Watching | Chokidar | Battle-tested, cross-platform |
| Parsing | tree-sitter (code), unified/remark (markdown) | AST-level extraction |
| CLI | Commander.js + Ink (React for terminals) | Rich interactive CLI |
| Web UI | React + Vite | Localhost dashboard |
| Monorepo | npm workspaces | Simple, no extra tooling |

## Monorepo Structure

```
cortex/
├── CLAUDE.md                    ← YOU ARE HERE
├── package.json                 ← root workspace config
├── tsconfig.base.json           ← shared TypeScript config
├── packages/
│   ├── core/                    ← shared types, event bus, config, errors
│   │   └── src/
│   │       ├── types/           ← ALL TypeScript interfaces (see docs/types.md)
│   │       ├── events/          ← EventBus implementation
│   │       ├── config/          ← Config loader + Zod validation
│   │       └── errors/          ← CortexError class + error codes
│   ├── ingest/                  ← file watcher, parsers, chunker
│   │   └── src/
│   │       ├── watcher.ts       ← Chokidar wrapper
│   │       ├── parsers/         ← markdown, typescript, json, yaml, conversation parsers
│   │       └── chunker.ts       ← content splitting for LLM context
│   ├── graph/                   ← SQLite store, LanceDB vectors, query engine
│   │   └── src/
│   │       ├── sqlite-store.ts  ← entity/relationship CRUD
│   │       ├── vector-store.ts  ← LanceDB embedding storage
│   │       └── query-engine.ts  ← context assembly for LLM queries
│   ├── llm/                     ← LLM provider abstraction, prompts
│   │   └── src/
│   │       ├── providers/       ← anthropic.ts, ollama.ts
│   │       ├── prompts/         ← versioned prompt templates (see docs/prompts.md)
│   │       ├── router.ts        ← smart routing (cloud, hybrid, local-first, local-only)
│   │       └── cache.ts         ← response caching
│   ├── cli/                     ← all CLI commands
│   │   └── src/
│   │       ├── commands/        ← init, watch, query, find, status, costs, config, etc.
│   │       └── index.ts         ← Commander.js entry point
│   ├── mcp/                     ← MCP server (stdio transport)
│   │   └── src/
│   │       └── index.ts         ← 4 tools: get_status, list_projects, find_entity, query_cortex
│   ├── server/                  ← Express API backend for web dashboard
│   └── web/                     ← React dashboard (Vite)
├── docs/                        ← SPEC FILES (read before implementing)
│   ├── types.md                 ← ALL TypeScript interfaces
│   ├── prompts.md               ← ALL LLM prompts with schemas
│   ├── api-contracts.md         ← REST API, WebSocket, event bus contracts
│   ├── cli-commands.md          ← Every CLI command spec
│   ├── config.md                ← Full config schema + defaults
│   ├── errors.md                ← Error codes, recovery, degradation chain
│   └── security.md              ← Privacy model, threat model, data classification
└── tests/
    ├── unit/
    └── integration/
```

## Architecture Rules

1. **Packages communicate via the EventBus only.** No direct imports between packages except `@cortex/core` types.
2. **All LLM calls go through the Router** (`packages/llm/src/router.ts`). No package calls a provider directly.
3. **Privacy check runs before every cloud API call.** See `docs/security.md` for the pre-transmission pipeline.
4. **Every entity and relationship has a source trail.** `sourceFile`, `sourceRange`, `extractedBy` (prompt+model+version).
5. **Errors use CortexError class** with typed codes. See `docs/errors.md` for the full registry.
6. **Config validated with Zod schemas.** See `docs/config.md` for every field.

## Core Functionality

The system delivers a complete pipeline: **ingest files, extract entities/relationships via LLM, store in knowledge graph, query via CLI or web dashboard.**

### CLI Commands

- `cortex init` — Interactive setup (routing mode, API key, directories)
- `cortex watch` — Start file watcher + ingestion pipeline (with live contradiction alerts)
- `cortex query "<question>"` — Natural language query with citations
- `cortex find <name>` — Direct entity lookup with relationship expansion
- `cortex status` — System dashboard (graph stats, LLM status, costs, local provider info)
- `cortex costs` — Detailed cost reporting
- `cortex config` — Read/write/validate configuration
- `cortex privacy` — Privacy classification management
- `cortex contradictions` — View detected contradictions
- `cortex resolve` — Resolve contradictions
- `cortex projects` — List tracked projects
- `cortex ingest <file>` — One-shot file ingestion (`--project`, `--dry-run`)
- `cortex models list/pull/test/info` — Manage Ollama models
- `cortex serve` — Start web dashboard (default port 3710)

### LLM Routing Modes

| Mode | Behavior |
|------|----------|
| `cloud-first` | All tasks go to Anthropic API |
| `hybrid` | Entity extraction via Ollama, reasoning tasks via cloud |
| `local-first` | Prefer Ollama, escalate to cloud if confidence < 0.6 |
| `local-only` | All tasks use Ollama, no cloud calls ever |

Task routing:
- Entity extraction → Ollama (hybrid/local modes) or Claude Haiku (cloud)
- Relationship inference → Claude Sonnet (reasoning-heavy)
- Contradiction detection → Claude Sonnet (except restricted projects → Ollama)
- Context ranking → Ollama (local preferred)
- Conversational queries → Claude Sonnet (streaming)
- Embeddings → local via LanceDB built-in or Ollama nomic-embed-text
- Budget exhausted → all tasks auto-route to Ollama

### MCP Server

The MCP server (`packages/mcp`) exposes 4 tools via stdio transport for use with Claude Code and other MCP clients:
- `get_status` — System status
- `list_projects` — Tracked projects
- `find_entity` — Entity lookup
- `query_cortex` — Natural language query

### Web Dashboard

`cortex serve` starts an Express API + React SPA at `localhost:3710` with 5 views:
- Dashboard Home — overview and stats
- Knowledge Graph — D3-force visualization with smart clustering
- Live Feed — real-time events via WebSocket
- Query Explorer — natural language queries in the browser
- Contradictions — view and manage detected contradictions

## Coding Standards

- **TypeScript strict mode.** No `any` types. No `ts-ignore`.
- **Zod for all external data validation** (config files, LLM responses, API inputs).
- **No classes for data.** Use interfaces + plain objects. Classes only for services (EventBus, SQLiteStore, etc.).
- **Async/await everywhere.** No callbacks. No `.then()` chains.
- **Error handling:** Wrap external calls in try/catch. Throw `CortexError` with typed codes. Never throw raw `Error`.
- **Logging:** Use the structured logger from `@cortex/core`. Never `console.log` in production code.
- **Tests:** Unit tests for parsers, prompt output validation, config validation. Integration tests for the full ingest-extract-store pipeline.
- **No lodash/underscore.** Use native Array methods. Keep dependencies minimal.
- **File size limit:** No single file over 400 lines. Split into focused modules.

## Key Spec Files (Read Before Coding)

| Before building... | Read this spec |
|---|---|
| Any TypeScript interface | `docs/types.md` |
| Any LLM prompt or extraction | `docs/prompts.md` |
| Any CLI command | `docs/cli-commands.md` |
| Config loading or validation | `docs/config.md` |
| Error handling or recovery | `docs/errors.md` |
| Privacy checks or API calls | `docs/security.md` |
| REST API or WebSocket | `docs/api-contracts.md` |

## Quick Reference: Entity Types

`Decision`, `Requirement`, `Pattern`, `Component`, `Dependency`, `Interface`, `Constraint`, `ActionItem`, `Risk`, `Note`

## Quick Reference: Relationship Types

`depends_on`, `implements`, `contradicts`, `evolved_from`, `relates_to`, `uses`, `constrains`, `resolves`, `documents`, `derived_from`

## Quick Reference: Error Code Format

`LAYER_CATEGORY_DETAIL` — e.g., `LLM_PROVIDER_UNAVAILABLE`, `INGEST_PARSE_FAILED`, `GRAPH_DB_ERROR`

Layers: `INGEST`, `GRAPH`, `LLM`, `INTERFACE`, `CONFIG`, `PRIVACY`
