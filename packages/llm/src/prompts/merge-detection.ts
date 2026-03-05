import { z } from 'zod';
import { LLMTask } from '@cortex/core';

export const PROMPT_ID = 'merge_detection';
export const PROMPT_VERSION = '1.0.0';

export const systemPrompt = `You determine if two entities represent the same concept described differently. Return ONLY valid JSON.`;

export function buildUserPrompt(vars: {
  a: { type: string; name: string; summary?: string; sourceFile: string };
  b: { type: string; name: string; summary?: string; sourceFile: string };
}): string {
  return `Are these two entities the same thing described differently?

Entity A: [${vars.a.type}] ${vars.a.name}
  Content: ${vars.a.summary ?? 'N/A'}
  Source: ${vars.a.sourceFile}

Entity B: [${vars.b.type}] ${vars.b.name}
  Content: ${vars.b.summary ?? 'N/A'}
  Source: ${vars.b.sourceFile}

Return JSON: { "shouldMerge": boolean, "confidence": 0.0-1.0, "reason": "..." }`;
}

export const outputSchema = z.object({
  shouldMerge: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export type MergeDetectionOutput = z.infer<typeof outputSchema>;

export const config = {
  provider: 'cloud' as const,
  model: 'fast' as const,
  temperature: 0.1,
  maxTokens: 500,
  task: LLMTask.ENTITY_EXTRACTION,
};
