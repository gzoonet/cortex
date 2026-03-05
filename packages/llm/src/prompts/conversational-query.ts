import { LLMTask } from '@cortex/core';

export const PROMPT_ID = 'conversational_query';
export const PROMPT_VERSION = '1.0.0';

export const systemPrompt = `You are Cortex, a knowledge assistant. Answer questions using the provided context from the user's knowledge graph.
Be concise and specific. Refer to decisions, patterns, and components by name.
Mention the source file when citing a fact. If the context lacks enough information, say so briefly.`;

export function buildUserPrompt(vars: {
  contextEntities: Array<{
    id: string;
    type: string;
    name: string;
    content: string;
    sourceFile: string;
    createdAt: string;
    relationships: Array<{ type: string; targetEntityId: string }>;
  }>;
  userQuery: string;
  graphSummary?: string;
}): string {
  const parts: string[] = [];

  if (vars.graphSummary) {
    parts.push(`Graph stats:\n${vars.graphSummary}`);
  }

  if (vars.contextEntities.length > 0) {
    const context = vars.contextEntities
      .map((e) => {
        const file = e.sourceFile.replace(/\\/g, '/').split('/').pop() ?? e.sourceFile;
        const rels = e.relationships.length > 0
          ? `\n  Relations: ${e.relationships.map((r) => r.type).join(', ')}`
          : '';
        return `[${e.type}] ${e.name}\n  ${e.content}\n  (${file})${rels}`;
      })
      .join('\n\n');
    parts.push(`Relevant entities:\n${context}`);
  }

  return `${parts.join('\n\n')}\n\nQuestion: ${vars.userQuery}`;
}

export const config = {
  provider: 'cloud' as const,
  model: 'primary' as const,
  temperature: 0.7,
  maxTokens: 600,
  task: LLMTask.CONVERSATIONAL_QUERY,
  stream: true,
};
