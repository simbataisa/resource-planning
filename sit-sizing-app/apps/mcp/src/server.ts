import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './context';
import { registerReadTools } from './tools/read';
import { registerUnderstandTools } from './tools/understand';
import { registerWriteTools } from './tools/write';

export const SERVER_INFO = { name: 'sit-sizing', version: '0.1.0' } as const;

/** One MCP server per request, holding that request's context (stateless transport). */
export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
  registerReadTools(server, ctx);
  registerUnderstandTools(server, ctx);
  registerWriteTools(server, ctx);
  return server;
}
