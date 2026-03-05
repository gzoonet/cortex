import { z } from 'zod';
import { LLMTask } from '@cortex/core';

export const PROMPT_ID = 'context_ranking';
export const PROMPT_VERSION = '1.0.0';

export const systemPrompt = `You rank entities by relevance to a query. Return ONLY valid JSON.`;

export function buildUserPrompt(vars: {
  userQuery: string;
  candidates: Array<{ id: string; type: string; name: string; summary?: string }>;
}): string {
  const entityList = vars.candidates
    .map((e) => `[${e.id}] ${e.type}: ${e.name} — ${e.summary ?? 'N/A'}`)
    .join('\n');

  return `Rank these entities by relevance to the query. Return only the IDs in order.

Query: ${vars.userQuery}

Entities:
${entityList}

Return JSON: { "rankedIds": ["id1", "id2", ...], "excludeIds": ["id5", ...] }`;
}

export const outputSchema = z.object({
  rankedIds: z.array(z.string()),
  excludeIds: z.array(z.string()),
});

export type ContextRankingOutput = z.infer<typeof outputSchema>;

export const config = {
  provider: 'cloud' as const,
  model: 'fast' as const,
  temperature: 0.1,
  maxTokens: 500,
  task: LLMTask.CONTEXT_RANKING,
};
