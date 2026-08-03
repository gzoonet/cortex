# PRD — "StoryForge" (Sudowrite Clone)

> **Status:** Draft v1.0 · 2026-08-03
> **Working name:** StoryForge (placeholder — do not ship Sudowrite branding, copy, or trademarks)
> **Audience:** This document is written to be handed to an engineering agent (Claude Code) as the single source of truth for building the product. It is intentionally exhaustive.

---

## 1. Overview

### 1.1 What we're building

An AI-assisted fiction-writing web application at feature parity with Sudowrite (sudowrite.com). It combines:

1. A **distraction-free long-form editor** organized into projects → chapters/documents.
2. A **Story Bible** — structured story metadata (synopsis, characters, worldbuilding, outline, style) that the AI reads automatically to keep generations consistent with the author's story.
3. A suite of **AI writing tools** (Write, Rewrite, Describe, Expand, Brainstorm, Feedback, Chat, Quick Edit, First Draft, Canvas, Visualize, Plugins) that operate on the manuscript with full story context.
4. A **credits-based metering and subscription system**.

### 1.2 Why

Fiction writers lose momentum to blank pages, revision fatigue, and continuity errors. Generic chatbots fail them because they lack persistent story context, produce "AI-flavored" prose, and force copy-paste workflows. The product's core value: **the AI lives inside the manuscript and knows the whole story.**

### 1.3 Product principles

- **The author is the writer; the AI is the assistant.** Every AI output is a *suggestion* presented in cards the author can insert, discard, or regenerate. The AI never silently modifies the manuscript.
- **Context is the moat.** Every generation is grounded in the Story Bible + surrounding manuscript text. Quality of context assembly > raw model quality.
- **Never lose words.** Aggressive autosave, full snapshot history, soft deletes everywhere.
- **Fast feels magical.** Stream every generation token-by-token. Target < 1.5s to first token.
- **Author owns the work.** Full export at any time; clear policy: user text is never used for training.

### 1.4 Non-goals (v1)

- Mobile native apps (responsive web only; editor optimized for ≥ 1024px).
- Real-time multi-user collaboration (single author per project; sharing is read-only export).
- Non-fiction/academic tooling (citations, references).
- Self-serve fine-tuning of models.
- Offline mode.

---

## 2. Target users & personas

| Persona | Description | Primary jobs |
|---|---|---|
| **The Aspiring Novelist** | Has ideas, stalls at execution. Writes evenings/weekends. | Beat blank page, finish first draft, stay motivated |
| **The Prolific Indie Author** | Publishes 4–12 books/year (romance, fantasy, thriller on KDP). Speed is income. | Draft fast in own voice, maintain series continuity, high monthly volume |
| **The Reviser** | Has a draft; struggles with pacing, description, "telling not showing". | Rewrite scenes, expand rushed sections, get actionable feedback |
| **The Screenwriter** | Writes scripts and treatments. | Brainstorm, dialogue punch-up, format conversion (via plugins) |

Primary market: English-language genre-fiction authors. All prose features must respect POV, tense, and genre conventions.

---

## 3. Competitive parity map

Feature-for-feature target vs. Sudowrite. Everything marked **P0** is required for launch; **P1** fast-follow; **P2** later.

| Sudowrite feature | Ours | Priority |
|---|---|---|
| Projects, chapters, editor | Same | P0 |
| Write (Auto / Guided / Tone Shift) | Same | P0 |
| Rewrite (multiple modes) | Same | P0 |
| Describe (sensory detail) | Same | P0 |
| Expand | Same | P0 |
| Brainstorm (categorized, learns from picks) | Same | P0 |
| Story Bible (Braindump → Genre → Style → Synopsis → Characters → Worldbuilding → Outline → Scenes → Draft) | Same | P0 |
| Saliency engine (auto-select relevant Bible entries) | Same | P0 (basic), P1 (smart) |
| Chat (context-aware assistant) | Same | P0 |
| Quick Edit (inline instruction) | Same | P0 |
| Feedback (manuscript critique) | Same | P1 |
| First Draft (scene → prose generation) | Same | P0 (part of Draft flow) |
| Canvas (visual planning board) | Same | P1 |
| Visualize (character/scene art) | Same | P2 |
| Plugins (user-built prompt tools + marketplace) | Same | P1 (personal tools), P2 (marketplace) |
| Prose modes / model picker | Same | P0 |
| Series support (shared Bible across books) | Same | P2 |
| History (snapshots/versioning) | Same | P0 |
| Themes, dark mode, focus mode | Same | P0 |
| Credits + subscription billing | Same | P0 |
| Word-count goals / streaks | Same | P2 |

---

## 4. Detailed functional requirements

### 4.0 Shared AI-output UX (applies to every tool)

- Generations appear as **cards** in a right-hand panel (or inline popover for selection tools), streamed token-by-token.
- Every card has: **Insert** (at cursor / replace selection), **Copy**, **Regenerate**, **Discard**, thumbs up/down.
- Tools that produce alternatives (Write, Rewrite, Describe) generate **2 cards per run** by default (configurable 1–3).
- Cards persist per-document in a collapsible **History drawer** until explicitly cleared (persisted server-side, last 200 per document).
- Every card shows credits consumed and the tool + model used.
- A generation can be **stopped** mid-stream (user is charged only for tokens generated).
- All tools respect project-level settings: **POV** (1st/2nd/3rd limited/3rd omniscient), **tense** (past/present), **genre**, and Story Bible context (see §5).

### 4.1 Accounts & auth

- Email + password (Argon2id) and Google OAuth. Email verification required before trial starts.
- Session: httpOnly secure cookies, 30-day refresh. CSRF protection on mutations.
- Account settings: name, email, password change, default model preference, data export, account deletion (soft delete 30 days, then purge).

### 4.2 Projects & documents

- **Project** = one book/work. Fields: title, genre, description, POV default, tense default, cover color/emoji.
- Project contains an ordered tree of **documents** (chapters) — flat list with drag-reorder in v1; folders P2.
- Per-project **trash** (soft-deleted docs, 30-day retention, restorable).
- Project list home page: cards with title, word count, last edited, quick actions (open, rename, duplicate, archive, delete).
- Import: .docx, .txt, .md (splits into chapters on `Chapter N` headings or H1s — user previews split before commit).
- Export: whole project or single doc as .docx, .md, .txt. Story Bible exports as .md or JSON.
- Limits: 1,000 docs/project, 200k words/doc (soft warning at 50k).

### 4.3 Editor

- Rich text via **TipTap (ProseMirror)**. Marks: bold, italic, underline, strikethrough. Blocks: paragraph, H1–H3, blockquote, ordered/unordered list, horizontal rule. No tables/images in manuscript (v1).
- **Autosave**: debounced 800ms after last keystroke + on blur; save state indicator (Saved / Saving / Offline — retry with exponential backoff, never lose local buffer).
- **Snapshots**: automatic every 10 minutes of active editing + before every AI insertion/replacement + manual "Save snapshot". History view with restore + side-by-side diff. Retention: 90 days rolling (unlimited for manual snapshots).
- Word count: live per-doc and per-project; session word count ("words written today").
- **Focus mode**: hides all chrome except the page; ESC exits.
- **Themes**: minimum 4 light + 3 dark editor themes (font, page width, background). Font size + line spacing controls.
- Find & replace (per document), match case / whole word.
- Typewriter scrolling (optional), smart quotes, em-dash autocorrect (optional toggles).
- **Selection menu**: selecting text pops a floating toolbar: formatting + AI actions (Rewrite, Describe, Expand, Quick Edit, Brainstorm-from-selection).
- Keyboard shortcuts for every AI tool (e.g. `Cmd/Ctrl+J` = Write) + shortcut cheat-sheet modal.
- Layout: left sidebar (project nav/chapters, collapsible) · center editor · right panel (AI cards / Story Bible / Chat tabs, collapsible).

### 4.4 Write (the flagship "continue" tool)

Continues the story from the cursor position.

- **Auto mode**: no input needed. Uses preceding manuscript text + Story Bible to generate the next ~150–400 words (user-configurable target length). Produces 2 alternative cards.
- **Guided mode**: user types a one-line direction ("she discovers the letter is a forgery") → continuation follows that beat.
- **Tone Shift mode**: user picks a tone chip (ominous, romantic, action-packed, funny, melancholy, tense + free-text) → continuation shifts tone accordingly.
- Settings (persisted per project): creativity slider (maps to temperature 0.5–1.1), card length (words), number of cards (1–3), prose model.
- Context window assembly: see §5.4. Must include at minimum the last ~2,500 words before the cursor, chapter summary chain, and salient Bible entries.
- Inserted text is marked transiently (subtle highlight fading after 5s) so the author can see what was added.

### 4.5 Rewrite

Operates on a selection (word → several paragraphs; hard cap 1,200 words).

Modes (each a distinct prompt template):
- **Rephrase** — same meaning, different wording.
- **Shorter** — tighten ~40%.
- **More descriptive** — richer imagery, keep events identical.
- **Show, don't tell** — convert stated emotion/summary into action, dialogue, sensory detail.
- **More inner conflict** — add interiority for POV character.
- **More intense** — raise stakes/tension in the prose.
- **Custom** — free-text instruction ("make the dialogue more clipped").

Output: 2 alternative cards; **Insert** replaces the selection (snapshot taken first). Preserve surrounding whitespace/paragraph structure.

### 4.6 Describe

Operates on a selection (a noun phrase, sentence, or short passage). Generates sensory description in the manuscript's voice, one card per sense:

- **Sight, Sound, Smell, Taste, Touch** + **Metaphor** (a figurative framing).
- Runs as a single batched generation returning all six sections (streamed progressively); each section is individually insertable.
- Must match POV/tense and never contradict Bible facts about the described object/character.

### 4.7 Expand

Selection-based. Rewrites a rushed passage at ~1.5–2× length, adding beats, reactions, and connective tissue without introducing new plot events. 2 cards; Insert replaces selection.

### 4.8 Brainstorm

A structured idea generator with a **keep/discard learning loop**.

- Categories: Dialogue, Characters (names/backstories), World building, Plot points, Names, Places, Objects/artifacts, Descriptions, Article ideas, Tweets, Something else (free-form).
- User provides a short prompt + optional "examples I like" seed list.
- Generates a batch of ~8 ideas as chips/cards. Each has 👍 (keep) / 👎 (discard). **"More like the kept ones"** regenerates a new batch using keeps as few-shot examples and discards as negative examples.
- Kept ideas accumulate in a per-project **Idea Box** (searchable, copyable, deletable; can send a kept idea to a Story Bible field).

### 4.9 Quick Edit & Chat

- **Quick Edit**: inline command bar (`Cmd/Ctrl+K`) on a selection → free-text instruction ("change her name to Mara everywhere in this paragraph", "fix grammar") → single replacement suggestion shown as tracked-change-style diff (red strikethrough / green additions) → Accept / Reject.
- **Chat**: right-panel conversational assistant, multi-turn, streamed. Automatically carries story context (Bible + current chapter). Use cases: "what do you think of this chapter?", "list all unresolved plot threads", "suggest 5 ways to foreshadow the betrayal". Chat can quote manuscript excerpts. Sessions are persisted per project; user can start new threads and delete old ones. Chat has an **insert to editor** button on any code-block/prose snippet in a reply.

### 4.10 Feedback (P1)

- Runs on a chapter (or selection ≥ 500 words). Returns structured critique: **Summary of what's working**, then exactly **5 prioritized, actionable improvement areas**, each with (a) the issue, (b) a quoted example from the text, (c) a concrete suggested fix.
- Optional lenses: pacing, characterization, dialogue, continuity (checks against Story Bible and flags contradictions), line-level style.
- Output rendered as a report card in the right panel; exportable as .md.

### 4.11 Story Bible

The structured story-context system. A dedicated per-project view (also summonable as a right-panel tab). Every field supports: manual editing, **AI generation** (from other filled fields), regeneration, and a per-field "lock" (locked fields are never auto-overwritten).

Components, in the guided order presented to users:

1. **Braindump** — free-form text: premise, vibes, fragments. Input-only (feeds generation of everything else).
2. **Genre** — free text w/ suggestions (e.g. "cozy fantasy mystery"). Feeds all prompts.
3. **Style** — either (a) free-text style description, or (b) **Match My Style**: user pastes 500–2,000 words of their own prose → system generates a style description capturing diction, rhythm, sentence length, and tics. Style text is injected into every prose-generating prompt.
4. **Synopsis** — 1–3 paragraph story summary. Generate from Braindump+Genre.
5. **Characters** — repeatable entries: Name, Aliases/nicknames, Description, Personality, Background, Motivation, Voice/dialogue style, Relationships, + user-defined custom fields. Generate-from-synopsis produces a starter cast. Per-character visibility toggle (include/exclude from AI context).
6. **Worldbuilding** — repeatable entries with Name, Type (location, magic system, technology, faction, culture, item, other), Description, custom fields. Same visibility toggles.
7. **Outline** — ordered list of acts/chapters with 1–3 sentence summaries. Generate from Synopsis (user picks structure: 3-act, Save the Cat, Hero's Journey, 12-chapter romance, freeform). Editable, reorderable, insert/delete beats.
8. **Scenes (chapter beats)** — for the *current chapter*: an ordered list of scene cards (2–6 sentences each: what happens, who's present, where, emotional turn). Generate from Outline entry for that chapter. Each scene card links to §4.12 Draft.
9. **Draft** — see §4.12.

Additional requirements:
- **Word budget guardrails**: each field shows an approximate token cost; total Bible context is capped per generation (see §5.4) with saliency selection when over cap.
- Bible **import/export** (JSON + Markdown).
- Bible changes are versioned (last 50 revisions per field, restorable).

### 4.12 Draft (First Draft / chapter generation)

Converts scene beats into prose — the "write 1,000+ words at once" flow.

- From a chapter's Scenes list: **Draft chapter** generates prose scene-by-scene sequentially (each scene sees the prose generated for previous scenes) into a *new* document draft area — never overwrites existing text; user reviews and accepts per-scene or whole-chapter.
- Length control per scene (short ~300 / medium ~600 / long ~1,200 words).
- Uses Style field aggressively; runs a post-pass "voice conformance" check when Match-My-Style is set (P1).
- Also available standalone as **First Draft**: user pastes a premise (no Bible required) → generates a 500–1,000 word opening. Used in onboarding to deliver a "wow" in < 2 minutes.

### 4.13 Saliency engine

Automatic selection of *which* Bible entries to include per generation:

- **P0 (baseline)**: lexical matching — include characters/worldbuilding entries whose names/aliases appear in the local context window (last 2,500 words + any Guided instruction), always include Genre, Style, Synopsis, and the current chapter's outline entry + scenes.
- **P1 (smart)**: embedding similarity between local context and Bible entries; ranked, greedily packed to the context budget. Show the author which entries were included (transparency popover: "Context used: Mara, The Hollow Court, Ch. 7 outline").
- Manual override: per-entry pin (always include) / hide (never include).

### 4.14 Canvas (P1)

Infinite zoomable board per project for visual planning:
- Node types: sticky note, character card (linked to Bible character), scene card, image, group/frame. Edges: labeled arrows.
- AI actions on canvas: "expand this node into 5 child ideas", "suggest connections", "turn selected nodes into an outline" (writes to Story Bible Outline with confirmation).
- Implementation: `reactflow` (or `tldraw`) + server-persisted JSON. Realtime sync not required (single user), but must autosave like the editor.

### 4.15 Visualize (P2)

Generate character portraits / scene art from Bible entries via an image-model API. Output gallery per project; attach an image to a character entry. Charge fixed credits per image (see §7).

### 4.16 Plugins (P1 personal → P2 marketplace)

User-defined AI tools:
- A plugin = name, description, icon, **prompt template** with variables: `{{selection}}`, `{{document}}`, `{{story_bible}}`, `{{user_input}}`, + model + temperature + output mode (cards / replace / chat).
- Builder UI with live test pane. Personal plugins appear in the selection menu and tools drawer.
- P2: publish to a marketplace (moderated), install counts, ratings. Prompt-injection review required before public listing.

### 4.17 Onboarding

- On signup: 3-question wizard (What are you writing? Genre? Do you have existing pages?) → creates first project.
- Interactive tutorial project ("The Haunted Lighthouse") with checklist: run Write, run Describe, fill a Character, generate a First Draft. Completing checklist grants bonus credits (e.g. +10,000).
- Empty states everywhere teach the adjacent feature.

---

## 5. AI architecture

### 5.1 Provider abstraction

- All model calls go through one internal **LLM service** with a provider-agnostic interface: `generate({messages, model, maxTokens, temperature, stream, stop})` and `embed({texts, model})`.
- Providers v1: **Anthropic (Claude)** primary; **OpenAI-compatible** adapter secondary (kept as fallback + for prose-mode variety). Design so providers are config, not code.
- Every call is logged (see §5.6) and metered (see §7).
- Retries: 2 retries on 5xx/timeouts w/ exponential backoff; automatic fallback model per prose mode; circuit breaker per provider.

### 5.2 Prose modes (user-facing model picker)

Users pick a *mode*, not a raw model id:

| Mode | Backing (initial mapping) | Use |
|---|---|---|
| **Everyday** (default) | Claude Sonnet (latest) | Balanced quality/cost, all tools |
| **Best prose** | Claude Opus-tier (latest) | Write/Rewrite/Draft when quality matters; higher credit multiplier |
| **Fast & cheap** | Claude Haiku (latest) | Brainstorm, Describe, high-volume drafting |
| **Experimental** | rotating alt-provider model | variety-seeking users |

Mapping lives in server config (hot-swappable). Non-prose internal tasks (saliency ranking, summarization, style analysis) always use the cheap tier regardless of user selection.

### 5.3 Prompt system

- Prompts are **versioned templates** in the repo (`/prompts/*.yaml`): id, version, description, model params, system template, user template, few-shot examples, expected output schema (for JSON tools), and changelog.
- Prose tools (Write/Rewrite/Describe/Expand/Draft) demand **plain prose out** — prompts must forbid preamble ("Here's a continuation…"), quotes around output, and markdown unless in source. Strip/validate server-side; auto-retry once with a corrective message on violation.
- Structured tools (Brainstorm, Feedback, style analysis, saliency) demand **JSON**, validated with Zod; one corrective retry on parse failure, then graceful error.
- Global system rules included in every prose prompt: honor POV/tense/genre/style; never contradict Story Bible facts; never end mid-sentence unless the source does; match the author's paragraphing; content policy passthrough (fiction may include conflict/violence within provider policy — do not moralize or add disclaimers inside prose).
- Every generation stores `promptId@version + model` for reproducibility/debugging.

### 5.4 Context assembly (the critical path)

Per prose generation, build the prompt in priority order under a **context budget** (default 12k tokens input; configurable per mode):

1. Global system rules + POV/tense/genre + Style text.
2. Tool instruction (+ user guidance/tone).
3. Salient Story Bible entries (§4.13), packed by rank until budget.
4. **Chapter summary chain**: rolling auto-summaries of all *prior* chapters (each chapter auto-summarized to ~120 words on save-settle; cached, invalidated on edit). Gives whole-book continuity cheaply.
5. Local manuscript window: the last N words before cursor (N as large as remaining budget allows, min 1,000, target 2,500) and, for selection tools, up to 500 words after the selection.

Deterministic truncation rules; log what was included for the transparency popover.

### 5.5 Streaming

- Server streams via **SSE** (`POST /ai/generate` → `text/event-stream`): events `start` (id, tool, model), `delta` (text), `section` (for Describe's multi-part output), `usage`, `done`, `error`.
- Client renders deltas immediately; a stopped stream sends `abort` and settles usage for tokens emitted.

### 5.6 Logging, cost & quality telemetry

- Per call: user, project, tool, promptId@version, model, input/output tokens, latency to first token, total latency, stop reason, thumbs feedback if given, credits charged.
- Dashboards (internal): cost/user/day, tool usage mix, thumb-rate per prompt version (this is how prompt changes get evaluated — never change a prompt without comparing thumb-rates).
- **Privacy:** raw prompt/output text logged only transiently (72h, for abuse/debug) then hard-deleted; metadata retained. User text never used for training (state this in ToS and settings).

---

## 6. Data model (Postgres)

Naming: snake_case, `uuid` PKs, `created_at`/`updated_at` everywhere, soft-delete `deleted_at` where noted.

```
users            (id, email, name, password_hash?, oauth_provider?, oauth_sub?,
                  email_verified_at, settings_json, deleted_at)
subscriptions    (id, user_id, stripe_customer_id, stripe_sub_id, plan,
                  status, current_period_start/end, cancel_at?)
credit_ledger    (id, user_id, delta, balance_after, reason enum
                  [grant_monthly, grant_bonus, spend, refund, expire, rollover],
                  ref_generation_id?, expires_at?, created_at)   -- append-only
projects         (id, user_id, title, genre, description, pov, tense,
                  settings_json, archived_at, deleted_at)
documents        (id, project_id, title, position, content_json (TipTap),
                  word_count, summary_text, summary_stale bool, deleted_at)
snapshots        (id, document_id, content_json, cause enum[auto, manual, pre_ai],
                  word_count, created_at)
bible_fields     (id, project_id, kind enum[braindump, genre, style, synopsis],
                  content_text, locked bool)
bible_entries    (id, project_id, kind enum[character, worldbuilding],
                  name, aliases text[], fields_json, visibility enum
                  [auto, always, never], position, deleted_at)
outline_beats    (id, project_id, position, title, summary)
scenes           (id, project_id, document_id, position, summary,
                  draft_generation_id?)
generations      (id, user_id, project_id, document_id?, tool, prompt_id,
                  prompt_version, model, params_json, input_summary_json,
                  output_text, status enum[streaming, done, stopped, error],
                  input_tokens, output_tokens, credits, feedback smallint?,
                  created_at)               -- powers the History drawer
chats            (id, project_id, title, created_at)
chat_messages    (id, chat_id, role, content, generation_id?, created_at)
idea_box         (id, project_id, category, text, source_generation_id?)
plugins          (id, owner_id, name, description, template, model, params_json,
                  visibility enum[private, unlisted, public], deleted_at)
canvas_boards    (id, project_id, data_json)
embeddings       (id, project_id, ref_kind enum[bible_entry, chapter_summary],
                  ref_id, vector vector(1536), text_hash)   -- pgvector
```

- `credit_ledger` is the source of truth for balance (sum of deltas); cache current balance on `users` for reads, reconcile nightly.
- `documents.content_json` is authoritative; derive plain text server-side for AI context (cache with hash).

---

## 7. Credits, plans & billing

### 7.1 Credits

- 1 credit ≈ 1 output token equivalent, weighted by model tier (multipliers: Fast 0.5×, Everyday 1×, Best prose 5×, Experimental 1×; input tokens charged at 0.25× their multiplier). Multipliers are server config.
- Fixed prices for non-text: Visualize image = 2,000 credits.
- Balance visible in header (live-decrements after each generation) + a **Usage page**: spend by day/tool/model, current period, history.
- Hitting zero: prose tools disabled with clear upsell; editor/Bible/manual features always keep working.
- Low-balance warning at 10%.

### 7.2 Plans (match Sudowrite's shape)

| Plan | Price | Credits/mo | Notes |
|---|---|---|---|
| Hobby | $10/mo | 225,000 | — |
| Professional | $22/mo | 450,000 | + Feedback feature |
| Max | $44/mo | 2,000,000 | Unused credits roll over 12 months |

- Yearly billing at ~40–50% discount. Free trial: 7 days or 20,000 credits (whichever first), **no credit card required**.
- Stripe: Checkout for signup, Billing Portal for self-serve manage/cancel (one-click cancel — "EZ cancel" is a marketing point). Webhooks: subscription created/updated/deleted, invoice paid/failed → grant/adjust credits via ledger. Proration on plan change; grants are ledger entries with `expires_at` per plan rules.

---

## 8. API design (REST + SSE)

Base: `/api/v1`. Auth via session cookie. JSON bodies validated with Zod. Errors: `{error: {code, message}}` with stable machine codes.

```
Auth        POST /auth/signup | /auth/login | /auth/logout | /auth/google
            POST /auth/verify-email | /auth/forgot | /auth/reset
Projects    GET/POST /projects · GET/PATCH/DELETE /projects/:id
            POST /projects/:id/duplicate | /archive | /import | /export
Documents   GET/POST /projects/:id/documents · GET/PATCH/DELETE /documents/:id
            PATCH /projects/:id/documents/reorder
            GET /documents/:id/snapshots · POST /snapshots/:id/restore
Bible       GET /projects/:id/bible (full) · PATCH /projects/:id/bible/:kind
            CRUD /projects/:id/bible/entries · /outline · /scenes
            POST /projects/:id/bible/generate {target, fromFields}
AI          POST /ai/generate {tool, projectId, documentId?, selection?,
                               guidance?, settings} → SSE stream
            POST /ai/generations/:id/stop · POST /ai/generations/:id/feedback
            GET  /projects/:id/generations (history drawer)
Chat        CRUD /projects/:id/chats · POST /chats/:id/messages → SSE
Brainstorm  POST /ai/brainstorm {category, prompt, keeps[], discards[]}
Ideas       CRUD /projects/:id/ideas
Plugins     CRUD /plugins · POST /plugins/:id/run → SSE
Billing     GET /billing · POST /billing/checkout | /billing/portal
            GET /billing/usage · POST /webhooks/stripe
Canvas      GET/PUT /projects/:id/canvas
```

Rate limits: 60 AI requests/min/user, 5 concurrent streams/user; 429 with `Retry-After`.

---

## 9. Tech stack (recommended)

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript everywhere, strict mode | Team standard |
| Frontend | React 18 + Vite, TanStack Router + Query, Zustand for editor state | Fast SPA; editor-heavy app doesn't need SSR |
| Editor | TipTap 2 (ProseMirror) | Extensible, JSON doc model, decoration API for AI highlights |
| Styling | Tailwind + Radix primitives | Speed + a11y |
| Backend | Node 20 + Fastify | Perf + schema validation integration |
| Validation | Zod (shared schemas package) | One source of truth FE/BE |
| DB | Postgres 16 + pgvector, Drizzle ORM | Relational + embeddings in one store |
| Cache/queues | Redis + BullMQ | Summarization jobs, webhook processing, rate limiting |
| LLM | Anthropic SDK (+ OpenAI-compatible adapter) | §5.1 |
| Billing | Stripe | §7 |
| Email | Resend/Postmark | verification, receipts, trial nudges |
| Infra | Docker; Fly.io/Render/Railway; Neon/Supabase for Postgres | Simple start, scales |
| Observability | Sentry + OpenTelemetry + PostHog | Errors, traces, product analytics |
| Testing | Vitest (unit), Playwright (e2e), prompt snapshot tests | see §11 |

Monorepo (npm workspaces): `apps/web`, `apps/api`, `packages/shared` (types+zod), `packages/prompts`, `packages/llm`.

---

## 10. Non-functional requirements

- **Performance:** first token < 1.5s p50 / < 4s p95; editor keystroke latency < 16ms at 50k-word docs (virtualize or chunk long docs); autosave round-trip < 500ms p95.
- **Reliability:** 99.5% uptime target; zero data loss on crash (local buffer + retry queue for unsaved edits); graceful degradation when an LLM provider is down (fallback model banner).
- **Security:** OWASP baseline; all user text encrypted at rest (disk-level) and in transit; per-user tenancy checks on every query (no cross-user access — write tests for this); secrets in env/secret manager; Stripe webhook signature verification; plugin templates sanitized (no ability to exfiltrate other users' data — plugin context is only the invoking user's).
- **Prompt-injection posture:** manuscript and Bible text are data, not instructions — system prompts must instruct models to treat embedded imperative text as story content; plugin marketplace requires review (P2).
- **Privacy:** no training on user content; transient raw-text logs (§5.6); DPA-ready; account deletion purges all content within 30 days.
- **Accessibility:** WCAG 2.1 AA for chrome; full keyboard operability of editor and AI cards; reduced-motion support.
- **Browser support:** last 2 versions of Chrome/Edge/Firefox/Safari, desktop-first.

---

## 11. Testing & quality bar

- Unit: context assembly (budget packing, truncation determinism), credit math, ledger invariants, Zod schemas, saliency matcher.
- Integration: full generate flow with a **mock LLM provider** (deterministic outputs) — stream, stop, insert, snapshot-before-insert, charge.
- E2E (Playwright): signup → onboarding → First Draft → Write → Rewrite → export; billing flows against Stripe test mode.
- **Prompt evals:** a fixture suite of 20+ story contexts; on any prompt change, run evals and diff outputs for: format violations (preamble/quotes), POV/tense violations (regex + LLM-judge), Bible contradiction spot-checks. CI-gated.
- Load test: 200 concurrent SSE streams.

---

## 12. Milestones

**M1 — Foundation (weeks 1–3):** monorepo, auth, projects/documents CRUD, TipTap editor with autosave + snapshots + themes/focus mode, deploy pipeline.
**M2 — First magic (weeks 3–6):** LLM service + prompt system + context assembly (no saliency yet), Write (all 3 modes) with streaming cards, Rewrite, Describe, Expand, selection menu, generation history, mock-provider tests.
**M3 — Story Bible (weeks 6–9):** all Bible components + generation chains, chapter summary chain, baseline saliency, Scenes + Draft chapter flow, First Draft onboarding wow-moment.
**M4 — Monetize (weeks 9–11):** credits ledger + metering, Stripe plans/trial/portal, usage page, rate limits, Brainstorm + Idea Box, Quick Edit, Chat.
**M5 — Launch polish (weeks 11–13):** onboarding tutorial, import/export, Feedback tool, empty states, Sentry/analytics, prompt eval CI, load test, security pass. **Public launch.**
**M6 — Post-launch (P1/P2):** smart saliency (embeddings), Canvas, personal Plugins, Visualize, series support, marketplace.

Each milestone's acceptance criteria = the relevant §4 requirements demoably working + tests in §11 green.

---

## 13. Success metrics

- **Activation:** ≥ 60% of signups run a generation in first session; ≥ 40% reach the First Draft wow-moment in < 10 minutes.
- **Engagement:** ≥ 3 writing sessions/week for retained users; ≥ 30% of inserted words originate from AI cards (tracked via insert events).
- **Quality:** thumbs-up rate ≥ 65% on Write cards; format-violation rate < 1%.
- **Revenue:** trial→paid ≥ 12%; logo churn < 6%/mo; gross margin on credits ≥ 70% (COGS tracked per §5.6).

---

## 14. Risks & open questions

| Risk | Mitigation |
|---|---|
| LLM cost blowup on Max plan heavy users | Credit multipliers are config; monitor margin per user; cap concurrent streams |
| "AI-sounding" prose disappoints writers | Invest in Style/Match-My-Style + prompt evals; prose modes with stronger models |
| Provider policy blocks dark fiction content | Multi-provider fallback; clear in-product messaging when a generation is refused |
| Trademark/trade-dress risk vs. Sudowrite | Original name, branding, UI copy, and visual design; parity of *function* only |
| Long-doc editor performance | Chunked rendering; enforce doc-size guidance; perf budget in CI |

Open questions (decide before M4):
1. Trial shape — time-boxed vs. credit-boxed (recommend: both, whichever first).
2. Do we expose raw model names to users or only prose-mode labels? (Recommend labels only.)
3. Rollover policy for non-Max plans (recommend: none, matches reference product).
4. Which OpenAI-compatible provider ships in v1 as the fallback (pick one; adapter makes it swappable).

---

*End of PRD.*
