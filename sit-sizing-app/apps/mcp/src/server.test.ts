import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createToolContext } from './context';
import { ApiCallError } from './errors';
import { createRateLimiter } from './rate-limit';
import { createMcpServer } from './server';
import { fakeApi, fakeLogger, ME } from './test-support';

async function connect(bodies?: Record<string, unknown>, limit = 60) {
  const { api, get } = fakeApi(bodies);
  const { log, calls } = fakeLogger();
  const ctx = createToolContext({
    api,
    log,
    userKey: 'user-1',
    limiter: createRateLimiter({ limit }),
  });
  const server = createMcpServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, ctx, get, calls };
}

describe('createMcpServer', () => {
  it('lists whoami as read-only', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const whoami = tools.find((t) => t.name === 'whoami');
    expect(whoami?.annotations?.readOnlyHint).toBe(true);
    expect(whoami?.outputSchema?.properties).toHaveProperty('memberships');
  });

  it('whoami returns the API user', async () => {
    const { client, get, calls } = await connect();
    const r = await client.callTool({ name: 'whoami', arguments: {} });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual(ME);
    expect(get).toHaveBeenCalledWith('/me', expect.anything());
    const line = calls.find((c) => c[2] && typeof c[2] === 'object' && 'tool' in (c[2] as object));
    expect(line?.[2]).toEqual({ tool: 'whoami', status: 'ok', durationMs: expect.any(Number) });
  });

  it('takes the locale from GET /me and falls back to en', async () => {
    const { ctx, get } = await connect();
    expect(await ctx.locale()).toBe('vi');
    expect(await ctx.locale()).toBe('vi');
    expect(get).toHaveBeenCalledTimes(1);

    const failing = await connect({
      '/me': new ApiCallError({ status: 500, code: 'INTERNAL', message: 'x' }),
    });
    expect(await failing.ctx.locale()).toBe('en');
  });

  it('returns API errors as tool errors and logs the status', async () => {
    const { client, calls } = await connect({
      '/me': new ApiCallError({ status: 404, code: 'NOT_FOUND', message: 'User not found' }),
    });
    const r = await client.callTool({ name: 'whoami', arguments: {} });
    expect(r.isError).toBe(true);
    expect((r.content as Array<{ text: string }>)[0]?.text).toBe('NOT_FOUND: User not found');
    expect(JSON.stringify(calls)).toContain('"status":"error"');
  });

  it('refuses tool calls over the per-user limit without calling the API', async () => {
    const { client, get } = await connect(undefined, 1);
    await client.callTool({ name: 'whoami', arguments: {} });
    const r = await client.callTool({ name: 'whoami', arguments: {} });
    expect(r.isError).toBe(true);
    expect((r.content as Array<{ text: string }>)[0]?.text).toMatch(
      /^RATE_LIMITED: .*Retry after \d+ seconds\./s,
    );
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('logs an auth challenge distinctly', async () => {
    const { client, calls } = await connect({
      '/me': new ApiCallError({ status: 401, code: 'UNAUTHENTICATED', message: 'expired' }),
    });
    const r = await client.callTool({ name: 'whoami', arguments: {} });
    expect(r.isError).toBe(true);
    expect(JSON.stringify(calls)).toContain('"status":"auth_challenge"');
  });
});
