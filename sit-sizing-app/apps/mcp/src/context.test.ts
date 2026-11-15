import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createToolContext, defineTool } from './context';
import { createRateLimiter } from './rate-limit';
import { fakeApi, fakeLogger } from './test-support';

const Out = z.object({ doubled: z.number() }).meta({ id: 'SyntheticOut' });

async function setup() {
  const { api, get } = fakeApi();
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
});
