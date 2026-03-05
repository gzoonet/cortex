import { z } from 'zod';
import { LLMTask } from '@cortex/core';

export const PROMPT_ID = 'contradiction_detection';
export const PROMPT_VERSION = '1.0.0';

export const systemPrompt = `You detect contradictions between knowledge entities. Return ONLY valid JSON.`;

export function buildUserPrompt(vars: {
  a: { type: string; name: string; content: string; createdAt: string; sourceFile: string };
  b: { type: string; name: string; content: string; createdAt: string; sourceFile: string };
}): string {
  return `Do these two entities DIRECTLY contradict each other?

Entity A: [${vars.a.type}] ${vars.a.name}
  Content: ${vars.a.content}
  Source: ${vars.a.sourceFile}

Entity B: [${vars.b.type}] ${vars.b.name}
  Content: ${vars.b.content}
  Source: ${vars.b.sourceFile}

RULES — return isContradiction=false if:
- The entities are about different topics or concerns (most pairs)
- One entity doesn't affect or conflict with the other
- They are independent requirements that can both be satisfied simultaneously

Only return isContradiction=true if BOTH entities are about the SAME specific topic AND they make conflicting claims that cannot both be true.

Return JSON:
{
  "isContradiction": boolean,
  "severity": "low" | "medium" | "high",
  "description": "what specifically conflicts and why",
  "suggestedResolution": "how to resolve this"
}`;
}

export const outputSchema = z.object({
  isContradiction: z.boolean(),
  severity: z.enum(['low', 'medium', 'high']),
  description: z.string(),
  suggestedResolution: z.string(),
});

export type ContradictionDetectionOutput = z.infer<typeof outputSchema>;

export const config = {
  provider: 'cloud' as const,
  model: 'fast' as const,
  temperature: 0.1,
  maxTokens: 1000,
  task: LLMTask.CONTRADICTION_DETECTION,
};
