# Reddit Posts

Post to each subreddit separately. Adjust the angle for each community.

---

## r/programming

**Title:** I built a local-first knowledge graph that watches your project files and lets you query across projects in natural language

I work on multiple projects and kept losing context between them — what did I decide about authentication in one project? What caching pattern am I using in another?

So I built GZOO Cortex. It watches your project directories, parses files with tree-sitter (code) and remark (markdown), extracts entities (decisions, patterns, components, dependencies) using LLMs, stores everything in SQLite + LanceDB, and lets you query across all your projects.

The architecture is a TypeScript monorepo with 8 packages: core (EventBus, config, types), ingest (file watching + parsing), graph (SQLite + vector store), llm (provider abstraction + routing), cli (17 commands), mcp (Claude Code integration), server (Express API + WebSocket), web (React + D3 dashboard).

What makes it interesting technically:
- Provider-agnostic LLM routing — supports Anthropic, Gemini, OpenAI-compatible APIs, and Ollama
- Hybrid mode routes high-volume tasks to local Ollama and reasoning to cloud
- Privacy pipeline scans and redacts secrets before any cloud call
- Contradiction detection flags when decisions conflict across projects
- All data stays local in ~/.cortex/

MIT licensed. GitHub: https://github.com/gzoonet/cortex

---

## r/selfhosted

**Title:** GZOO Cortex — self-hosted knowledge graph that watches your project files (SQLite + LanceDB, no cloud required)

Built a tool that watches your project directories, extracts knowledge using LLMs, and stores everything locally. Zero cloud dependency if you run Ollama.

- All data in ~/.cortex/ — SQLite for entities/relationships, LanceDB for vectors
- Works 100% local with Ollama (Mistral, Llama, etc.) — $0 cloud cost
- Web dashboard at localhost:3710 with knowledge graph visualization
- Privacy levels: mark directories as "restricted" and they never leave your machine
- 17 CLI commands for everything

It's a Node.js monorepo, install with npm. Needs Node 20+ and optionally Ollama for local mode.

GitHub: https://github.com/gzoonet/cortex

---

## r/LocalLLaMA

**Title:** Built a knowledge graph tool with hybrid Ollama routing — entity extraction runs local, reasoning goes to cloud (or everything local)

I built GZOO Cortex, a knowledge graph that watches your project files. The LLM routing is what I think this community will find interesting:

- **local-only mode**: Everything runs through Ollama. $0 cloud cost.
- **hybrid mode**: Entity extraction + context ranking → Ollama (high volume, fast). Relationship inference + natural language queries → cloud provider (reasoning-heavy).
- **Confidence escalation**: If local model confidence < 0.6, automatically retries on cloud.
- **Budget fallback**: When monthly cloud budget is hit, all tasks auto-route to Ollama.

I've been running it with Mistral 7B for extraction and it works well. The quality gap between local and cloud is smaller than I expected for entity extraction — the structured output parsing handles most of the variance.

Supports Ollama commands: `cortex models list/pull/test/info`

MIT licensed: https://github.com/gzoonet/cortex

---

## r/ClaudeAI

**Title:** Built an MCP server that gives Claude Code access to a knowledge graph of your project decisions

I built GZOO Cortex — a tool that watches your project files, extracts decisions/patterns/components using LLMs, and builds a knowledge graph.

The part relevant to this community: it includes an MCP server so Claude Code can query your knowledge graph directly.

```
claude mcp add cortex --scope user -- node /path/to/packages/mcp/dist/index.js
```

This gives Claude 4 tools: get_status, list_projects, find_entity, query_cortex.

So instead of Claude hallucinating about your project, it can look up what you actually decided. "What auth pattern does project X use?" gets answered from your real files with source citations.

It works with Anthropic Claude as the LLM provider, but also supports Gemini, OpenAI-compatible APIs, and Ollama for hybrid/local routing.

MIT licensed: https://github.com/gzoonet/cortex

---

## r/commandline

**Title:** cortex — CLI knowledge graph that watches your files and answers questions about your projects (17 commands, streaming responses)

Built a CLI tool with 17 commands for managing a knowledge graph across multiple projects:

```
cortex init                    # setup wizard
cortex watch                   # start watching files
cortex query "what auth pattern am I using?"  # streaming NL query
cortex find "PostgreSQL" --expand 2           # entity lookup
cortex contradictions          # find conflicting decisions
cortex status                  # dashboard
cortex serve                   # web UI at localhost:3710
```

It watches your project directories, extracts entities (decisions, patterns, components) using LLMs, and stores them in SQLite + LanceDB. The query command streams responses with source citations.

Built with Commander.js, TypeScript. Supports --json output for scripting. Works with cloud LLMs or fully local via Ollama.

MIT licensed: https://github.com/gzoonet/cortex
