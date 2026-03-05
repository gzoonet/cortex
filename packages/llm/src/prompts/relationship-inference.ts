import { z } from 'zod';
import { LLMTask } from '@cortex/core';

export const PROMPT_ID = 'relationship_inference';
export const PROMPT_VERSION = '1.0.0';

export const systemPrompt = `You are a knowledge graph relationship engine. Given a set of entities, identify
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

IMPORTANT: Return ONLY valid JSON with this EXACT structure:
{"relationships": [...]}

If no relationships found, return: {"relationships": []}
No markdown, no code fences, no explanations. Just JSON.`;

export function buildUserPrompt(vars: {
  entities: Array<{
    id: string;
    type: string;
    name: string;
    summary?: string;
    sourceFile: string;
  }>;
}): string {
  const entityList = vars.entities
    .map((e) => `[${e.id}] ${e.type}: ${e.name}\n  Summary: ${e.summary ?? 'N/A'}\n  Source: ${e.sourceFile}`)
    .join('\n\n');

  return `Identify relationships between these entities.

ENTITIES:
${entityList}

For each relationship found:
- type: one of the valid relationship types
- sourceEntityId: the ID of the "from" entity
- targetEntityId: the ID of the "to" entity
- description: why this relationship exists (1 sentence)
- confidence: 0.0-1.0

Respond with ONLY this JSON structure:
{"relationships": [{"type": "...", "sourceEntityId": "...", "targetEntityId": "...", "description": "...", "confidence": 0.9}]}

If no relationships exist, respond: {"relationships": []}`;
}

export const outputSchema = z.object({
  relationships: z.array(z.object({
    type: z.enum([
      'depends_on', 'implements', 'contradicts', 'evolved_from',
      'relates_to', 'uses', 'constrains', 'resolves', 'documents', 'derived_from',
    ]),
    sourceEntityId: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
  })),
});

export type RelationshipInferenceOutput = z.infer<typeof outputSchema>;

export const config = {
  provider: 'cloud' as const,
  model: 'fast' as const,
  temperature: 0.1,
  maxTokens: 8192,
  task: LLMTask.RELATIONSHIP_INFERENCE,
};
