import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StoreBundle } from './store-factory.js';
import { handleSessionBrief } from './tools/brief.js';

/**
 * Register Cortex MCP resources (read-only context).
 *
 * Resources:
 * - cortex://brief — Session briefing with key entities, contradictions, recent changes
 */
export function registerResources(mcp: McpServer, bundle: StoreBundle): void {
  mcp.registerResource(
    'session-brief',
    'cortex://brief',
    {
      description:
        'Read this at the start of every session. Contains key entities, recent changes, ' +
        'open contradictions, and a graph summary from the Cortex knowledge graph. ' +
        'This gives you full project context without needing to query individual tools.',
      mimeType: 'text/markdown',
    },
    async () => {
      const result = await handleSessionBrief(bundle.store);
      return {
        contents: [{
          uri: 'cortex://brief',
          mimeType: 'text/markdown',
          text: result.markdown,
        }],
      };
    },
  );
}
