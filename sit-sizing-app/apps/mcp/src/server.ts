import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './context';
import { registerReadTools } from './tools/read';

export const SERVER_INFO = { name: 'sit-sizing', version: '0.1.0' } as const;

/** One MCP server per request, holding that request's context (stateless transport). */
export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
  registerReadTools(server, ctx);
  return server;
}
