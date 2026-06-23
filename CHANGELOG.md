# Changelog

All notable changes to GZOO Cortex will be documented in this file.

## [0.7.1] - 2026-06-23

### Security

- **`cortex config`** — `get`/`list`/`set` no longer print the cloud API key (when stored inline) or the server auth token; `env:VAR_NAME` references remain visible since they name an env var, not a credential (CWE-312/319/532).
- **`cortex doctor`** — no longer echoes the configured `apiKeySource`; the "Cloud API key" check reports presence only (fixes CodeQL `js/clear-text-logging`, CWE-312).
- **`cortex serve`** — no longer prints the generated auth token to stdout; it is saved to `~/.cortex/.env` and the command points there instead.
- **Dashboard auth** — the SPA route only embeds the bearer token for a request that already proves possession of it (`Authorization: Bearer` or `?token=`). Anonymous requests no longer receive the token, closing an auth bypass where any unauthenticated client could scrape it from the dashboard HTML (CWE-312/522). For remote dashboards, open once with `?token=<token>`; the token is then persisted per-tab via `sessionStorage`.
- **CORS** — no longer reflects arbitrary `localhost:*` origins; only the configured `server.cors` origins are allowed (CWE-346/942).

### Fixed

- **Dashboard** — the Knowledge Graph view now sends the auth token with its `/api/v1/graph` request (via `authHeaders()`), like every other view. Previously it relied on a reverse proxy injecting the token for it, so it failed once the API was properly secured.
- **Dependencies** — upgrade `vite` 8.0.7 → 8.0.16 (web dev tooling) and `form-data` → 4.0.6, clearing Dependabot advisories GHSA-fx2h-pf6j-xcff, GHSA-v6wh-96g9-6wx3, and GHSA-hmw2-7cc7-3qxx.

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
