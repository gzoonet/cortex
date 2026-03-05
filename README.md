# GZOO Cortex

**Local-first knowledge graph for developers.** Watches your project files,
extracts entities and relationships using LLMs, and lets you query across
all your projects in natural language.

> “What architecture decisions have I made across projects?”
>
> Cortex finds decisions from your READMEs, TypeScript files, config files,
> and conversation exports — then synthesizes an answer with source citations.

## Why

You work on multiple projects. Decisions, patterns, and context are scattered
across hundreds of files. You forget what you decided three months ago. You
re-solve problems you already solved in another repo.

Cortex watches your project directories, extracts knowledge automatically,
and gives it back to you when you need it.

## What It Does

- **Watches** your project files (md, ts, js, json, yaml) for changes
- **Extracts** entities: decisions, patterns, components, dependencies, constraints, action items
- **Infers** relationships between entities across projects
- **Detects** contradictions when decisions conflict
- **Queries** in natural language with source citations
- **Routes** intelligently between cloud and local LLMs
- **Respects** privacy — restricted projects never leave your machine
- **Web dashboard** with knowledge graph visualization, live feed, and query explorer
- **MCP server** for direct integration with Claude Code

## Quick Start

### Install

```bash
npm install -g @gzoo/cortex
```

### Setup

```bash
cortex init                                # interactive setup wizard
cortex projects add my-app ~/projects/app  # register a project
cortex projects add api ~/projects/api     # add more projects
```

### Watch & Query

```bash
cortex watch                               # start watching for changes
cortex query "what caching strategies am I using?"
cortex query "what decisions have I made about authentication?"
cortex find "PostgreSQL" --expand 2
cortex contradictions
```

### Web Dashboard

```bash
cortex serve                               # open http://localhost:3710
```

## How It Works

Cortex runs a pipeline on every file change:

1. **Parse** — file content is chunked by a language-aware parser (tree-sitter for code, remark for markdown)
2. **Extract** — LLM identifies entities (decisions, components, patterns, etc.)
3. **Relate** — LLM infers relationships between new and existing entities
4. **Detect** — contradictions and duplicates are flagged automatically
5. **Store** — entities, relationships, and vectors go into SQLite + LanceDB
6. **Query** — natural language queries search the graph and synthesize answers

All data stays local in `~/.cortex/`. Only LLM API calls leave your machine
(and never for restricted projects).

## LLM Providers

Cortex is **provider-agnostic**. It supports:

- **Anthropic Claude** (Sonnet, Haiku) — via native Anthropic API
- **Google Gemini** — via OpenAI-compatible API
- **Any OpenAI-compatible API** — OpenRouter, local proxies, etc.
- **Ollama** (Mistral, Llama, etc.) — fully local, no cloud required

### Routing Modes

| Mode | Cloud Cost | Quality | GPU Required |
|------|-----------|---------|--------------|
| `cloud-first` | Varies by provider | Highest | No |
| `hybrid` | Reduced | High | Yes (Ollama) |
| `local-first` | Minimal | Good | Yes (Ollama) |
| `local-only` | $0 | Good | Yes (Ollama) |

Hybrid mode routes high-volume tasks (entity extraction, ranking) to Ollama
and reasoning-heavy tasks (relationship inference, queries) to your cloud provider.

## Requirements

- **Node.js** 20+
- **LLM API key** for cloud modes — Anthropic, Google Gemini, or any OpenAI-compatible provider
- **Ollama** (for hybrid/local modes) — [install](https://ollama.ai/)

## Configuration

```bash
cortex config list                       # see all settings
cortex config set llm.mode hybrid        # switch routing mode
cortex config set llm.budget.monthlyLimitUsd 10  # set budget
cortex privacy set ~/clients restricted  # mark directory as restricted
```

Full configuration reference: [docs/config.md](docs/config.md)

## Commands

| Command | Description |
|---------|-------------|
| `cortex init` | Interactive setup wizard |
| `cortex projects add <name> [path]` | Register a project directory |
| `cortex projects list` | List registered projects |
| `cortex watch [project]` | Start watching for file changes |
| `cortex query <question>` | Natural language query with citations |
| `cortex find <term>` | Find entities by name |
| `cortex ingest <file-or-glob>` | One-shot file ingestion |
| `cortex status` | Graph stats, costs, provider status |
| `cortex costs` | Detailed cost breakdown |
| `cortex contradictions` | List active contradictions |
| `cortex resolve <id>` | Resolve a contradiction |
| `cortex models list/pull/test/info` | Manage Ollama models |
| `cortex serve` | Start web dashboard (localhost:3710) |
| `cortex mcp` | Start MCP server for Claude Code |
| `cortex report` | Post-ingestion summary |
| `cortex privacy set <dir> <level>` | Set directory privacy |
| `cortex config list/get/set` | Read/write configuration |
| `cortex db` | Database operations |

Full CLI reference: [docs/cli-commands.md](docs/cli-commands.md)

## Web Dashboard

Run `cortex serve` to open a full web dashboard at `http://localhost:3710` with:

- **Dashboard Home** — graph stats, recent activity, entity type breakdown
- **Knowledge Graph** — interactive D3-force graph with clustering, click to explore
- **Live Feed** — real-time file change and entity extraction events via WebSocket
- **Query Explorer** — natural language queries with streaming responses
- **Contradiction Resolver** — review and resolve conflicting decisions

## MCP Server (Claude Code Integration)

Cortex includes an MCP server so Claude Code can query your knowledge graph directly:

```bash
claude mcp add cortex --scope user -- node /path/to/packages/mcp/dist/index.js
```

This gives Claude Code 4 tools: `get_status`, `list_projects`, `find_entity`, `query_cortex`.

## Architecture

Monorepo with eight packages:

- **@cortex/core** — types, EventBus, config loader, error classes
- **@cortex/ingest** — file parsers (tree-sitter + remark), chunker, watcher, pipeline
- **@cortex/graph** — SQLite store, LanceDB vectors, query engine
- **@cortex/llm** — Anthropic/Gemini/OpenAI-compatible/Ollama providers, router, prompts, cache
- **@cortex/cli** — Commander.js CLI with 17 commands
- **@cortex/mcp** — Model Context Protocol server (stdio transport)
- **@cortex/server** — Express REST API + WebSocket relay
- **@cortex/web** — React + Vite + D3 web dashboard

Architecture docs: [docs/](docs/)

## Privacy & Security

- Files classified as `restricted` are **never** sent to cloud LLMs
- Sensitive files (.env, .pem, .key) are auto-detected and blocked
- API key secrets are scanned and redacted before any cloud transmission
- All data stored locally in `~/.cortex/` — nothing phones home

Full security architecture: [docs/security.md](docs/security.md)

## Built With

- [SQLite](https://sqlite.org/) via better-sqlite3 — entity and relationship storage
- [LanceDB](https://lancedb.com/) — vector embeddings for semantic search
- [Anthropic Claude](https://anthropic.com/) — cloud LLM provider
- [Google Gemini](https://ai.google.dev/) — cloud LLM provider (via OpenAI-compatible API)
- [Ollama](https://ollama.ai/) — local LLM inference
- [tree-sitter](https://tree-sitter.github.io/) — language-aware file parsing
- [Chokidar](https://github.com/paulmillr/chokidar) — cross-platform file watching
- [Commander.js](https://github.com/tj/commander.js/) — CLI framework
- [React](https://react.dev/) + [Vite](https://vite.dev/) — web dashboard
- [D3](https://d3js.org/) — knowledge graph visualization

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE)

## About

Built by [GZOO](https://gzoo.ai) — an AI-powered business automation platform.

Cortex started as an internal tool to maintain context across multiple
client projects. We open-sourced it because every developer who works on
more than one thing loses context, and we think this approach — automatic
file watching + knowledge graph + natural language queries — is the right
way to solve it.
