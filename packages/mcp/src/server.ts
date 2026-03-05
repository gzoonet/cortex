import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { StoreBundle } from './store-factory.js';
import type { Router } from '@cortex/llm';
import { handleQueryCortex } from './tools/query.js';
import { handleFindEntity } from './tools/find.js';
import { handleListProjects } from './tools/projects.js';
import { handleGetStatus } from './tools/status.js';
import { handleGetContradictions, handleResolveContradiction } from './tools/contradictions.js';

export function createCortexMcpServer(bundle: StoreBundle, router: Router): McpServer {
  const server = new McpServer({
    name: 'cortex',
    version: '0.1.0',
  });

  server.registerTool(
    'get_status',
    {
      title: 'Get Cortex Status',
      description:
        'Get current status of the Cortex knowledge graph: entity count, relationship count, ' +
        'file count, and whether the graph has data. Check this first to verify Cortex is populated.',
    },
    async () => {
      const result = await handleGetStatus(bundle.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    'list_projects',
    {
      title: 'List Cortex Projects',
      description:
        'List all projects registered in Cortex with their file and entity counts. ' +
        'Use the project id to scope query_cortex to a specific project.',
    },
    async () => {
      const result = await handleListProjects(bundle.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    'find_entity',
    {
      title: 'Find Entity',
      description:
        'Look up a specific entity by name or UUID in the Cortex knowledge graph. ' +
        'Returns entity details and optionally its relationships to other entities. ' +
        'Use this for precise lookups: decisions, patterns, components, dependencies.',
      inputSchema: {
        name: z.string().describe('Entity name (fuzzy matched) or exact UUID'),
        expand: z.boolean().optional().describe(
          'Include all relationships with neighbor entity names (default: false)',
        ),
        type: z.string().optional().describe(
          'Filter by entity type: Decision, Requirement, Pattern, Component, ' +
          'Dependency, Interface, Constraint, ActionItem, Risk, Note',
        ),
      },
    },
    async ({ name, expand, type }) => {
      const result = await handleFindEntity({ name, expand: expand ?? false, type }, bundle.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    'query_cortex',
    {
      title: 'Query Cortex Knowledge Graph',
      description:
        'Answer a natural language question using the Cortex knowledge graph. ' +
        'Returns an LLM-generated answer with cited entities. ' +
        'Use this to understand decisions, architectural choices, patterns, and ' +
        'dependencies across watched projects.',
      inputSchema: {
        question: z.string().describe('The natural language question to answer'),
        projectId: z.string().optional().describe(
          'Scope context to a specific project. Get IDs from list_projects.',
        ),
      },
    },
    async ({ question, projectId }) => {
      const result = await handleQueryCortex(
        { question, projectId },
        bundle.queryEngine,
        router,
        bundle.store,
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );


  server.registerTool(
    'get_contradictions',
    {
      title: 'Get Contradictions',
      description:
        'List contradictions detected in the knowledge graph. Contradictions occur when ' +
        'two entities make conflicting claims (e.g., different tech choices for the same thing). ' +
        'Returns both entities with summaries so you can understand and help resolve them.',
      inputSchema: {
        status: z.string().optional().describe(
          'Filter by status: active, resolved, or dismissed (default: all)',
        ),
        limit: z.number().optional().describe('Max results to return (default: 50)'),
      },
    },
    async ({ status, limit }) => {
      const result = await handleGetContradictions({ status, limit }, bundle.store);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.registerTool(
    'resolve_contradiction',
    {
      title: 'Resolve Contradiction',
      description:
        'Resolve a contradiction by choosing an action: ' +
        'supersede (entity A replaces B), keep_old (keep B, discard A), ' +
        'dismiss (not a real contradiction), both_valid (both are correct in context). ' +
        'Get contradiction IDs from get_contradictions first.',
      inputSchema: {
        id: z.string().describe('The contradiction ID to resolve'),
        action: z.string().describe(
          'Resolution action: supersede, keep_old, dismiss, or both_valid',
        ),
      },
    },
    async ({ id, action }) => {
      const result = await handleResolveContradiction({ id, action }, bundle.store);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  return server;
}
