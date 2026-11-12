import { createServer, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkTcp } from './health';

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((s) => s.end());
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  port = (server.address() as { port: number }).port;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('checkTcp', () => {
  it('reports a listening service as reachable', async () => {
    const result = await checkTcp(`postgresql://u:synthetic@127.0.0.1:${port}/app`);
    expect(result.ok).toBe(true);
  });

  it('reports a closed port with a reason code only', async () => {
    const closed = createServer();
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', () => r()));
    const closedPort = (closed.address() as { port: number }).port;
    await new Promise<void>((r) => closed.close(() => r()));

    const result = await checkTcp(`postgresql://u:synthetic@127.0.0.1:${closedPort}/app`);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ECONNREFUSED');
  });

  it('rejects an unparsable URL without throwing', async () => {
    expect(await checkTcp('not a url')).toEqual({ ok: false, latencyMs: 0, reason: 'INVALID_URL' });
  });
});
