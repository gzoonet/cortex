#!/usr/bin/env node
/**
 * GZOO Cortex MCP Server — stdio transport
 *
 * IMPORTANT: stdout belongs to the JSON-RPC transport.
 * Setting CORTEX_LOG_LEVEL=error before any imports causes createLogger()
 * to default to 'error' level, so info/debug never reach stdout.
 */

// Must be set before any @cortex/* imports that create Logger instances
if (!process.env['CORTEX_LOG_LEVEL']) {
  process.env['CORTEX_LOG_LEVEL'] = 'error';
}

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from '@cortex/core';
import { Router } from '@cortex/llm';
import { createStoreBundle } from './store-factory.js';
import { createCortexMcpServer } from './server.js';

async function main(): Promise<void> {
  const configDir = process.env['CORTEX_CONFIG_DIR'];
  const config = loadConfig({ configDir });

  const bundle = await createStoreBundle(configDir);

  const router = new Router({ config });

  const server = createCortexMcpServer(bundle, router);
  const transport = new StdioServerTransport();

  process.on('SIGINT', () => { bundle.cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { bundle.cleanup(); process.exit(0); });

  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[cortex-mcp] Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
