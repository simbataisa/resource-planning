import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiErrorEnvelope } from '@sit/schemas';
import { HttpError, route } from './route';

const req = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/v1/things', { headers });

describe('route()', () => {
  it('passes through the request ID and disables caching by default', async () => {
    const handler = route(async () => Response.json({ ok: true }));
    const res = await handler(req({ 'x-request-id': 'req-synthetic-0001' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req-synthetic-0001');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('creates a request ID when none is given', async () => {
    const res = await route(async () => Response.json({}))(req());
    expect(res.headers.get('x-request-id')).toMatch(/[0-9a-f-]{36}/);
  });

  it('maps HttpError to the error envelope', async () => {
    const res = await route(async () => {
      throw new HttpError(404, 'NOT_FOUND', 'Estimate not found');
    })(req());
    expect(res.status).toBe(404);
    const body = ApiErrorEnvelope.parse(await res.json());
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers.get('x-request-id'));
  });

  it('maps ZodError to 400 VALIDATION_FAILED with issue paths', async () => {
    const res = await route(async () => {
      z.object({ size: z.number().positive() }).parse({ size: -1 });
      return Response.json({});
    })(req());
    expect(res.status).toBe(400);
    const body = ApiErrorEnvelope.parse(await res.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual([expect.objectContaining({ path: ['size'] })]);
  });

  it('hides unexpected errors behind INTERNAL', async () => {
    const res = await route(async () => {
      throw new Error('db password synthetic-secret leaked in message');
    })(req());
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('synthetic-secret');
    expect(ApiErrorEnvelope.parse(JSON.parse(text)).error.code).toBe('INTERNAL');
  });

  it('awaits Next.js params', async () => {
    const res = await route<{ id: string }>(async (_r, { params }) => Response.json(params))(
      req(),
      {
        params: Promise.resolve({ id: 'e-1' }),
      },
    );
    expect(await res.json()).toEqual({ id: 'e-1' });
  });
});

describe('assertSameOrigin()', () => {
  const post = (headers: Record<string, string>) =>
    new Request('http://localhost:3000/api/v1/things', {
      method: 'POST',
      headers: { host: 'localhost:3000', ...headers },
    });

  it('allows same-origin and Origin-less requests, blocks cross-site ones', async () => {
    const handler = route(async () => Response.json({ ok: true }));
    expect((await handler(post({ origin: 'http://localhost:3000' }))).status).toBe(200);
    expect((await handler(post({}))).status).toBe(200);
    expect((await handler(post({ origin: 'https://evil.example' }))).status).toBe(403);
    expect((await handler(post({ origin: 'not a url' }))).status).toBe(403);
  });

  it('ignores safe methods', async () => {
    const res = await route(async () => Response.json({}))(
      new Request('http://localhost:3000/x', { headers: { origin: 'https://evil.example' } }),
    );
    expect(res.status).toBe(200);
  });
});

describe('Prisma errors', () => {
  it('maps unique violations to 409 and missing records to 404', async () => {
    const res1 = await route(async () => {
      throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    })(req());
    expect(res1.status).toBe(409);
    const res2 = await route(async () => {
      throw Object.assign(new Error('Record not found'), { code: 'P2025' });
    })(req());
    expect(res2.status).toBe(404);
  });
});

describe('authedRoute()', () => {
  it('returns 401 without a user and passes the user through otherwise', async () => {
    const { authedRoute } = await import('./route');
    const h = authedRoute(
      async (r: Request) => (r.headers.get('x-u') ? { id: r.headers.get('x-u')! } : null),
      async (_r, { user }) => Response.json(user),
    );
    expect((await h(req())).status).toBe(401);
    expect(await (await h(req({ 'x-u': 'u1' }))).json()).toEqual({ id: 'u1' });
  });
});
