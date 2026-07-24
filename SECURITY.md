# Security Policy

GZOO Cortex is a local-first tool: it reads your project files, extracts entities
with an LLM, and stores the result in a local SQLite + LanceDB graph. The threat
model, data classification levels, and pre-transmission redaction pipeline are
documented in [`docs/security.md`](docs/security.md). This file covers **how to
report a vulnerability** and which versions receive fixes.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.8.x   | ✅ |
| < 0.8   | ❌ |

Cortex is pre-1.0. Security fixes land on the latest minor release only; there
are no backports to earlier lines.

## Reporting a vulnerability

**Do not open a public issue for a security report.**

Use one of the following, in order of preference:

1. **GitHub private vulnerability reporting** — [open a draft advisory](https://github.com/gzoonet/cortex/security/advisories/new).
   This is the preferred channel; it keeps the report private until a fix ships.
2. **Email** — <eddy@gzoo.net> with `[cortex-security]` in the subject.

Please include:

- The affected version or commit SHA.
- What an attacker can achieve, and what access they need to start.
- Reproduction steps, ideally a minimal case.
- Any config (routing mode, privacy level) needed to trigger it.

### What to expect

- **Acknowledgement** within 3 business days.
- **Initial assessment** — whether it is accepted, and a rough severity — within
  10 business days.
- **Fix and disclosure** coordinated with you. We will credit you in the advisory
  unless you prefer otherwise.

Please give us a reasonable window to ship a fix before disclosing publicly.

## What we consider in scope

Because Cortex runs locally against your own files, the highest-value issues are
ones that break the boundary between local data and the network, or between
projects:

- **Privacy pipeline bypass** — anything that gets `sensitive` or `restricted`
  content to a cloud provider without redaction, or defeats the secret/PII
  scanners described in `docs/security.md`.
- **Secret leakage** — API keys, `.env` contents, or credentials landing in the
  graph, logs, cache, or an LLM prompt.
- **Routing-mode violation** — a cloud API call made while in `local-only` mode.
- **Local server exposure** — the `cortex serve` dashboard (default
  `localhost:3710`) or its API reachable off-host, or authentication bypass on it.
- **MCP server issues** — anything letting an MCP client read outside its
  project scope.
- **Injection** — SQL injection into the SQLite store, or path traversal in the
  file watcher / ingest pipeline escaping configured directories.
- **Prompt injection with real consequence** — file content that causes the agent
  to exfiltrate data or take an action outside the ingest pipeline. Note that
  ingested content is untrusted by design; a report needs to show impact beyond
  "the extraction produced wrong entities".

## What we consider out of scope

- Vulnerabilities requiring an attacker who already has local shell access as
  the user running Cortex. That user can read the graph directly.
- Cost exhaustion from your own configured LLM budget.
- Missing hardening headers on the localhost-only dashboard, absent a concrete
  attack.
- Dependency advisories that are not reachable from Cortex's code paths — please
  check the list below first.
- Automated scanner output with no demonstrated impact.

## Known accepted advisories

These appear in `npm audit` but are not exploitable in this codebase. They are
tracked and will be cleared when upstream fixes land; CI's audit gate is set to
`critical` so these two do not mask new findings.

| Advisory | Package | Why it does not apply |
| --- | --- | --- |
| [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) | `react-router` 7.18.1 | RSC-mode CSRF bypass. The dashboard is a client-rendered Vite SPA using `BrowserRouter` (`packages/web/src/App.tsx`); RSC mode is not used and there are no router actions. The fix is in `react-router` 8.3.0, a major upgrade; downgrading to the audit-suggested 7.11.0 would reintroduce the open-redirect and route-matching DoS that 7.18.1 fixes. |
| [GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9) | `@hono/node-server` 1.19.x | Windows-only path traversal in `serve-static`. Reached only transitively via `@modelcontextprotocol/sdk`, which pins `^1.19.9` — the fix is in 2.0.5, outside that range, and SDK 1.29.0 still pins 1.x. Cortex's MCP server uses stdio transport (`packages/mcp/src/index.ts`) and never starts an HTTP server, so `serve-static` is not loaded. |

## Handling your own data

If you are filing a report, do not attach real ingested content, your
`~/.cortex` directory, or API keys. A synthetic reproduction is always
preferred. If a real file is genuinely required, say so and we will arrange a
private channel.
