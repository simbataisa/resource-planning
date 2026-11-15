import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseEnv } from './env';
import { createHttpServer } from './http';
import { createRateLimiter } from './rate-limit';
import { fakeLogger, ME } from './test-support';

const ISSUER = 'http://localhost:8080/realms/qe-tools';
const BASE_ENV = {
  SIT_API_BASE_URL: 'http://web:3000',
  OIDC_ISSUER: ISSUER,
  MCP_PUBLIC_URL: 'http://localhost:3100',
};
const META = 'resource_metadata="http://localhost:3100/.well-known/oauth-protected-resource"';
const MARKER = 'SYNTHETIC-FREE-TEXT-7f3a';

let keys: ReturnType<typeof createLocalJWKSet>;
let goodToken: string;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' }],
  });
  goodToken = await new SignJWT({ sid: 'kc-session-synthetic', azp: 'synthetic-client' })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject('kc-subject-synthetic')
    .setIssuer(ISSUER)
    .setAudience('sit-sizing-api')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(pair.privateKey);
});

let server: Server | undefined;
afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

type ApiRoute = (url: string, init: RequestInit) => Response;

async function start(opts: { env?: Record<string, string>; api?: ApiRoute } = {}) {
  const { log, calls } = fakeLogger();
  const apiFetch = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (opts.api) return opts.api(url, init ?? {});
    if (url.endsWith('/api/v1/me')) return Response.json(ME);
    if (url.endsWith('/api/v1/ready')) return Response.json({ status: 'ready' });
    return new Response(null, { status: 404 });
  });
  server = createHttpServer({
    env: parseEnv({ ...BASE_ENV, ...opts.env }),
    log,
    limiter: createRateLimiter({ limit: 60 }),
    fetch: apiFetch,
    keys,
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, calls, apiFetch };
}

function rpc(base: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const callWhoami = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'whoami', arguments: { note: MARKER } },
};

describe('HTTP transport', () => {
  it('answers 401 with WWW-Authenticate and resource_metadata when no token is sent', async () => {
    const { base, apiFetch } = await start();
    const none = await rpc(base, callWhoami);
    expect(none.status).toBe(401);
    expect(none.headers.get('www-authenticate')).toBe(`Bearer ${META}`);

    const bad = await rpc(base, callWhoami, { authorization: 'Bearer not.a.token' });
    expect(bad.status).toBe(401);
    expect(bad.headers.get('www-authenticate')).toBe(`Bearer error="invalid_token", ${META}`);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('serves /.well-known/oauth-protected-resource, /health and /ready', async () => {
    const { base } = await start();
    const meta = await fetch(`${base}/.well-known/oauth-protected-resource`);
    expect(meta.status).toBe(200);
    expect(await meta.json()).toEqual({
      resource: 'http://localhost:3100',
      authorization_servers: [ISSUER],
      bearer_methods_supported: ['header'],
    });
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await fetch(`${base}/ready`)).status).toBe(200);
    expect((await fetch(`${base}/nowhere`)).status).toBe(404);
    expect((await fetch(`${base}/mcp`)).status).toBe(405);
  });

  it('answers 503 on /ready when the API is not ready or unreachable', async () => {
    const down = await start({ api: () => new Response(null, { status: 503 }) });
    expect((await fetch(`${down.base}/ready`)).status).toBe(503);
    await new Promise<void>((r) => server!.close(() => r()));
    const gone = await start({
      api: () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect((await fetch(`${gone.base}/ready`)).status).toBe(503);
  });

  it('runs whoami with the caller token and returns the API user', async () => {
    const { base, apiFetch } = await start();
    const res = await rpc(base, callWhoami, {
      authorization: `Bearer ${goodToken}`,
      'x-request-id': 'req-synthetic-1',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req-synthetic-1');
    const body = (await res.json()) as { result: { structuredContent: unknown } };
    expect(body.result.structuredContent).toEqual(ME);
    const headers = new Headers(apiFetch.mock.calls[0]![1]!.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${goodToken}`);
    expect(headers.get('x-request-id')).toBe('req-synthetic-1');
  });

  it('never logs tool arguments', async () => {
    const { base, calls } = await start();
    const res = await rpc(base, callWhoami, { authorization: `Bearer ${goodToken}` });
    expect(res.status).toBe(200);
    const logged = JSON.stringify(calls);
    expect(logged).toContain('whoami');
    expect(logged).not.toContain(MARKER);
    expect(logged).not.toContain(goodToken);
  });

  it('turns an API 401 during a tool call into an MCP auth challenge', async () => {
    const { base } = await start({
      api: () =>
        Response.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Token expired' } },
          { status: 401 },
        ),
    });
    const res = await rpc(base, callWhoami, { authorization: `Bearer ${goodToken}` });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(`Bearer error="invalid_token", ${META}`);
  });

  it('uses x-dev-user in dev mode without a token', async () => {
    const { base, apiFetch } = await start({ env: { MCP_DEV_USER: 'dev-estimator' } });
    const res = await rpc(base, callWhoami);
    expect(res.status).toBe(200);
    const headers = new Headers(apiFetch.mock.calls[0]![1]!.headers);
    expect(headers.get('x-dev-user')).toBe('dev-estimator');
    expect(headers.get('authorization')).toBeNull();
  });

  it('refuses a malformed or oversized body', async () => {
    const { base } = await start({ env: { MCP_DEV_USER: 'dev-estimator' } });
    expect((await rpc(base, '{not json')).status).toBe(400);
    expect((await rpc(base, JSON.stringify({ pad: 'x'.repeat(1_100_000) }))).status).toBe(413);
  });
});
