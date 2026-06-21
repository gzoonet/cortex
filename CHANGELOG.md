# Changelog

All notable changes to GZOO Cortex will be documented in this file.

## [0.7.0] - 2026-06-21

### Added

- **`cortex doctor`** — health checks for config schema, API keys, provider reachability, registered projects, and database
- **Python parser** — tree-sitter support for `.py` files
- **Layered config** — global `~/.cortex/cortex.config.json` merged with optional project `./cortex.config.json`
- **Remote dashboard auth** — bearer token injected into HTML for API/WebSocket calls behind reverse proxies

### Changed

- **`cortex init`** — writes global config to `~/.cortex/cortex.config.json` by default
- **Cloud-first routing** — no silent Ollama dependency; cloud provider required unless budget fallback is enabled
- **Cost estimation** — provider-aware rates for DeepSeek, Gemini, Groq, and OpenRouter (not Anthropic fallback)
- **`cortex serve`** — file watcher uses `ignoreInitial`; run `cortex ingest` to backfill existing files
- **MCP server** — expanded from 4 to 12 tools

## [0.1.0] - 2026-03-04

### Added

- **Core:** EventBus, config loader with Zod validation, structured error classes
- **Ingest:** File watcher (Chokidar), parsers for Markdown, TypeScript, JSON, YAML, conversation exports
- **Graph:** SQLite entity/relationship store, LanceDB vector embeddings, FTS5 query engine
- **LLM:** Provider abstraction for Anthropic Claude, Google Gemini, OpenAI-compatible APIs, and Ollama
- **LLM:** Smart hybrid routing — high-volume tasks to local, reasoning to cloud
- **LLM:** Privacy pipeline — restricted files never sent to cloud, secret scanning + redaction
- **LLM:** Budget tracking with monthly limits and automatic fallback
- **CLI:** 17 commands — init, watch, query, find, status, costs, config, privacy, contradictions, resolve, ingest, models, serve, mcp, report, db, projects
- **MCP:** Model Context Protocol server for Claude Code integration (4 tools)
- **Web:** React + Vite dashboard with 5 views — Dashboard Home, Knowledge Graph (D3-force), Live Feed (WebSocket), Query Explorer, Contradiction Resolver
- **Server:** Express REST API + WebSocket relay for real-time events
- **Detection:** Automatic merge detection and contradiction detection post-ingestion
- **Confidence:** Local-first confidence escalation — retry on cloud when local confidence < 0.6
