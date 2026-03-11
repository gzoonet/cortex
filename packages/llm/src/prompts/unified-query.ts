import { LLMTask } from '@cortex/core';

export const PROMPT_ID = 'unified_query';
export const PROMPT_VERSION = '1.0.0';

export const systemPrompt = `You are Cortex, a knowledge assistant. Answer questions using the provided context from the user's knowledge graph.

Rules:
- Be concise and specific. Reference entities by name and type (e.g., "[Decision] Use PostgreSQL").
- Mention the source file when citing a fact.
- If contradictions exist between entities, acknowledge them.
- If the context lacks enough information, say so briefly.
- Do not make up information not present in the context.`;

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
  contradictions?: Array<{
    id: string;
    severity: string;
    description: string;
    entityNames: [string, string];
  }>;
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

  if (vars.contradictions && vars.contradictions.length > 0) {
    const contradictionText = vars.contradictions
      .map((c) => `[${c.severity.toUpperCase()}] ${c.entityNames[0]} vs ${c.entityNames[1]}: ${c.description}`)
      .join('\n');
    parts.push(`Active contradictions:\n${contradictionText}`);
  }

  return `${parts.join('\n\n')}\n\nQuestion: ${vars.userQuery}`;
}

export const config = {
  provider: 'cloud' as const,
  model: 'primary' as const,
  temperature: 0.7,
  maxTokens: 800,
  task: LLMTask.CONVERSATIONAL_QUERY,
  stream: true,
};
