import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiClient } from './api-client';
import { ApiCallError } from './errors';

const Thing = z.object({ id: z.string(), count: z.number() });

function fakeFetch(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(
        body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body),
        {
          status,
          headers: { 'content-type': 'application/json', ...headers },
        },
      ),
  );
}

function call(f: ReturnType<typeof fakeFetch>, n = 0) {
  const [url, init] = f.mock.calls[n]!;
  return { url: String(url), init: init!, headers: new Headers(init!.headers) };
}

describe('createApiClient', () => {
  it('sends the bearer token and a request id', async () => {
    const f = fakeFetch(200, { id: 'x1', count: 2 });
    const api = createApiClient({
      baseUrl: 'http://web:3000/',
      token: 'tok-synthetic',
      fetch: f,
      requestId: 'req-1',
    });
    await api.get('/things', Thing, { a: 'b c', n: 3, skip: undefined, yes: true });
    const { url, init, headers } = call(f);
    expect(url).toBe('http://web:3000/api/v1/things?a=b+c&n=3&yes=true');
    expect(init.method).toBe('GET');
    expect(headers.get('authorization')).toBe('Bearer tok-synthetic');
    expect(headers.get('x-request-id')).toBe('req-1');
    expect(headers.get('x-dev-user')).toBeNull();
  });

  it('sends x-dev-user instead of a token in dev mode', async () => {
    const f = fakeFetch(200, { id: 'x1', count: 2 });
    const api = createApiClient({
      baseUrl: 'http://web:3000',
      devUser: 'dev-estimator',
      fetch: f,
      requestId: 'req-2',
    });
    await api.get('/things', Thing);
    const { url, headers } = call(f);
    expect(url).toBe('http://web:3000/api/v1/things');
    expect(headers.get('x-dev-user')).toBe('dev-estimator');
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-request-id')).toBe('req-2');
  });

  it('parses a 2xx body with the given schema and rejects a body that does not match', async () => {
    const ok = createApiClient({
      baseUrl: 'http://web:3000',
      token: 't',
      fetch: fakeFetch(200, { id: 'x1', count: 2, extra: 1 }),
      requestId: 'r',
    });
    expect(await ok.get('/things/x1', Thing)).toEqual({ id: 'x1', count: 2 });

    const bad = createApiClient({
      baseUrl: 'http://web:3000',
      token: 't',
      fetch: fakeFetch(200, { id: 'x1', count: 'two' }),
      requestId: 'r',
    });
    const err = await bad.get('/things/x1', Thing).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiCallError);
    expect(err).toMatchObject({ status: 502, code: 'INTERNAL', details: [{ path: 'count' }] });

    const notJson = createApiClient({
      baseUrl: 'http://web:3000',
      token: 't',
      fetch: fakeFetch(200, '<html>'),
      requestId: 'r',
    });
    await expect(notJson.get('/x', Thing)).rejects.toMatchObject({ status: 502, code: 'INTERNAL' });
  });

  it('sends JSON bodies for post and patch, and del expects no body', async () => {
    const f = fakeFetch(201, { id: 'x1', count: 1 });
    const api = createApiClient({
      baseUrl: 'http://web:3000',
      token: 't',
      fetch: f,
      requestId: 'r',
    });
    expect(await api.post('/things', { count: 1 }, Thing)).toEqual({ id: 'x1', count: 1 });
    expect(call(f).init.method).toBe('POST');
    expect(call(f).init.body).toBe('{"count":1}');
    expect(call(f).headers.get('content-type')).toBe('application/json');

    const p = fakeFetch(200, { id: 'x1', count: 5 });
    await createApiClient({
      baseUrl: 'http://web:3000',
      token: 't',
      fetch: p,
      requestId: 'r',
    }).patch('/things/x1', { count: 5 }, Thing);
    expect(call(p).init.method).toBe('PATCH');

    const d = fakeFetch(204);
    await expect(
      createApiClient({ baseUrl: 'http://web:3000', token: 't', fetch: d, requestId: 'r' }).del(
        '/things/x1',
      ),
    ).resolves.toBeUndefined();
    expect(call(d).init.method).toBe('DELETE');
  });

  it('throws ApiCallError with code, message, details and retryAfter from a 429 envelope', async () => {
    const f = fakeFetch(
      429,
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          details: [{ limit: 300 }],
          requestId: 'r',
        },
      },
      { 'retry-after': '17' },
    );
    const api = createApiClient({
      baseUrl: 'http://web:3000',
      token: 't',
      fetch: f,
      requestId: 'r',
    });
    const err = await api.get('/things', Thing).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiCallError);
    expect(err).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      details: [{ limit: 300 }],
      retryAfter: 17,
    });
  });

  it('maps a non-envelope error body by status and reports 401s to onUnauthorized', async () => {
    const onUnauthorized = vi.fn();
    const api = createApiClient({
      baseUrl: 'http://web:3000',
      token: 't',
      fetch: fakeFetch(401, 'nope'),
      requestId: 'r',
      onUnauthorized,
    });
    await expect(api.del('/x')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(onUnauthorized).toHaveBeenCalledOnce();

    const cases: Array<[number, string]> = [
      [400, 'VALIDATION_FAILED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
      [422, 'VALIDATION_FAILED'],
      [429, 'RATE_LIMITED'],
      [503, 'NOT_READY'],
      [500, 'INTERNAL'],
    ];
    for (const [status, code] of cases) {
      const c = createApiClient({
        baseUrl: 'http://web:3000',
        token: 't',
        fetch: fakeFetch(status),
        requestId: 'r',
      });
      const err = (await c.get('/x', Thing).catch((e: unknown) => e)) as ApiCallError;
      expect(err.code, String(status)).toBe(code);
      expect(err.retryAfter).toBeUndefined();
    }
  });
});
