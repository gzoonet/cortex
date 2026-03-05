# Twitter/X Thread

**Thread (9 tweets):**

---

1/ I've been building a tool for the past few months that I'm finally open-sourcing today.

GZOO Cortex: a local-first knowledge graph that watches your project files and lets you query across everything in natural language.

[screenshot of a cortex query response]

---

2/ The problem: I run multiple projects. Decisions, patterns, and context are scattered across hundreds of files. I kept re-solving problems I'd already solved in other repos.

---

3/ What Cortex does:
-> Watches your project directories for file changes
-> Extracts entities (decisions, patterns, components, dependencies)
-> Builds a knowledge graph with relationships
-> Detects contradictions automatically
-> Answers natural language queries with source citations

---

4/ The cool part: provider-agnostic hybrid LLM routing.

High-volume tasks (entity extraction) -> Ollama (local, free)
Reasoning tasks (queries, contradictions) -> your cloud provider

Works with Claude, Gemini, any OpenAI-compatible API, or fully local. You choose. Zero lock-in.

---

5/ Privacy is first-class:
-> Mark directories as "restricted" - never sent to cloud
-> .env, .pem, .key files auto-detected and blocked
-> All data stored locally in SQLite + LanceDB
-> Go fully local-only if you want - $0 cloud cost

---

6/ It also has a web dashboard.

`cortex serve` opens a React dashboard at localhost:3710 with:
- Interactive knowledge graph (D3-force visualization)
- Live feed of file changes and extractions
- Query explorer with streaming responses
- Contradiction resolver

[screenshot of dashboard]

---

7/ And an MCP server for Claude Code integration.

Your AI assistant can query your knowledge graph directly. "What auth pattern does project X use?" - answered from your actual codebase decisions, not hallucinated.

---

8/ I've been using it daily on real projects for months. It genuinely changed how I work — I query past decisions instead of grep-ing through repos or trying to remember.

---

9/ It's MIT licensed, built by @gzoo.

npm install -g @gzoo/cortex

GitHub: github.com/gzoonet/cortex

Would love feedback. What would make this useful for your workflow?
