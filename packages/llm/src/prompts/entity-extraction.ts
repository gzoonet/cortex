import { z } from 'zod';
import { LLMTask } from '@cortex/core';

export const PROMPT_ID = 'entity_extraction';
export const PROMPT_VERSION = '1.0.0';

export const systemPrompt = `You are a knowledge extraction engine for a software development context.
Extract structured entities from the provided content. Each entity represents
a discrete piece of knowledge: a decision made, a requirement stated, a pattern
used, a component described, a dependency identified, an interface defined, a
constraint established, an action item assigned, a risk identified, or a note
recorded.

Return ONLY valid JSON matching the provided schema. No markdown, no explanation.`;

export function buildUserPrompt(vars: {
  filePath: string;
  projectName: string;
  fileType: string;
  content: string;
}): string {
  return `Extract entities from this content.
File: ${vars.filePath}
Project: ${vars.projectName}
File type: ${vars.fileType}

---CONTENT START---
${vars.content}
---CONTENT END---

Return a JSON object with an "entities" array (maximum 20 entities per response). For each entity:
- type: one of Decision, Requirement, Pattern, Component, Dependency, Interface, Constraint, ActionItem, Risk, Note
- name: concise identifier (3-8 words)
- content: the relevant text from the source (minimum 10 characters)
- summary: 1-2 sentence summary
- confidence: 0.0-1.0 (how confident you are this is a real entity)
- tags: relevant keywords
- properties: type-specific metadata (e.g., for Decision: {rationale, alternatives, date})

IMPORTANT: Focus on high-value entities only. For dependency lists (package.json, requirements.txt, go.mod), extract only the primary infrastructure/framework dependencies (e.g., the database driver, the main framework, the auth library) — NOT every single package. Group trivial dev tools into a single Note entity if needed.

Example format: {"entities": [{"type": "Decision", "name": "Use PostgreSQL", "content": "We decided to use PostgreSQL for the main database", "summary": "Team chose PostgreSQL.", "confidence": 0.9, "tags": ["database"], "properties": {}}]}

If no meaningful entities exist, return: {"entities": []}`;
}

const VALID_TYPES = [
  'Decision', 'Requirement', 'Pattern', 'Component', 'Dependency',
  'Interface', 'Constraint', 'ActionItem', 'Risk', 'Note',
] as const;

function coerceEntityType(val: string): typeof VALID_TYPES[number] {
  if ((VALID_TYPES as readonly string[]).includes(val)) {
    return val as typeof VALID_TYPES[number];
  }
  if (/rule|lint|option|setting|config/i.test(val)) return 'Constraint';
  if (/action|task|todo/i.test(val)) return 'ActionItem';
  if (/component|module|class|service/i.test(val)) return 'Component';
  if (/depend|import|library|package/i.test(val)) return 'Dependency';
  if (/require|must|shall|need/i.test(val)) return 'Requirement';
  return 'Note';
}

export const outputSchema = z.object({
  entities: z.array(z.object({
    type: z.enum(VALID_TYPES).catch((ctx) => coerceEntityType(String(ctx.input))),
    name: z.string().min(3).max(100),
    content: z.string().min(10),
    summary: z.string().max(300),
    confidence: z.number().min(0).max(1),
    tags: z.array(z.string()),
    properties: z.record(z.unknown()),
  })),
});

export type EntityExtractionOutput = z.infer<typeof outputSchema>;

export const config = {
  provider: 'cloud' as const,
  model: 'fast' as const,
  temperature: 0.1,
  maxTokens: 8192,
  task: LLMTask.ENTITY_EXTRACTION,
};
