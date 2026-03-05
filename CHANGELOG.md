# Changelog

All notable changes to GZOO Cortex will be documented in this file.

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
