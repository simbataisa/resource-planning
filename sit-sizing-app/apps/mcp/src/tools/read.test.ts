import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createToolContext } from '../context';
import { ApiCallError } from '../errors';
import { createRateLimiter } from '../rate-limit';
import { fakeApi, fakeLogger, ME } from '../test-support';
import { registerReadTools } from './read';

async function connect(bodies?: Record<string, unknown>) {
  const { api, get } = fakeApi(bodies);
  const ctx = createToolContext({
    api,
    log: fakeLogger().log,
    userKey: 'u',
    limiter: createRateLimiter({ limit: 60 }),
  });
  const server = new McpServer({ name: 't', version: '0' });
  registerReadTools(server, ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'c', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, get };
}

describe('read tools', () => {
  it('whoami calls GET /me and returns the parsed user', async () => {
    const { client, get } = await connect();
    const r = await client.callTool({ name: 'whoami', arguments: {} });
    expect(get).toHaveBeenCalledWith('/me', expect.anything());
    expect(r.structuredContent).toEqual(ME);
  });

  it('whoami passes NOT_PROVISIONED through as a tool error', async () => {
    const { client } = await connect({
      '/me': new ApiCallError({
        status: 403,
        code: 'NOT_PROVISIONED',
        message: 'Sign in to SIT Sizing once first',
      }),
    });
    const r = await client.callTool({ name: 'whoami', arguments: {} });
    expect(r.isError).toBe(true);
    expect((r.content as Array<{ text: string }>)[0]?.text).toMatch(/^NOT_PROVISIONED: /);
  });
});
