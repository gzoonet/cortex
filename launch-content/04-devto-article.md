---
title: "I Got Tired of Losing Context Between Projects, So I Built a Knowledge Graph"
published: false
tags: typescript, ai, opensource, developer-tools
---

# I Got Tired of Losing Context Between Projects, So I Built a Knowledge Graph

I run a consultancy. At any given time I'm working on 4-5 different projects. Three months into project B, I need to remember what I decided about authentication in project A. The answer is somewhere in my files — a README, a design doc, a conversation export — but I have no idea where.

I tried grep. I tried notes apps. I tried "just remember better." None of it worked at scale.

So I built **GZOO Cortex** — a local-first knowledge graph that watches your project files, extracts entities and relationships using LLMs, and lets you query across everything in natural language.

## How It Works

Cortex runs a pipeline on every file change:

1. **Parse** — tree-sitter for code, remark for markdown. Language-aware chunking.
2. **Extract** — LLM identifies entities: decisions, patterns, components, dependencies, constraints.
3. **Relate** — LLM infers relationships between new entities and everything already in the graph.
4. **Detect** — contradictions and duplicates are flagged automatically.
5. **Store** — entities, relationships, and vector embeddings go into SQLite + LanceDB.
6. **Query** — natural language queries assemble relevant context and synthesize answers with source citations.

The key insight: your project files already contain the knowledge. You just need something that reads them, understands the structure, and makes it queryable.

## The Architecture

It's a TypeScript monorepo with 8 packages:

- **@cortex/core** — shared types, EventBus (inter-package communication), config loader, error classes
- **@cortex/ingest** — Chokidar file watcher, parsers (Markdown, TypeScript, JSON, YAML, conversation exports), chunker
- **@cortex/graph** — SQLite store for entities/relationships, LanceDB for vector embeddings, FTS5 query engine
- **@cortex/llm** — provider abstraction (Anthropic, Gemini, OpenAI-compatible, Ollama), smart router, prompt templates, response cache
- **@cortex/cli** — Commander.js CLI with 17 commands
- **@cortex/mcp** — MCP server for Claude Code integration
- **@cortex/server** — Express REST API + WebSocket relay
- **@cortex/web** — React + Vite + D3 web dashboard

Packages communicate only via the EventBus — no direct cross-package imports. All LLM calls go through the Router, which runs the privacy pipeline before every cloud request.

## Provider-Agnostic LLM Routing

This was a deliberate design choice. Cortex doesn't lock you into any LLM provider:

- **Anthropic Claude** (Sonnet for reasoning, Haiku for extraction)
- **Google Gemini** (via OpenAI-compatible API)
- **Any OpenAI-compatible API** (OpenRouter, local proxies, etc.)
- **Ollama** (Mistral, Llama, etc.) — fully local, no cloud required

The Router supports four modes:

| Mode | How it works |
|------|-------------|
| cloud-first | Everything goes to your cloud provider |
| hybrid | High-volume tasks (extraction) -> Ollama, reasoning (queries) -> cloud |
| local-first | Default to Ollama, escalate to cloud when confidence < 0.6 |
| local-only | Everything local. $0 cloud cost. |

In practice, I run hybrid mode. Entity extraction runs locally on Mistral 7B and the quality is surprisingly good — structured output parsing handles most variance. Relationship inference and natural language queries go to the cloud provider where the reasoning matters more.

## Privacy Is Not Optional

When you're working on client projects, privacy matters. Cortex has a three-tier classification:

- **standard** — full content sent to cloud LLM
- **sensitive** — content sent with secrets redacted (regex-based scanning)
- **restricted** — zero data leaves your machine. Ever.

Files like `.env`, `.pem`, `.key` are auto-classified as restricted regardless of directory settings. Every cloud API call is logged to a transmission audit log.

## The Web Dashboard

`cortex serve` starts a React dashboard at localhost:3710 with five views:

- **Dashboard Home** — graph stats, recent activity, entity type breakdown
- **Knowledge Graph** — interactive D3-force graph with smart clustering
- **Live Feed** — real-time file change and entity extraction events via WebSocket
- **Query Explorer** — natural language queries with streaming responses
- **Contradiction Resolver** — review and resolve conflicting decisions

The knowledge graph visualization uses D3-force with automatic clustering: no clustering under 100 nodes, type-based clustering under 500, and type+directory clustering above 500.

## MCP Server for Claude Code

This is the feature I use most. Cortex includes an MCP server that gives Claude Code direct access to your knowledge graph:

```bash
claude mcp add cortex --scope user -- node /path/to/packages/mcp/dist/index.js
```

Four tools: `get_status`, `list_projects`, `find_entity`, `query_cortex`.

Instead of Claude guessing about your project, it can look up what you actually decided. Real decisions from real files, with citations.

## What I Learned Building It

**Structured output from LLMs is more reliable than I expected.** With good prompt engineering and JSON schema validation (Zod), you can get consistent entity extraction even from smaller models.

**The hard part isn't extraction — it's relationships.** Getting an LLM to identify that "we chose JWT for auth" in file A relates to "the auth module uses token-based validation" in file B requires genuine reasoning. This is where cloud models still win.

**FTS5 is underrated.** SQLite's full-text search handles most queries without needing vector search. Vector similarity is useful for semantic matching, but keyword search with good tokenization covers 80% of use cases.

**File watching is a solved problem.** Chokidar just works. The real complexity is in the pipeline: debouncing, deduplication, content hashing to skip unchanged files, and dead letter queues for failed ingestions.

## Try It

```bash
npm install -g @gzoo/cortex
cortex init
cortex watch
cortex query "what architecture decisions have I made?"
```

It's MIT licensed. The code is at [github.com/gzoonet/cortex](https://github.com/gzoonet/cortex).

I've been using it daily for months on real client projects. It genuinely changed how I work — I query past decisions instead of grep-ing through repos or trying to remember.

If you work on more than one project, give it a shot. I'd love to hear what you think.
