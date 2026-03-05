# GZOO Cortex LLM Prompts

> Prompts are stored as versioned TypeScript modules in `packages/llm/src/prompts/`.
> Each prompt exports: `systemPrompt`, `buildUserPrompt(vars)`, `outputSchema` (Zod), `config`.

## P1: Entity Extraction

**Provider:** Cloud (Haiku) in Phase 1, Local (Mistral 7B) in Phase 2
**Temperature:** 0.1 | **Max Tokens:** 2,000 | **Structured Output:** Yes

### System Prompt
```
You are a knowledge extraction engine for a software development context.
Extract structured entities from the provided content. Each entity represents
a discrete piece of knowledge: a decision made, a requirement stated, a pattern
used, a component described, a dependency identified, an interface defined, a
constraint established, an action item assigned, a risk identified, or a note
recorded.

Return ONLY valid JSON matching the provided schema. No markdown, no explanation.
```

### User Prompt Template
```
Extract entities from this content.
File: {{filePath}}
Project: {{projectName}}
File type: {{fileType}}

---CONTENT START---
{{content}}
---CONTENT END---

Return JSON array of entities. For each entity:
- type: one of Decision, Requirement, Pattern, Component, Dependency, Interface, Constraint, ActionItem, Risk, Note
- name: concise identifier (3-8 words)
- content: the relevant text from the source
- summary: 1-2 sentence summary
- confidence: 0.0-1.0 (how confident you are this is a real entity)
- tags: relevant keywords
- properties: type-specific metadata (e.g., for Decision: {rationale, alternatives, date})
```

### Output Schema
```typescript
const EntityExtractionSchema = z.object({
  entities: z.array(z.object({
    type: z.enum(['Decision', 'Requirement', 'Pattern', 'Component', 'Dependency', 'Interface', 'Constraint', 'ActionItem', 'Risk', 'Note']),
    name: z.string().min(3).max(100),
    content: z.string().min(10),
    summary: z.string().max(300),
    confidence: z.number().min(0).max(1),
    tags: z.array(z.string()),
    properties: z.record(z.unknown()),
  }))
});
```

---

## P2: Relationship Inference

**Provider:** Cloud (Sonnet) — reasoning-heavy
**Temperature:** 0.1 | **Max Tokens:** 2,000 | **Structured Output:** Yes

### System Prompt
```
You are a knowledge graph relationship engine. Given a set of entities, identify
meaningful relationships between them. Relationships must be factual and
grounded in the content, not speculative.

Valid relationship types:
- depends_on: A requires B to function
- implements: A is an implementation of B
- contradicts: A conflicts with B
- evolved_from: A is a newer version/evolution of B
- relates_to: A and B are connected (general)
- uses: A uses/consumes B
- constrains: A places limits on B
- resolves: A addresses/solves B
- documents: A describes/documents B
- derived_from: A was created based on B

Return ONLY valid JSON. No markdown.
```

### User Prompt Template
```
Identify relationships between these entities.

ENTITIES:
{{#each entities}}
[{{this.id}}] {{this.type}}: {{this.name}}
  Summary: {{this.summary}}
  Source: {{this.sourceFile}}
{{/each}}

For each relationship found:
- type: one of the valid relationship types
- sourceEntityId: the ID of the "from" entity
- targetEntityId: the ID of the "to" entity
- description: why this relationship exists (1 sentence)
- confidence: 0.0-1.0
```

### Output Schema
```typescript
const RelationshipInferenceSchema = z.object({
  relationships: z.array(z.object({
    type: z.enum(['depends_on', 'implements', 'contradicts', 'evolved_from', 'relates_to', 'uses', 'constrains', 'resolves', 'documents', 'derived_from']),
    sourceEntityId: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
  }))
});
```

---

## P3: Entity Merge Detection

**Provider:** Local preferred | **Temperature:** 0.1 | **Max Tokens:** 500

### User Prompt Template
```
Are these two entities the same thing described differently?

Entity A: [{{a.type}}] {{a.name}}
  Content: {{a.summary}}
  Source: {{a.sourceFile}}

Entity B: [{{b.type}}] {{b.name}}
  Content: {{b.summary}}
  Source: {{b.sourceFile}}

Return JSON: { "shouldMerge": boolean, "confidence": 0.0-1.0, "reason": "..." }
```

---

## P4: Contradiction Detection

**Provider:** Cloud (Sonnet) — requires nuanced reasoning
**Temperature:** 0.1 | **Max Tokens:** 1,000

### User Prompt Template
```
Do these entities contradict each other?

Entity A: [{{a.type}}] {{a.name}}
  Content: {{a.content}}
  Date: {{a.createdAt}}
  Source: {{a.sourceFile}}

Entity B: [{{b.type}}] {{b.name}}
  Content: {{b.content}}
  Date: {{b.createdAt}}
  Source: {{b.sourceFile}}

Return JSON:
{
  "isContradiction": boolean,
  "severity": "low" | "medium" | "high",
  "description": "what conflicts and why",
  "suggestedResolution": "how to resolve this"
}
```

---

## P5: Conversational Query Synthesis

**Provider:** Cloud (Sonnet) — streaming enabled
**Temperature:** 0.7 | **Max Tokens:** 4,000

### System Prompt
```
You are GZOO Cortex, a knowledge assistant. Answer questions using ONLY the provided
context from the user's knowledge graph. Cite sources using [source:entityId] format.
If the context doesn't contain enough information, say so honestly.

Be concise, direct, and specific. Refer to decisions, patterns, and components
by name. When showing evolution of decisions, present them chronologically.
```

### User Prompt Template
```
CONTEXT:
{{#each contextEntities}}
[{{this.id}}] {{this.type}}: {{this.name}}
  {{this.content}}
  Source: {{this.sourceFile}} ({{this.createdAt}})
  {{#each this.relationships}}
    → {{this.type}} [{{this.targetEntityId}}]
  {{/each}}
{{/each}}

QUESTION: {{userQuery}}
```

---

## P6: Context Ranking

**Provider:** Local preferred | **Temperature:** 0.1 | **Max Tokens:** 500

### User Prompt Template
```
Rank these entities by relevance to the query. Return only the IDs in order.

Query: {{userQuery}}

Entities:
{{#each candidates}}
[{{this.id}}] {{this.type}}: {{this.name}} — {{this.summary}}
{{/each}}

Return JSON: { "rankedIds": ["id1", "id2", ...], "excludeIds": ["id5", ...] }
```

---

## P7: Follow-Up Generation

**Provider:** Cloud (Haiku) | **Temperature:** 0.8 | **Max Tokens:** 300

### User Prompt Template
```
Based on this Q&A, suggest 2-3 follow-up questions the user might want to ask.

Question: {{userQuery}}
Answer summary: {{answerSummary}}

Return JSON: { "followUps": ["question1", "question2", "question3"] }
```

---

## P8: Proactive Insight (Phase 3)

**Provider:** Local | **Temperature:** 0.5 | **Max Tokens:** 500

### User Prompt Template
```
The user is editing files in: {{activeDirectory}}
Recently modified: {{recentFiles}}

Related entities from knowledge graph:
{{#each relatedEntities}}
[{{this.id}}] {{this.type}}: {{this.name}} — {{this.summary}}
{{/each}}

Is there a useful insight to surface? Return JSON:
{ "hasInsight": boolean, "insight": "...", "confidence": 0.0-1.0, "relatedEntityIds": [...] }
```

---

## Prompt Implementation Pattern

```typescript
// packages/llm/src/prompts/entity-extraction.ts
import { z } from 'zod';

export const PROMPT_ID = 'entity_extraction';
export const PROMPT_VERSION = '1.0.0';

export const systemPrompt = `...`;

export function buildUserPrompt(vars: {
  filePath: string;
  projectName: string;
  fileType: string;
  content: string;
}): string {
  return `Extract entities from this content.
File: ${vars.filePath}
...`;
}

export const outputSchema = z.object({
  entities: z.array(z.object({ /* ... */ }))
});

export const config = {
  provider: 'cloud' as const,       // Phase 1 default
  model: 'fast' as const,           // Haiku
  temperature: 0.1,
  maxTokens: 2000,
  task: 'entity_extraction' as const,
};
```

## Output Parsing Strategy

1. Strip markdown fences from response (`\`\`\`json ... \`\`\``)
2. Find first `{` or `[` to last `}` or `]`
3. `JSON.parse()` the extracted string
4. Validate with Zod schema
5. If parse fails: append correction prompt and retry ONCE
6. If retry fails: add to dead letter queue, continue pipeline
