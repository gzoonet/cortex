# Contributing to GZOO Cortex

Thanks for your interest in contributing!

## Getting Started

1. Fork the repo
2. Clone your fork
3. Install dependencies: `npm install`
4. Build: `npm run build`
5. Run tests: `npm test`

## Development

Cortex is a monorepo with npm workspaces. Packages are in `packages/`.

```bash
# Build all packages
npm run build

# Run tests
npm test

# Run a specific package's tests
cd packages/llm && npm test

# Link for local development
cd packages/cli && npm link
```

## Pull Requests

- One feature or fix per PR
- Include tests for new functionality
- Run `npm test` before submitting
- Keep PRs focused — large refactors should be discussed in an Issue first

## Reporting Bugs

Open an Issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, Ollama version if applicable)

## Feature Requests

Open a Discussion in the Ideas category. Describe the use case, not just the solution.

## Code of Conduct

Be kind. Be constructive. We're all here to build something useful.
