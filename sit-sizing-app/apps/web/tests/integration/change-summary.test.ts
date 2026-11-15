import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Confirmation summary and channel in the audit trail (design spec 6.5). Runs with
 * AUTH_MODE=oidc so a bearer token (channel "mcp") and a session cookie (channel "web") can
 * both be used; tokens are signed with a local key pair. Synthetic users and data only.
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
  process.env.RATE_LIMIT_PER_MINUTE = '1000';
  return before;
});

const { setKeysForTests } = await import('@/server/auth/bearer');
const { cookieNames, nowSeconds, sealSession } = await import('@/server/auth/session');
const { db } = await import('@/server/db');
const draft = await import('@/app/api/v1/estimates/[estimateId]/draft/route');
const applyRoute = await import('@/app/api/v1/estimates/[estimateId]/draft/profile/route');
const versions = await import('@/app/api/v1/estimates/[estimateId]/versions/route');
const submit = await import('@/app/api/v1/estimates/[estimateId]/versions/[number]/submit/route');
const estimates = await import('@/app/api/v1/projects/[projectId]/estimates/route');
const { seeded } = await import('./helpers');

const ISSUER = 'http://localhost:8080/realms/qe-tools';
let key: Awaited<ReturnType<typeof generateKeyPair>>;
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

const bearer = async (sub: string) => ({
  authorization: `Bearer ${await new SignJWT({ sid: `kc-session-${sub}`, azp: 'synthetic-mcp' })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience('sit-sizing-api')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key.privateKey)}`,
});

async function cookie(subject: string) {
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

type Who = 'mcp' | 'web';
const headersFor = (who: Who) =>
  who === 'mcp' ? bearer('dev-estimator') : cookie('dev-estimator');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route handlers differ in their params type
type Handler = (request: Request, ctx: any) => Promise<Response>;

async function call(
  who: Who,
  handler: Handler,
  method: string,
  params: Record<string, string>,
  body: unknown,
  lockToken?: string,
) {
  const request = new Request('http://localhost:3000/api/v1/x', {
    method,
    headers: {
      'content-type': 'application/json',
      ...(await headersFor(who)),
      ...(lockToken ? { 'x-lock-token': lockToken } : {}),
    },
    body: JSON.stringify(body),
  });
  const res = await handler(request, { params: Promise.resolve(params) });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test convenience
  const json: any = text ? JSON.parse(text) : null;
  return { status: res.status, json };
}

const audit = (action: string, entityId: string) =>
  db().auditEvent.findMany({ where: { action, entityId }, orderBy: { at: 'asc' } });

async function newEstimate(who: Who, name: string, summary?: string) {
  const res = await call(
    who,
    estimates.POST,
    'POST',
    { projectId: ids.demo.id },
    {
      name,
      template: 'blank',
      ...(summary ? { summary } : {}),
    },
  );
  expect(res.status, JSON.stringify(res.json)).toBe(201);
  const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId: res.json.id } });
  return {
    id: res.json.id as string,
    versionId: v.id,
    rowVersion: v.rowVersion,
    lockToken: res.json.lockToken as string,
  };
}

describe('change summary and channel in the audit trail', () => {
  it('patchDraft without summary writes no audit event', async () => {
    const e = await newEstimate('mcp', 'Synthetic · autosave');
    const res = await call(
      'mcp',
      draft.PATCH,
      'PATCH',
      { estimateId: e.id },
      {
        rowVersion: e.rowVersion,
        note: 'Synthetic autosave note',
      },
      e.lockToken,
    );
    expect(res.status).toBe(200);
    expect(await audit('estimate.draft.update', e.versionId)).toHaveLength(0);
  });

  it('patchDraft with summary writes estimate.draft.update with summary and changed areas', async () => {
    const e = await newEstimate('mcp', 'Synthetic · update');
    const before = await db().estimateVersion.findUniqueOrThrow({ where: { id: e.versionId } });
    const res = await call(
      'mcp',
      draft.PATCH,
      'PATCH',
      { estimateId: e.id },
      {
        rowVersion: e.rowVersion,
        note: 'Synthetic private note text',
        assumptions: before.assumptions,
        summary: 'Synthetic: note and assumptions',
      },
      e.lockToken,
    );
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    const [event] = await audit('estimate.draft.update', e.versionId);
    expect(event?.detail).toEqual({
      number: 1,
      changed: ['assumptions', 'note'],
      channel: 'mcp',
      summary: 'Synthetic: note and assumptions',
    });
  });

  it('records channel "mcp" for a bearer user and no channel for a cookie user', async () => {
    const mcp = await newEstimate(
      'mcp',
      'Synthetic · channel mcp',
      'Synthetic: create via assistant',
    );
    const web = await newEstimate(
      'web',
      'Synthetic · channel web',
      'Synthetic: create via browser',
    );
    const [a] = await audit('estimate.create', mcp.id);
    const [b] = await audit('estimate.create', web.id);
    expect(a?.detail).toMatchObject({ channel: 'mcp', summary: 'Synthetic: create via assistant' });
    expect(b?.detail).toMatchObject({ summary: 'Synthetic: create via browser' });
    expect(Object.keys(b!.detail as object)).not.toContain('channel');

    const res = await call(
      'web',
      draft.PATCH,
      'PATCH',
      { estimateId: web.id },
      {
        rowVersion: web.rowVersion,
        note: 'Synthetic note',
        summary: 'Synthetic: web edit',
      },
      web.lockToken,
    );
    expect(res.status).toBe(200);
    const [edit] = await audit('estimate.draft.update', web.versionId);
    expect(edit?.detail).toEqual({ number: 1, changed: ['note'], summary: 'Synthetic: web edit' });
  });

  it('createEstimate, createDraft, applyProfile, saveVersion, submit carry summary in detail', async () => {
    const e = await newEstimate('mcp', 'Synthetic · lifecycle', 'S: create');
    const saveRes = await call(
      'mcp',
      versions.POST,
      'POST',
      { estimateId: e.id },
      {
        summary: 'S: save',
      },
      e.lockToken,
    );
    expect(saveRes.status, JSON.stringify(saveRes.json)).toBe(201);
    const subRes = await call(
      'mcp',
      submit.POST,
      'POST',
      { estimateId: e.id, number: '1' },
      {
        summary: 'S: submit',
      },
    );
    expect(subRes.status, JSON.stringify(subRes.json)).toBe(200);
    expect((await audit('estimate.create', e.id))[0]?.detail).toMatchObject({
      summary: 'S: create',
    });
    expect((await audit('estimate.version.save', e.versionId))[0]?.detail).toEqual({
      number: 1,
      channel: 'mcp',
      summary: 'S: save',
    });
    expect((await audit('estimate.version.submit', e.versionId))[0]?.detail).toEqual({
      number: 1,
      to: 'SUBMITTED',
      channel: 'mcp',
      summary: 'S: submit',
    });

    const d = await call('mcp', draft.POST, 'POST', { estimateId: e.id }, { summary: 'S: draft' });
    expect(d.status, JSON.stringify(d.json)).toBe(201);
    const [created] = await audit('estimate.draft.create', d.json.id);
    expect(created?.detail).toEqual({
      number: 2,
      fromVersion: 1,
      channel: 'mcp',
      summary: 'S: draft',
    });

    const ap = await call(
      'mcp',
      applyRoute.POST,
      'POST',
      { estimateId: e.id },
      {
        profileId: ids.profile.id,
        rowVersion: d.json.rowVersion,
        summary: 'S: profile',
      },
      d.json.lockToken,
    );
    expect(ap.status, JSON.stringify(ap.json)).toBe(200);
    const [applied] = await audit('estimate.draft.profile.apply', d.json.id);
    expect(applied?.detail).toMatchObject({ channel: 'mcp', summary: 'S: profile' });
  });

  it('saveVersion uses the summary as the note when no note is given', async () => {
    const e = await newEstimate('mcp', 'Synthetic · note from summary');
    const res = await call(
      'mcp',
      versions.POST,
      'POST',
      { estimateId: e.id },
      {
        summary: 'Synthetic: ready for review',
      },
      e.lockToken,
    );
    expect(res.status).toBe(201);
    expect(res.json.note).toBe('Synthetic: ready for review');

    const f = await newEstimate('mcp', 'Synthetic · explicit note wins');
    const res2 = await call(
      'mcp',
      versions.POST,
      'POST',
      { estimateId: f.id },
      {
        note: 'Synthetic explicit note',
        summary: 'Synthetic: summary',
      },
      f.lockToken,
    );
    expect(res2.json.note).toBe('Synthetic explicit note');
  });

  it('never stores input or assumption values in the audit detail', async () => {
    const e = await newEstimate('mcp', 'Synthetic · no values');
    const row = await db().estimateVersion.findUniqueOrThrow({ where: { id: e.versionId } });
    const inputs = structuredClone(row.inputs) as { team: { weeks: number } };
    inputs.team.weeks = 4242;
    const res = await call(
      'mcp',
      draft.PATCH,
      'PATCH',
      { estimateId: e.id },
      {
        rowVersion: e.rowVersion,
        inputs,
        note: 'Synthetic-distinctive-note-text',
        summary: 'Synthetic: change inputs',
      },
      e.lockToken,
    );
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    const events = await db().auditEvent.findMany({ where: { entityId: e.versionId } });
    const text = JSON.stringify(events.map((x) => x.detail));
    expect(text).not.toContain('4242');
    expect(text).not.toContain('Synthetic-distinctive-note-text');
    expect(text).not.toContain('weeks');
    const [event] = await audit('estimate.draft.update', e.versionId);
    expect(Object.keys(event!.detail as object).sort()).toEqual([
      'changed',
      'channel',
      'number',
      'summary',
    ]);
  });
});
