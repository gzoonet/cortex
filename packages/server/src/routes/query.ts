import { Router } from 'express';
import { LLMTask } from '@cortex/core';
import type { ServerBundle } from '../index.js';

export function createQueryRoutes(bundle: ServerBundle): Router {
  const router = Router();
  const { queryEngine, router: llmRouter } = bundle;

  // POST /query
  router.post('/', async (req, res) => {
    try {
      const { query, projectId, stream = false } = req.body as {
        query: string;
        projectId?: string;
        stream?: boolean;
      };

      if (!query || typeof query !== 'string') {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'query is required' } });
        return;
      }

      // Assemble context from knowledge graph
      const context = await queryEngine.assembleContext(query, undefined, projectId);

      if (stream) {
        // SSE streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const systemPrompt = buildQuerySystemPrompt(context);

        const gen = llmRouter.stream({
          systemPrompt,
          userPrompt: query,
          promptId: 'conversational_query',
          promptVersion: '1.0',
          task: LLMTask.CONVERSATIONAL_QUERY,
          modelPreference: 'primary',
          temperature: 0.7,
        });

        for await (const chunk of gen) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }

        // Send sources
        res.write(`data: ${JSON.stringify({ type: 'sources', entities: context.entities.slice(0, 10) })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();
        return;
      }

      // Non-streaming: complete response
      const systemPrompt = buildQuerySystemPrompt(context);
      const result = await llmRouter.complete({
        systemPrompt,
        userPrompt: query,
        promptId: 'conversational_query',
        promptVersion: '1.0',
        task: LLMTask.CONVERSATIONAL_QUERY,
        modelPreference: 'primary',
        temperature: 0.7,
      });

      res.json({
        success: true,
        data: {
          answer: result.content,
          sources: context.entities.slice(0, 10),
          relationships: context.relationships,
          model: result.model,
          tokens: { input: result.inputTokens, output: result.outputTokens },
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'QUERY_FAILED', message: String(err) } });
    }
  });

  return router;
}

function buildQuerySystemPrompt(context: { entities: Array<{ name: string; type: string; content: string; summary?: string }>; relationships: Array<{ type: string; sourceEntityId: string; targetEntityId: string; description?: string }> }): string {
  const entityContext = context.entities
    .map((e, i) => `[${i + 1}] ${e.type}: ${e.name}\n${e.summary ?? e.content}`)
    .join('\n\n');

  return `You are Cortex, a knowledge graph assistant. Answer questions using ONLY the context below. Cite sources as [N].

## Knowledge Context
${entityContext || 'No relevant entities found.'}

## Instructions
- Answer concisely and accurately based on the context
- Cite sources using [N] notation
- If the context doesn't contain enough information, say so
- Suggest follow-up questions the user might ask`;
}
