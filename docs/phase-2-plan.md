# Phase 2 Build Plan

> **Start here.** This is the exact order to build Phase 2.
> Each step produces working, testable code. Don't skip ahead.
> Read the relevant spec docs before each step — they have the full detail.

## What Phase 2 Delivers

Phase 2 activates local-first operation. The pipeline moves from
"always cloud" to **smart routing** where Ollama handles high-volume tasks,
Claude handles reasoning-heavy tasks, privacy restrictions block cloud
automatically, and contradictions alert in real time.

**User Stories delivered:**
- **US-201:** Hybrid routing — entity extraction uses local Ollama, relationship
  inference/contradiction detection use cloud Sonnet
- **US-202:** Budget exhaustion auto-fallback — monthly limit hit → all tasks
  route to local automatically (router already written; needs integration test)
- **US-203:** Privacy-restricted directories — `restricted` projects never reach
  cloud; pipeline checks project privacy level before routing
- **US-204:** Conversation export ingestion — parse exported Claude/ChatGPT JSON
  and markdown conversation files into entities
- **US-205:** Contradiction alerts — `cortex watch` prints live alerts when
  `contradiction.detected` fires; new `cortex contradictions --watch` flag

---

## Current State: What Phase 1 Delivered

Before building, confirm these are working:

| Component | File | Status |
|---|---|---|
| Ollama provider | `packages/llm/src/providers/ollama.ts` | ✓ Complete |
| Router (all 4 modes) | `packages/llm/src/router.ts` | ✓ Complete |
| Budget fallback logic | `router.ts → selectProvider()` | ✓ Complete |
| All 7 prompt modules | `packages/llm/src/prompts/*.ts` | ✓ Complete |
| Parsers (md/ts/json/yaml) | `packages/ingest/src/parsers/` | ✓ Complete |
| Ingestion pipeline | `packages/ingest/src/pipeline.ts` | ✓ Complete (gaps below) |
| `cortex projects` command | `packages/cli/src/commands/projects.ts` | ✓ Complete |

**Known Phase 1 gaps to fix in Phase 2:**
1. `extractedBy.provider` is hardcoded `'anthropic'` in `pipeline.ts:244,302` — must reflect actual provider used
2. Merge detection prompt exists but is never called from pipeline
3. Contradiction detection prompt exists but is never called from pipeline
4. Pipeline does not check project privacy level before routing to cloud
5. No `contradiction.detected` EventBus listener in `cortex watch`

---

## Step 1: Fix `extractedBy.provider` in Pipeline

**File:** `packages/ingest/src/pipeline.ts`

The router's `CompleteResult` includes `provider: 'anthropic' | 'ollama'`. The
pipeline currently ignores this and hardcodes `'anthropic'` in both
`extractedBy` blocks (entity extraction and relationship inference).

**Change:**
- In `extractEntities()`: use `result.provider` instead of `'anthropic'`
- In `inferRelationships()`: use `result.provider` instead of `'anthropic'`

This is a two-line fix but matters for audit trail integrity (rule 4 in CLAUDE.md).

**Test:** Run extraction in hybrid mode → verify `extractedBy.provider` in DB
reflects `'ollama'` for entity extraction tasks.

---

## Step 2: Wire Entity Merge Detection into Pipeline (P3)

**File:** `packages/ingest/src/pipeline.ts`
**Spec:** `docs/prompts.md` P3, `docs/types.md` Entity

After storing new entities from a file, compare each against existing graph
entities with similar names (FTS search) to detect duplicates described
differently across files.

**Where to call it:** After `store.createEntity()` in `ingestFile()`, before
emitting `file.ingested`.

**Implementation steps:**

1. Import `mergeDetectionPrompt` from `@cortex/llm`
2. After storing all entities for a file, for each stored entity:
   - Run FTS search: `store.searchEntities(entity.name, 5)`
   - Filter out the entity itself and entities from the same source file
   - For each candidate, call P3 prompt via `router.completeStructured()`
   - If `shouldMerge === true && confidence >= config.graph.mergeConfidenceThreshold`:
     - Call `store.updateEntity(candidate.id, { status: 'superseded' })`
     - Emit `entity.merged` event: `{ survivorId: stored.id, mergedId: candidate.id }`
     - Log merge to structured logger
3. Always pass `forceProvider: 'local'` in the router request for P3. Merge
   detection is high-volume and low-stakes — it should never route to cloud
   regardless of the current routing mode. Do not alias it to another task's
   routing rules.
4. If `localProvider` is unavailable (mode is `cloud-first` and no local
   configured), skip merge detection entirely rather than routing to cloud.

**Config used:** `config.graph.mergeConfidenceThreshold` (default `0.85`)
**Task routing:** Always `forceProvider: 'local'` — explicit, not inherited from any LLMTask routing

**Test:** Ingest two files describing the same component with different names →
one entity superseded, `entity.merged` event emitted, graph shows single active entity.

---

## Step 3: Wire Contradiction Detection into Pipeline (P4)

**File:** `packages/ingest/src/pipeline.ts`
**Spec:** `docs/prompts.md` P4, `docs/types.md` Contradiction

After all entities from a file are stored and merged, scan for contradictions
between new entities and existing graph entities of the same type.

**Where to call it:** After merge detection, before `file.ingested` event.

**Implementation steps:**

1. Import `contradictionDetectionPrompt` from `@cortex/llm`
2. For each new stored entity:
   - Query graph: `store.findEntities({ type: entity.type, projectId: entity.projectId, limit: 20 })`
   - Exclude entities from same source file
   - For each candidate, call P4 prompt via `router.completeStructured()`
   - If `isContradiction === true`:
     - Call `store.createContradiction({ entityIds: [entity.id, candidate.id], description, severity, suggestedResolution, status: 'active', detectedAt: now })`
     - Emit `contradiction.detected` event: `{ contradiction: Contradiction }`
3. Use `forceProvider: 'cloud'` in the router request for P4 — contradiction
   detection requires nuanced reasoning (spec: "Cloud Sonnet — requires nuanced reasoning")
4. Respect privacy: if project `privacyLevel === 'restricted'`, skip P4 entirely
   (restricted content never goes to cloud; local models too weak for this task)

**SQLite:** `store.createContradiction()` does not exist yet — add it to
`SQLiteStore` and the `GraphStore` interface. SQL: insert into `contradictions`
table (schema already defined in `docs/api-contracts.md`).

**Test:** Ingest two entities that conflict (e.g., "Use PostgreSQL" and "Use
SQLite") → contradiction created in DB, `contradiction.detected` event fired.

---

## Step 4: Privacy Enforcement in Pipeline (US-203)

**File:** `packages/ingest/src/pipeline.ts`
**Spec:** `docs/security.md`, `docs/config.md` privacy section

The router handles task-level routing, but it doesn't know the project's
privacy level. The pipeline must enforce privacy before routing to cloud.

**Implementation steps:**

1. Add `projectPrivacyLevel: 'standard' | 'sensitive' | 'restricted'` to
   `PipelineOptions`
2. In `extractEntities()`, before calling `router.completeStructured()`:
   - If `privacyLevel === 'restricted'`: add `forceProvider: 'local'` — zero
     cloud calls, ever, for this project
   - If `privacyLevel === 'sensitive'`: add `forceProvider: 'local'` as a
     **Phase 2 simplification**. Per `docs/security.md`, the correct long-term
     behavior for sensitive content is to send entity names/types/metadata to
     cloud with content body redacted (see `RedactedEntity` interface in
     security.md). This full redaction path is deferred to Phase 3.
     **Add a TODO comment in code:** `// TODO Phase 3: implement content redaction for sensitive; send RedactedEntity to cloud instead of forcing local`
3. In `inferRelationships()`: same check — `forceProvider: 'local'` for
   restricted and sensitive projects
4. In contradiction detection (Step 3): skip entirely for `restricted` projects
   (as noted above). For `sensitive`: force local (same simplification as above)

**Wire-up:** `cortex watch` already has the project object — pass
`project.privacyLevel` through to `PipelineOptions`.

**Test:**
- Create project, `cortex privacy set . restricted` → ingest file → verify no
  `llm.request.start` events with `provider: 'anthropic'`
- Sensitive project → verify `provider: 'ollama'` in all requests
- Standard project in hybrid mode → verify entity extraction goes to `'ollama'`

---

## Step 5: Contradiction Alerts in `cortex watch` (US-205)

**File:** `packages/cli/src/commands/watch.ts`
**Spec:** `docs/cli-commands.md`

The watch command runs the pipeline but doesn't surface contradiction events to
the user. Wire up `contradiction.detected` to print a live alert.

**Implementation steps:**

1. In the watch command's startup (after pipeline is initialized), subscribe:
   ```typescript
   eventBus.on('contradiction.detected', (event) => {
     const c = event.payload.contradiction as Contradiction;
     console.log(chalk.yellow(`\n⚠  Contradiction detected [${c.severity}]: ${c.description}`));
     console.log(chalk.dim(`   Run: cortex resolve ${c.id.slice(0, 8)} --action <supersede|dismiss|keep-old|both-valid>`));
   });
   ```
2. For `--json` mode, emit a structured JSON line instead of colored output
3. Add `--watch` flag to `cortex contradictions` command:
   - Polls `store.findContradictions({ status: 'active' })` every 30s and
     prints newly detected ones (for cases where watch isn't running)

**Test:** Run `cortex watch` → ingest conflicting files → contradiction alert
appears in terminal within one ingestion cycle.

---

## Step 5b: Budget Exhaustion Alert in `cortex watch` (US-202)

**File:** `packages/cli/src/commands/watch.ts`
**Spec:** `docs/errors.md` LLM layer — `LLM_BUDGET_EXHAUSTED`

The router already routes all tasks to local when budget is exhausted
(`enforcementAction: 'fallback-local'`), but the user gets no visible signal
that this has happened. Wire up the `budget.exhausted` and `budget.warning`
events to print alerts during `cortex watch`.

**Implementation steps:**

1. Subscribe to `budget.warning` in watch startup:
   ```typescript
   eventBus.on('budget.warning', (event) => {
     const { usedPercent, remainingUsd } = event.payload as { usedPercent: number; remainingUsd: number };
     console.log(chalk.yellow(`\n⚠  Budget ${usedPercent}% used ($${remainingUsd.toFixed(2)} remaining) — routing to local`));
   });
   ```
2. Subscribe to `budget.exhausted`:
   ```typescript
   eventBus.on('budget.exhausted', (event) => {
     const { totalSpentUsd } = event.payload as { totalSpentUsd: number };
     console.log(chalk.red(`\n⛔ Monthly budget exhausted ($${totalSpentUsd.toFixed(2)} spent)`));
     console.log(chalk.dim('   All tasks are now routing to local Ollama. Run `cortex costs` for details.'));
   });
   ```
3. For `--json` mode, emit structured JSON lines for both events
4. Budget warning thresholds (50%, 80%, 90%) are already emitted by
   `TokenTracker` in `packages/llm/src/token-tracker.ts` — no changes needed there

**Test:** Configure `monthlyLimitUsd: 0.01`, ingest a file → `budget.exhausted`
alert prints, subsequent tasks confirmed routed to Ollama.

---

## Step 6: Conversation Export Parser (US-204)

**Files:**
- `packages/ingest/src/parsers/conversation.ts` — new parser
- `packages/ingest/src/parsers/index.ts` — register it

Parse exported conversation files into sections that the pipeline can chunk and
extract entities from.

**Supported formats:**

1. **Claude/ChatGPT JSON export** (`*.json` with `conversations` array):
   - Detect by: top-level key `conversations` or `messages` array with `role` fields
   - Extract: each message as a section, with speaker role as heading
   - Skip: system messages, very short messages (< 50 chars)

2. **Markdown conversation export** (`*.md` with alternating `## Human` / `## Assistant` headings):
   - Detect by: first two headings match `Human|User|Me` and `Assistant|Claude|ChatGPT`
   - Extract: treat each speaker block as a section

**Parser interface** (matches existing `ParseResult`):
```typescript
interface ConversationParser {
  parse(content: string, filePath: string): Promise<ParseResult>;
  detect(content: string, filePath: string): boolean; // sniff format
}
```

**Registration in `parsers/index.ts`:**
- Register for extension `json` only when `detect()` returns true (conversation JSON
  has different shape than `package.json` — the JSON parser already handles regular JSON)
- The parser registry `getParser(ext)` needs to support multiple parsers per
  extension with sniff-first selection

**Entity extraction output:** Conversations produce `Note` and `Decision` entities
primarily. The entity extraction prompt (P1) handles this automatically — no
prompt changes needed.

**Test:**
- Parse a Claude JSON export → sections extracted, entities found
- Parse a markdown conversation → sections extracted, follow-up questions
  become `ActionItem` entities
- Regular `package.json` still routes to JSON parser, not conversation parser

---

## Step 6b: Wire Conversation Parser to `cortex ingest` Command (US-204)

**File:** `packages/cli/src/commands/watch.ts` (or new `packages/cli/src/commands/ingest.ts`)
**Spec:** `docs/cli-commands.md`

The parser from Step 6 handles the format detection and extraction, but users
need a way to manually ingest a conversation export without dropping the file
into a watched directory. Add a `cortex ingest` command for one-shot ingestion.

**Command signature:**
```
cortex ingest <file-or-glob> [--format <format>] [--project <name>]

Flags:
  --format claude-export | chatgpt-export | auto   default: auto
  --project <name>                                  which project to attach entities to
  --dry-run                                         show what would be extracted, no writes
```

**Behavior:**
1. Load config and initialize pipeline
2. Resolve file path(s) — supports glob (e.g., `~/Downloads/*.json`)
3. If `--format` is provided, skip sniff detection and use the specified parser
4. For each file: run `pipeline.ingestFile(filePath)` — same path as watcher
5. Print summary: files ingested, entities extracted, any errors
6. `--dry-run`: parse and show sections/entity count estimate, no DB writes

**Output:**
```
Ingesting 2 files...
  ✓ claude-export-2024-01.json  → 47 entities, 12 relationships
  ✓ claude-export-2024-02.json  → 31 entities, 8 relationships

Total: 78 entities, 20 relationships ingested into project "taskrunner"
```

**Registration:** Add `registerIngestCommand(program)` to
`packages/cli/src/index.ts`.

**Test:** `cortex ingest tests/fixtures/conversation-claude-export.json --dry-run`
exits 0 and prints section/entity count without writing to DB.

---

## Step 7: `cortex models` Command

**File:** `packages/cli/src/commands/models.ts`
**Register in:** `packages/cli/src/index.ts`

Manage Ollama models without leaving the GZOO Cortex CLI.

**Subcommands:**

```
cortex models list          # show available Ollama models + which is configured
cortex models pull <model>  # run ollama pull <model> with progress indicator
cortex models test          # run a quick inference + embedding to verify setup
cortex models info          # show context window, GPU layers, performance estimate
```

**`models list` output:**
```
Ollama Models (http://localhost:11434)
───────────────────────────────────────
  mistral:7b-instruct-q5_K_M   4.1 GB   ← configured (primary)
  nomic-embed-text             274 MB   ← configured (embeddings)
  llama3:8b                    4.7 GB

Tip: Set model with `cortex config set llm.local.model <model>`
```

**`models test` output:**
```
Testing Ollama setup...
  ✓ Connection:  http://localhost:11434 reachable
  ✓ Model:       mistral:7b-instruct-q5_K_M loaded
  ✓ Inference:   "Hello" → 12 tokens in 340ms (35 tok/s)
  ✓ Embeddings:  nomic-embed-text → 768-dim vector in 85ms
  ✓ Ready for hybrid/local mode
```

**Implementation:** Use `OllamaProvider.isAvailable()`, `OllamaProvider.embed()`,
and a minimal `completeWithSystem()` call. Access `router.getLocalProvider()` from
the CLI context.

**Test:** `cortex models list --json` returns valid JSON. `cortex models test`
exits 0 when Ollama is running, exit 4 when not.

---

## Step 8: Enhanced `cortex status` for Local Provider

**File:** `packages/cli/src/commands/status.ts`
**Spec:** `docs/cli-commands.md`

Phase 1 status shows cloud-only info. Add a local provider section.

**New status output (hybrid/local modes):**
```
CORTEX STATUS
─────────────────────────────────────────────────────
Graph:     1,247 entities | 3,891 relationships | 2 contradictions
Projects:  3 watched (bookflow, taskrunner, gzoo)
Files:     347 tracked | 2 in dead letter queue
Storage:   48.2 MB (SQLite) | 124.6 MB (vectors)

LLM Mode:  hybrid
  Cloud:   ✓ Claude Sonnet 4.5 / Haiku 4.5 (Anthropic)
  Local:   ✓ mistral:7b-instruct-q5_K_M @ localhost:11434
            8192 ctx | GPU: 35 layers | ~30 tok/s est.

Cost:      $12.45 / $25.00 this month (49.8%)
           Savings from local: ~$8.20 est.

Status:    ✓ Fully operational
```

**Local savings estimate:** Total tokens processed locally × cloud Haiku rate
(what you would have paid). Track `provider: 'ollama'` records in `token_usage`
table — they already have `input_tokens` and `output_tokens` recorded.

**Implementation:** Call `router.getLocalProvider()?.isAvailable()` and
`router.getLocalProvider()?.getModel()` to populate the local section. If
local provider unavailable, show `Local: ✗ Ollama not running`.

**Test:** `cortex status --json` includes `llm.local` object with `model`,
`available`, `host` fields.

---

## Step 9: Local-First Confidence Escalation in Router

**File:** `packages/llm/src/router.ts`
**Spec:** `docs/config.md` routing table footnote: *"local-first: escalates to cloud when local confidence < 0.6"*

In `local-first` mode, after getting a structured result from the local
provider, check the confidence of extracted entities. If median confidence
is below threshold, retry with cloud.

**Implementation in `completeStructured()`:**

```typescript
// After local result in local-first mode:
if (this.mode === 'local-first' && providerName === 'ollama' && this.cloudProvider) {
  const entities = (data as any).entities;
  if (Array.isArray(entities)) {
    const median = medianConfidence(entities);
    if (median < 0.6) {
      logger.info('Local confidence below threshold, escalating to cloud', { median });
      return this.completeStructuredWithProvider(request, schema, this.cloudProvider, 'anthropic');
    }
  }
}
```

Only applies to tasks that return a `confidence` field (entity extraction,
contradiction detection, merge detection). Relationship inference and conversational
query don't need this.

**Test:** Mock local provider to return entities with confidence 0.3 → verify
retry goes to cloud provider.

---

## Step 10: Integration Tests

**Directory:** `tests/integration/`
**Framework:** Vitest (already configured in `vitest.config.ts`)

Write end-to-end integration tests covering Phase 2 scenarios. These require
Ollama running locally — mark with `@requires-ollama` tag and skip in CI if
`CORTEX_OLLAMA_HOST` is not set.

**Tests to write:**

1. **`hybrid-routing.test.ts`**
   - Configure hybrid mode
   - Ingest a markdown file
   - Assert entity extraction used `provider: 'ollama'`
   - Assert relationship inference used `provider: 'anthropic'`

2. **`budget-fallback.test.ts`**
   - Configure cloud-first mode with `monthlyLimitUsd: 0` (exhausted)
   - Ingest a file
   - Assert all tasks route to Ollama (not Anthropic)
   - Assert `budget.exhausted` event fired

3. **`privacy-enforcement.test.ts`**
   - Register project with `privacyLevel: 'restricted'`
   - Ingest a file from that project
   - Assert zero `llm.request.start` events with `provider: 'anthropic'`

4. **`merge-detection.test.ts`**
   - Ingest file A → entity "Use PostgreSQL for storage"
   - Ingest file B → entity "PostgreSQL database decision"
   - Assert `entity.merged` event fired, one entity `status: 'superseded'`

5. **`contradiction-detection.test.ts`**
   - Ingest "We will use SQLite" and "We decided against embedded databases"
   - Assert `contradiction.detected` event fired, contradiction in DB

6. **`conversation-export.test.ts`**
   - Parse a fixture Claude JSON export
   - Assert sections extracted, entities created from messages

**Fixtures directory:** `tests/fixtures/`
- `conversation-claude-export.json` — sample Claude conversation export
- `conversation-chatgpt-export.json` — sample ChatGPT export
- `conversation-markdown.md` — markdown conversation format
- `contradicting-decisions.md` + `conflicting-decisions.md` — for contradiction test
- `component-a.md` + `component-a-alt.md` — for merge test

---

## Definition of Done (Phase 2)

- [ ] `extractedBy.provider` reflects actual provider in all stored records
- [ ] Merge detection runs after every file ingestion; duplicates get `superseded`
- [ ] Contradiction detection runs after every file ingestion; contradictions stored in DB
- [ ] `contradiction.detected` events show live alerts in `cortex watch` terminal
- [ ] Restricted projects: zero cloud LLM calls regardless of routing mode
- [ ] Sensitive projects: all LLM calls routed to local (Phase 2 simplification; Phase 3 adds content redaction path)
- [ ] `budget.warning` alerts print in `cortex watch` at 50%/80%/90% thresholds
- [ ] `budget.exhausted` alert prints in `cortex watch`; tasks confirmed routing to Ollama
- [ ] Conversation JSON export → entities extracted (Claude and ChatGPT formats)
- [ ] Conversation markdown export → entities extracted
- [ ] `cortex ingest <file> --format claude-export|chatgpt-export|auto` works end-to-end
- [ ] `cortex ingest --dry-run` shows entity count without writing to DB
- [ ] `cortex models list` shows Ollama models with configured markers
- [ ] `cortex models test` verifies inference + embeddings, exits 0 or 4
- [ ] `cortex models pull <model>` pulls from Ollama registry with progress
- [ ] `cortex status` shows local provider status and estimated cloud savings
- [ ] Local-first mode escalates to cloud when entity confidence < 0.6
- [ ] All 6 integration tests pass against live Ollama + Anthropic API
- [ ] Budget fallback: $0 monthly limit → all tasks route to local automatically
- [ ] `cortex contradictions --watch` polls and surfaces new contradictions

---

## Spec Files Reference

| Before building... | Read this |
|---|---|
| Merge / contradiction prompts | `docs/prompts.md` P3, P4 |
| Privacy enforcement rules | `docs/security.md` |
| Router mode × task mapping | `docs/config.md` routing table |
| Contradiction DB schema | `docs/api-contracts.md` SQLite schema |
| `cortex models` UX | `docs/cli-commands.md` |
| Privacy-level types | `docs/types.md` Project interface |
| Error codes for local failures | `docs/errors.md` LLM + Privacy layers |
