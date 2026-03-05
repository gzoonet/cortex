import { z } from 'zod';
import { LLMTask } from '@cortex/core';

export const PROMPT_ID = 'follow_up_generation';
export const PROMPT_VERSION = '1.0.0';

export const systemPrompt = `You suggest follow-up questions based on a Q&A exchange. Return ONLY valid JSON.`;

export function buildUserPrompt(vars: {
  userQuery: string;
  answerSummary: string;
}): string {
  return `Suggest 2-3 follow-up questions based on this exchange.

Question: ${vars.userQuery}
Answer: ${vars.answerSummary}

Respond with ONLY this JSON, no other text:
{"followUps":["<question 1>","<question 2>","<question 3>"]}`;
}

export const outputSchema = z.object({
  followUps: z.array(z.string()).min(1).max(5),
});

export type FollowUpGenerationOutput = z.infer<typeof outputSchema>;

export const config = {
  provider: 'cloud' as const,
  model: 'fast' as const,
  temperature: 0.8,
  maxTokens: 300,
  task: LLMTask.CONVERSATIONAL_QUERY,
};
