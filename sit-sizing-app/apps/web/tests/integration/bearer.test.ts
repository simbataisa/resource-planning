import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Bearer sign-in for the MCP client (ADR-0016, design spec 6.2). Runs with AUTH_MODE=oidc,
 * which is the only mode that accepts bearer tokens; tokens are signed with a local key
 * pair injected through setKeysForTests. Synthetic users and sessions only.
 */
const saved = vi.hoisted(() => {
  const keys = [
    'AUTH_MODE',
    'OIDC_ISSUER',
    'OIDC_CLIENT_SECRET',
    'SESSION_SECRET',
    'RATE_LIMIT_PER_MINUTE',
  ] as const;
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.AUTH_MODE = 'oidc';
  process.env.OIDC_ISSUER = 'http://localhost:8080/realms/qe-tools';
  process.env.OIDC_CLIENT_SECRET = 'synthetic-test-client-secret';
  process.env.SESSION_SECRET = 'synthetic-session-secret-for-tests-only-000';
  process.env.RATE_LIMIT_PER_MINUTE = '40';
  return before;
});

const { setKeysForTests } = await import('@/server/auth/bearer');
const { DEV_USER_HEADER } = await import('@/server/auth/current-user');
const { revokeSession } = await import('@/server/auth/revocation');
const { cookieNames, nowSeconds, sealSession } = await import('@/server/auth/session');
const { db } = await import('@/server/db');
const me = await import('@/app/api/v1/me/route');
const project = await import('@/app/api/v1/projects/[projectId]/route');
const { seeded } = await import('./helpers');

const ISSUER = 'http://localhost:8080/realms/qe-tools';
type Keys = Awaited<ReturnType<typeof generateKeyPair>>;
let key: Keys;
let ids: Awaited<ReturnType<typeof seeded>>;

beforeAll(async () => {
  key = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(key.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  setKeysForTests(createLocalJWKSet({ keys: [jwk] }));
  ids = await seeded();
});

afterAll(() => {
  setKeysForTests(undefined);
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function token(sub: string, claims: Record<string, unknown> = {}) {
  return new SignJWT({ sid: `kc-session-${sub}`, azp: 'synthetic-mcp-client', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience((claims.aud as string | undefined) ?? 'sit-sizing-api')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key.privateKey);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route handlers differ in their params type
type Handler = (request: Request, ctx: any) => Promise<Response>;

async function call(
  handler: Handler,
  headers: Record<string, string>,
  opts: { method?: string; body?: unknown; params?: Record<string, string> } = {},
) {
  const request = new Request('http://localhost:3000/api/v1/x', {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(request, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test convenience
  const json: any = text ? JSON.parse(text) : null;
  return { status: res.status, json, challenge: res.headers.get('www-authenticate') };
}

const bearer = async (sub: string, claims?: Record<string, unknown>) => ({
  authorization: `Bearer ${await token(sub, claims)}`,
});

async function sessionCookie(subject: string) {
  const user = await db().user.findUniqueOrThrow({ where: { subject } });
  const now = nowSeconds();
  const sealed = await sealSession(
    {
      uid: user.id,
      sub: subject,
      sid: `kc-session-cookie-${subject}`,
      idToken: 'synthetic-id-token',
      refreshAt: now + 600,
      lastSeen: now,
      expiresAt: now + 3600,
    },
    'synthetic-session-secret-for-tests-only-000',
  );
  return { cookie: `${cookieNames('http://localhost:3000').session}=${sealed}` };
}

describe('bearer access tokens on /api/v1 (ADR-0016)', () => {
  it('GET /me with a valid bearer token returns the seeded user', async () => {
    const viaBearer = await call(me.GET, await bearer('dev-estimator'));
    expect(viaBearer.status).toBe(200);
    expect(viaBearer.json.email).toBe('estimator@example.invalid');
    const viaCookie = await call(me.GET, await sessionCookie('dev-estimator'));
    expect(viaCookie.status).toBe(200);
    expect(viaBearer.json).toEqual(viaCookie.json);
  });

  it('ignores cookies and the dev header when a bearer token is present', async () => {
    const cookie = await sessionCookie('dev-estimator');
    const res = await call(me.GET, {
      authorization: 'Bearer not-a-valid-token',
      ...cookie,
      [DEV_USER_HEADER]: 'dev-admin',
    });
    expect(res.status).toBe(401);
    expect(res.json.error.code).toBe('UNAUTHENTICATED');
    // An empty bearer value is still the bearer path, not a fall-back to the cookie.
    expect((await call(me.GET, { authorization: 'Bearer ', ...cookie })).status).toBe(401);
  });

  it('refuses a wrong audience', async () => {
    const res = await call(me.GET, await bearer('dev-estimator', { aud: 'account' }));
    expect(res.status).toBe(401);
    expect(res.json.error.code).toBe('UNAUTHENTICATED');
    expect(res.challenge).toBe('Bearer error="invalid_token"');
    // A 401 without a bearer token carries no bearer challenge.
    expect((await call(me.GET, {})).challenge).toBeNull();
  });

  it('refuses a token whose sid was revoked', async () => {
    const headers = await bearer('dev-estimator', { sid: 'kc-session-synthetic-revoked' });
    expect((await call(me.GET, headers)).status).toBe(200);
    await revokeSession('kc-session-synthetic-revoked');
    const res = await call(me.GET, headers);
    expect(res.status).toBe(401);
    expect(res.json.error.code).toBe('UNAUTHENTICATED');
  });

  it('answers 403 NOT_PROVISIONED for a subject with no app user', async () => {
    const res = await call(me.GET, await bearer('kc-synthetic-never-signed-in'));
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('NOT_PROVISIONED');
    expect(res.json.error.message).toBe('Sign in to SIT Sizing once in the browser first.');
  });

  it('answers 403 NOT_PROVISIONED for an inactive user', async () => {
    await db().user.create({
      data: {
        subject: 'kc-synthetic-inactive',
        email: 'inactive@example.invalid',
        displayName: 'Synthetic Inactive',
        active: false,
      },
    });
    const res = await call(me.GET, await bearer('kc-synthetic-inactive'));
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('NOT_PROVISIONED');
  });

  it('still answers 404 across projects and 403 for a low role with bearer', async () => {
    const outsider = await call(project.GET, await bearer('dev-outsider'), {
      params: { projectId: ids.demo.id },
    });
    expect(outsider.status).toBe(404);
    const viewer = await call(project.PATCH, await bearer('dev-viewer'), {
      method: 'PATCH',
      params: { projectId: ids.demo.id },
      body: { description: 'Synthetic project for local development' },
    });
    expect(viewer.status).toBe(403);
    expect(viewer.json.error.code).toBe('FORBIDDEN');
    const member = await call(project.GET, await bearer('dev-viewer'), {
      params: { projectId: ids.demo.id },
    });
    expect(member.status).toBe(200);
  });

  it('rate-limits a bearer user like a cookie user', async () => {
    const headers = await bearer('dev-lead');
    for (let i = 0; i < 40; i++) expect((await call(me.GET, headers)).status).toBe(200);
    const res = await call(me.GET, headers);
    expect(res.status).toBe(429);
    expect(res.json.error.code).toBe('RATE_LIMITED');
  });
});
