import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createToolContext, defineTool } from './context';
import { ApiCallError } from './errors';
import { createRateLimiter } from './rate-limit';
import { fakeApi, fakeLogger } from './test-support';

const Out = z.object({ doubled: z.number() }).meta({ id: 'SyntheticOut' });

async function setup(bodies?: Record<string, unknown>) {
  const { api, get } = fakeApi(bodies);
  const { log, calls } = fakeLogger();
  const ctx = createToolContext({
    api,
    log,
    userKey: 'user-1',
    limiter: createRateLimiter({ limit: 60 }),
  });
  const server = new McpServer({ name: 't', version: '0' });
  defineTool(
    server,
    ctx,
    'double',
    {
      title: 'Double',
      description: 'Doubles a number',
      inputSchema: z.object({ n: z.number(), note: z.string().optional() }),
      outputSchema: Out,
      annotations: { readOnlyHint: true },
    },
    async ({ n }) => {
      if (n < 0) throw new Error('internal detail');
      return { doubled: n * 2 };
    },
  );
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'c', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, ctx, get, calls };
}

describe('defineTool', () => {
  it('passes validated arguments and returns structured content and JSON text', async () => {
    const { client } = await setup();
    const r = await client.callTool({ name: 'double', arguments: { n: 21 } });
    expect(r.structuredContent).toEqual({ doubled: 42 });
    expect((r.content as Array<{ text: string }>)[0]?.text).toBe('{"doubled":42}');
  });

  it('publishes an object output schema even for a schema registered with an id', async () => {
    const { client } = await setup();
    const { tools } = await client.listTools();
    expect(tools[0]?.outputSchema).toMatchObject({
      type: 'object',
      properties: { doubled: { type: 'number' } },
    });
  });

  it('hides unexpected errors and logs no arguments', async () => {
    const { client, calls } = await setup();
    const r = await client.callTool({
      name: 'double',
      arguments: { n: -1, note: 'SYNTHETIC-NOTE-91' },
    });
    expect(r.isError).toBe(true);
    expect((r.content as Array<{ text: string }>)[0]?.text).not.toContain('internal detail');
    expect(JSON.stringify(calls)).not.toContain('SYNTHETIC-NOTE-91');
    expect(JSON.stringify(calls)).toContain('"status":"error"');
  });

  it('reaches the API once per request even when the handler makes no API call', async () => {
    const { client, get } = await setup();
    await client.callTool({ name: 'double', arguments: { n: 1 } });
    await client.callTool({ name: 'double', arguments: { n: 2 } });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/me', expect.anything());
  });

  it('turns an API 401 on that call into the auth challenge', async () => {
    const { client, calls } = await setup({
      '/me': new ApiCallError({ status: 401, code: 'UNAUTHENTICATED', message: 'expired' }),
    });
    // The SDK reports a throw from the tool as an error result; the HTTP layer answers 401
    // from the API client's `onUnauthorized` hook, so here the message and log line show it.
    const r = await client.callTool({ name: 'double', arguments: { n: 1 } });
    expect(r.isError).toBe(true);
    expect((r.content as Array<{ text: string }>)[0]?.text).toMatch(/Authentication required/);
    expect(JSON.stringify(calls)).toContain('"status":"auth_challenge"');
  });

  // The API authorises every tool call: a refusal of GET /me stops even a local-only tool.
  it.each([
    [
      403,
      new ApiCallError({ status: 403, code: 'NOT_PROVISIONED', message: 'no' }),
      /^NOT_PROVISIONED: no/,
    ],
    [
      429,
      new ApiCallError({ status: 429, code: 'RATE_LIMITED', message: 'slow', retryAfter: 7 }),
      /^RATE_LIMITED: slow Retry after 7 seconds\./,
    ],
    [
      503,
      new ApiCallError({ status: 503, code: 'UNAVAILABLE', message: 'down' }),
      /^UNAVAILABLE: down/,
    ],
  ])('returns a %i on GET /me as a tool error without running the tool', async (_s, err, re) => {
    const { client, calls } = await setup({ '/me': err });
    const r = await client.callTool({ name: 'double', arguments: { n: 4 } });
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toBeUndefined();
    expect((r.content as Array<{ text: string }>)[0]?.text).toMatch(re);
    expect(JSON.stringify(calls)).toContain('"status":"error"');
  });
});
