import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Me } from '@sit/schemas';
import { defineTool, type ToolContext } from '../context';

/** Read tools (design spec 6.3). All read-only; each calls one API endpoint. */
export function registerReadTools(server: McpServer, ctx: ToolContext): void {
  defineTool(
    server,
    ctx,
    'whoami',
    {
      title: 'Who am I',
      description:
        'The signed-in SIT Sizing user: name, global role, preferred language and role in each project.',
      outputSchema: Me,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => ctx.api.get('/me', Me),
  );
}
