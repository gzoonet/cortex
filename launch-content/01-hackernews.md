# Hacker News — Show HN Post

**Title:** Show HN: GZOO Cortex – local-first knowledge graph that watches your project files

**Post body:**

I run a consultancy and work on 4-5 projects simultaneously. I kept losing context — what did I decide about auth in project A? What caching pattern did I use in project B? The knowledge was in my files but scattered across hundreds of documents.

So I built Cortex. It watches your project directories, extracts entities (decisions, patterns, components, dependencies) using LLMs, builds a knowledge graph, and lets you query across everything in natural language.

Key design choices:

- Local-first: all data in ~/.cortex/ (SQLite + LanceDB)
- Provider-agnostic: works with Anthropic Claude, Google Gemini, any OpenAI-compatible API, or fully local via Ollama
- Hybrid LLM routing: high-volume tasks -> Ollama, reasoning -> cloud
- Privacy levels: "restricted" projects never leave your machine
- Zero-effort ingestion: just point it at a directory and it watches
- Web dashboard with interactive knowledge graph, live feed, query explorer
- MCP server for direct Claude Code integration

It started as an internal tool at my company (GZOO). After using it daily for months on real projects, I'm open-sourcing it.

Built with: TypeScript, SQLite, LanceDB, React, D3, tree-sitter, Commander.js, Express, WebSocket

https://github.com/gzoonet/cortex

---

**Timing:** Post between 8-10am ET on a Tuesday or Wednesday.

**Behavior after posting:**
- Stay online for the first 2 hours and respond to every comment
- Be honest about limitations ("still sub-1.0, rough edges exist")
- Respond to technical questions with depth
- Don't be defensive about criticism
- If someone asks "how is this different from X?" — answer specifically
