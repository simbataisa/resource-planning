import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { blankInputs, computeBoth, DEFAULT_ASSUMPTIONS, toStoredResult } from '@sit/engine';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import type { ApiClient } from '../api-client';
import { createToolContext } from '../context';
import { ApiCallError } from '../errors';
import { createRateLimiter } from '../rate-limit';
import { createMcpServer } from '../server';
import { fakeLogger, ME } from '../test-support';
import { NOTE_PREFIX, withDraftLock } from './write';

const USER = {
  id: 'clx0synthetic0001',
  displayName: 'Sample Estimator',
  email: 'sample.estimator@example.test',
};
const OTHER = {
  id: 'clx0synthetic0002',
  displayName: 'Sample Reviewer',
  email: 'sample.reviewer@example.test',
};
const AT = '2026-01-01T00:00:00.000Z';
const FUTURE = '2999-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';
const PROJECT_ID = 'clx0synthetic0p01';
const EST_ID = 'clx0synthetic0e01';
const PROFILE_ID = 'clx0synthetic0f01';
const SUMMARY = 'Synthetic: set team weeks to 12';
const BASE = `/estimates/${EST_ID}`;

function summary(number: number, status = 'SAVED') {
  return {
    id: `clx0synthetic0v0${number}`,
    number,
    status,
    engineVersion: '1.0.0',
    roughFte: 1.5,
    detailedFte: 2,
    totalCasesDetailed: 100,
    uncalibrated: 3,
    note: null,
    createdBy: USER,
    createdAt: AT,
    updatedAt: AT,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
  };
}

const inputs = blankInputs();
function version(number: number, status: string, rowVersion: number, lock: unknown = null) {
  return {
    ...summary(number, status),
    inputs,
    assumptions: DEFAULT_ASSUMPTIONS,
    result: toStoredResult(computeBoth(inputs, DEFAULT_ASSUMPTIONS)),
    profileId: null,
    schemaVersion: 1,
    rowVersion,
    lock,
    reviews: [],
  };
}
const ESTIMATE = {
  id: EST_ID,
  projectId: PROJECT_ID,
  name: 'Synthetic estimate',
  description: null,
  archived: false,
  createdBy: USER,
  createdAt: AT,
  latest: summary(1),
  hasDraft: true,
};
function detail(draftLock: unknown = null, hasDraft = true) {
  return {
    ...ESTIMATE,
    hasDraft,
    versions: hasDraft ? [summary(2, 'DRAFT'), summary(1)] : [summary(1)],
    draftLock,
  };
}
const MY_LOCK = { holder: USER, expiresAt: FUTURE, mine: true };

type Call = [method: string, path: string, body?: unknown];
type Answer = unknown | Error | ((body: unknown) => unknown);

/**
 * A fake API that records every call in order and answers from `METHOD path` → body.
 * Defaults model a draft (number 2) with no lock; the draft read without a lock has
 * rowVersion 4 and the lock response rowVersion 5, so tests can tell them apart.
 */
function recordingApi(overrides: Record<string, Answer> = {}) {
  const routes: Record<string, Answer> = {
    'GET /me': ME,
    [`GET ${BASE}`]: detail(),
    [`GET ${BASE}/versions/2`]: version(2, 'DRAFT', 4),
    [`POST ${BASE}/draft/lock`]: version(2, 'DRAFT', 5, MY_LOCK),
    [`DELETE ${BASE}/draft/lock`]: undefined,
    [`PATCH ${BASE}/draft`]: version(2, 'DRAFT', 6, MY_LOCK),
    [`POST ${BASE}/draft/profile`]: version(2, 'DRAFT', 6, MY_LOCK),
    [`POST ${BASE}/draft`]: version(2, 'DRAFT', 1, MY_LOCK),
    [`POST ${BASE}/versions`]: version(2, 'SAVED', 6),
    [`POST ${BASE}/versions/1/submit`]: version(1, 'SUBMITTED', 3),
    [`POST /projects/${PROJECT_ID}/estimates`]: { ...ESTIMATE, latest: null },
    ...overrides,
  };
  const calls: Call[] = [];
  const answer = <T>(method: string, path: string, body: unknown, schema?: ZodType<T>) => {
    calls.push(body === undefined ? [method, path] : [method, path, body]);
    const key = `${method} ${path}`;
    if (!(key in routes)) throw new Error(`unexpected call ${key}`);
    let value = routes[key];
    if (typeof value === 'function') value = (value as (b: unknown) => unknown)(body);
    if (value instanceof Error) throw value;
    return schema ? schema.parse(value) : (undefined as T);
  };
  const api: ApiClient = {
    get: async (path, schema) => answer('GET', path, undefined, schema),
    post: async (path, body, schema) => answer('POST', path, body, schema),
    patch: async (path, body, schema) => answer('PATCH', path, body, schema),
    del: async (path, opts) => {
      delOpts.push(opts);
      return answer('DELETE', path, undefined);
    },
  };
  /** The options of every `del` call (the lock release must pass `noChallenge`). */
  const delOpts: unknown[] = [];
  /** Calls other than the per-request `GET /me`. */
  const made = () => calls.filter((c) => c[1] !== '/me');
  return { api, calls, made, delOpts };
}

async function connect(overrides: Record<string, Answer> = {}) {
  const fake = recordingApi(overrides);
  const { log, calls: logs } = fakeLogger();
  const ctx = createToolContext({
    api: fake.api,
    log,
    userKey: 'u',
    limiter: createRateLimiter({ limit: 1000 }),
  });
  const server = createMcpServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'c', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args });
  const text = (r: Awaited<ReturnType<typeof call>>) =>
    (r.content as Array<{ text: string }>)[0]?.text ?? '';
  return { ...fake, ctx, client, call, text, logs };
}

const conflict = (reason: string) =>
  new ApiCallError({
    status: 409,
    code: 'CONFLICT',
    message: 'The draft changed since you loaded it.',
    details: [{ reason }],
  });

const WRITE_TOOLS: Record<string, Record<string, unknown>> = {
  create_estimate: { projectId: PROJECT_ID, name: 'Synthetic estimate' },
  start_draft: { estimateId: EST_ID },
  update_draft: { estimateId: EST_ID, changes: [{ path: 'inputs.team.weeks', value: 12 }] },
  apply_profile: { estimateId: EST_ID, profileId: PROFILE_ID },
  save_version: { estimateId: EST_ID },
  submit_version: { estimateId: EST_ID, number: 1 },
};

describe('write tools', () => {
  it('every write tool refuses a missing or blank summary before any API call', async () => {
    const t = await connect();
    for (const [name, args] of Object.entries(WRITE_TOOLS)) {
      for (const bad of [{}, { summary: '' }, { summary: '   ' }]) {
        const r = await t.call(name, { ...args, ...bad });
        expect(r.isError, `${name} ${JSON.stringify(bad)}`).toBe(true);
        expect(t.text(r)).toMatch(/summary/);
      }
    }
    expect(t.calls).toEqual([]);
  });

  it('create_estimate posts template "blank" and the summary', async () => {
    const t = await connect();
    const r = await t.call('create_estimate', {
      projectId: PROJECT_ID,
      name: 'Synthetic estimate',
      description: 'Synthetic description',
      profileId: PROFILE_ID,
      summary: SUMMARY,
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ id: EST_ID });
    expect(t.made()).toEqual([
      [
        'POST',
        `/projects/${PROJECT_ID}/estimates`,
        {
          name: 'Synthetic estimate',
          description: 'Synthetic description',
          template: 'blank',
          profileId: PROFILE_ID,
          summary: SUMMARY,
        },
      ],
      // The new draft comes back locked to the creator; the tool releases the lock it got.
      ['DELETE', `${BASE}/draft/lock`],
    ]);
  });

  it('create_estimate still returns the estimate when releasing its lock fails', async () => {
    const t = await connect({
      [`DELETE ${BASE}/draft/lock`]: new ApiCallError({
        status: 503,
        code: 'NOT_READY',
        message: 'x',
      }),
    });
    const r = await t.call('create_estimate', {
      projectId: PROJECT_ID,
      name: 'Synthetic estimate',
      summary: SUMMARY,
    });
    expect(r.isError).toBeFalsy();
    expect(JSON.stringify(t.logs)).toContain('NOT_READY');
    expect(JSON.stringify(t.logs)).not.toContain(SUMMARY);
  });

  it('start_draft posts the summary, releases the lock it got and returns the draft', async () => {
    const t = await connect();
    const r = await t.call('start_draft', { estimateId: EST_ID, fromVersion: 1, summary: SUMMARY });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ number: 2, status: 'DRAFT', lock: null });
    expect(t.made()).toEqual([
      ['POST', `${BASE}/draft`, { fromVersion: 1, summary: SUMMARY }],
      ['DELETE', `${BASE}/draft/lock`],
    ]);
  });

  it('start_draft keeps the lock in its answer when releasing it fails', async () => {
    const t = await connect({ [`DELETE ${BASE}/draft/lock`]: conflict('NOT_HOLDER') });
    const r = await t.call('start_draft', { estimateId: EST_ID, summary: SUMMARY });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ lock: { mine: true } });
  });

  it('update_draft locks, patches with the rowVersion it read, then unlocks, in that order', async () => {
    const t = await connect();
    const r = await t.call('update_draft', {
      estimateId: EST_ID,
      changes: [{ path: 'inputs.team.weeks', value: 12 }],
      note: 'Synthetic note',
      summary: SUMMARY,
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ rowVersion: 6 });
    const made = t.made();
    // Validation read first, then the lock state again right before the lock call.
    expect(made.map((c) => `${c[0]} ${c[1]}`)).toEqual([
      `GET ${BASE}`,
      `GET ${BASE}/versions/2`,
      `GET ${BASE}`,
      `POST ${BASE}/draft/lock`,
      `PATCH ${BASE}/draft`,
      `DELETE ${BASE}/draft/lock`,
    ]);
    expect(made[3]?.[2]).toEqual({ takeover: false });
    expect(t.delOpts).toEqual([{ noChallenge: true }]);
    const patch = made[4]?.[2] as Record<string, unknown>;
    expect(patch).toMatchObject({ rowVersion: 5, note: 'Synthetic note', summary: SUMMARY });
    expect((patch.inputs as { team: { weeks: number } }).team.weeks).toBe(12);
  });

  it('update_draft sends only the areas that changed (inputs and/or assumptions)', async () => {
    const t = await connect();
    await t.call('update_draft', {
      estimateId: EST_ID,
      changes: [{ path: 'assumptions.cases.api.1', value: 5 }],
      summary: SUMMARY,
    });
    const onlyAssumptions = t.made().find((c) => c[0] === 'PATCH')?.[2] as Record<string, unknown>;
    expect(Object.keys(onlyAssumptions).sort()).toEqual(['assumptions', 'rowVersion', 'summary']);
    expect((onlyAssumptions.assumptions as { cases: { api: number[] } }).cases.api[1]).toBe(5);

    t.calls.length = 0;
    await t.call('update_draft', {
      estimateId: EST_ID,
      changes: [
        { path: 'inputs.team.weeks', value: 12 },
        { path: 'assumptions.cases.api.1', value: 5 },
      ],
      summary: SUMMARY,
    });
    const both = t.made().find((c) => c[0] === 'PATCH')?.[2] as Record<string, unknown>;
    expect(Object.keys(both).sort()).toEqual(['assumptions', 'inputs', 'rowVersion', 'summary']);
  });

  it('update_draft releases the lock when PATCH answers 409, and returns CONFLICT without retrying', async () => {
    const t = await connect({ [`PATCH ${BASE}/draft`]: conflict('STALE') });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(r.isError).toBe(true);
    expect(t.text(r)).toMatch(/^CONFLICT: /);
    const made = t.made().map((c) => `${c[0]} ${c[1]}`);
    expect(made.filter((c) => c.startsWith('PATCH'))).toHaveLength(1);
    expect(made.filter((c) => c.startsWith('POST'))).toHaveLength(1);
    expect(made.at(-1)).toBe(`DELETE ${BASE}/draft/lock`);
  });

  it('update_draft releases the lock when PATCH answers 422', async () => {
    const t = await connect({
      [`PATCH ${BASE}/draft`]: new ApiCallError({
        status: 422,
        code: 'VALIDATION_FAILED',
        message: 'Invalid input',
        details: [{ path: 'inputs.team.weeks', message: 'Too big' }],
      }),
    });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(r.isError).toBe(true);
    expect(t.text(r)).toMatch(/^VALIDATION_FAILED: /);
    expect(t.made().at(-1)?.slice(0, 2)).toEqual(['DELETE', `${BASE}/draft/lock`]);
  });

  it('a failed unlock is logged without arguments and does not mask the original error', async () => {
    const t = await connect({
      [`PATCH ${BASE}/draft`]: conflict('STALE'),
      [`DELETE ${BASE}/draft/lock`]: new ApiCallError({
        status: 503,
        code: 'NOT_READY',
        message: 'x',
      }),
    });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(t.text(r)).toMatch(/^CONFLICT: /);
    const logged = JSON.stringify(t.logs);
    expect(logged).toContain('NOT_READY');
    expect(logged).not.toContain(SUMMARY);
    expect(logged).not.toContain(EST_ID);
  });

  it('withDraftLock unlocks when fn throws a non-API error, and logs an unknown unlock failure', async () => {
    const t = await connect({ [`DELETE ${BASE}/draft/lock`]: new Error('socket closed') });
    const boom = new Error('boom');
    await expect(
      withDraftLock(t.ctx, EST_ID, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(t.made().at(-1)?.slice(0, 2)).toEqual(['DELETE', `${BASE}/draft/lock`]);
    expect(JSON.stringify(t.logs)).toContain('UNKNOWN');
    expect(JSON.stringify(t.logs)).not.toContain('socket closed');
  });

  it('update_draft with an unknown path or a negative count names the path and makes no lock or PATCH call', async () => {
    const t = await connect();
    for (const [path, value] of [
      ['inputs.team.nope', 1],
      ['assumptions.nope.api', 1],
      ['inputs.detail.fields', -1],
      ['notes.team', 1],
    ] as const) {
      const r = await t.call('update_draft', {
        estimateId: EST_ID,
        changes: [{ path, value }],
        summary: SUMMARY,
      });
      expect(r.isError, path).toBe(true);
      expect(t.text(r)).toMatch(/^VALIDATION_FAILED: /);
      expect(t.text(r)).toContain(path);
    }
    const methods = t.made().map((c) => c[0]);
    expect(methods.every((m) => m === 'GET')).toBe(true);
  });

  it('update_draft without an open draft returns NO_DRAFT and does not create one', async () => {
    const t = await connect({ [`GET ${BASE}`]: detail(null, false) });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(r.isError).toBe(true);
    expect(t.text(r)).toBe('NO_DRAFT: call start_draft first');
    expect(t.made()).toEqual([['GET', BASE]]);
  });

  it('refuses with EDITOR_OPEN when the user already holds the lock, and does not unlock it', async () => {
    const t = await connect({ [`GET ${BASE}`]: detail(MY_LOCK) });
    for (const name of ['update_draft', 'apply_profile', 'save_version']) {
      const r = await t.call(name, { ...WRITE_TOOLS[name], summary: SUMMARY });
      expect(r.isError, name).toBe(true);
      expect(t.text(r)).toBe('EDITOR_OPEN: close the draft in the editor first');
    }
    expect(t.made().every((c) => c[0] === 'GET' && c[1] === BASE)).toBe(true);
  });

  it('refuses with LOCKED naming the holder when someone else holds the lock; never sends takeover', async () => {
    const lock = { holder: OTHER, expiresAt: FUTURE, mine: false };
    const t = await connect({ [`GET ${BASE}`]: detail(lock) });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(r.isError).toBe(true);
    expect(t.text(r)).toBe(`LOCKED: held by Sample Reviewer until ${FUTURE}`);
    expect(t.made()).toEqual([['GET', BASE]]);
    expect(JSON.stringify(t.calls)).not.toContain('"takeover":true');
  });

  it('refuses any lock the server reports, whatever the local clock says', async () => {
    // The server only reports active locks; a client clock ahead of it must not override that.
    const t = await connect({ [`GET ${BASE}`]: detail({ ...MY_LOCK, expiresAt: PAST }) });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(t.text(r)).toBe('EDITOR_OPEN: close the draft in the editor first');
    expect(t.made()).toEqual([['GET', BASE]]);
  });

  it('refuses when the editor takes the lock while update_draft validates', async () => {
    let reads = 0;
    const t = await connect({
      [`GET ${BASE}`]: () => (++reads === 1 ? detail() : detail(MY_LOCK)),
    });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(t.text(r)).toBe('EDITOR_OPEN: close the draft in the editor first');
    expect(t.made().map((c) => `${c[0]} ${c[1]}`)).toEqual([
      `GET ${BASE}`,
      `GET ${BASE}/versions/2`,
      `GET ${BASE}`,
    ]);
  });

  it('update_draft returns NO_DRAFT when the draft is saved while it validates', async () => {
    let reads = 0;
    const t = await connect({
      [`GET ${BASE}`]: () => (++reads === 1 ? detail() : detail(null, false)),
    });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(t.text(r)).toBe('NO_DRAFT: call start_draft first');
    expect(t.made().some((c) => c[0] !== 'GET')).toBe(false);
  });

  it('an unlock answering 401 is logged, not challenged, and keeps the successful result', async () => {
    const t = await connect({
      [`DELETE ${BASE}/draft/lock`]: new ApiCallError({
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Token expired',
      }),
    });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ rowVersion: 6 });
    expect(t.delOpts).toEqual([{ noChallenge: true }]);
    expect(JSON.stringify(t.logs)).toContain('UNAUTHENTICATED');
    expect(JSON.stringify(t.logs)).toContain('"status":"ok"');
  });

  it('an unlock answering 409 NOT_HOLDER (lock expired mid-call) masks neither result nor error', async () => {
    const notHolder = conflict('NOT_HOLDER');
    const ok = await connect({ [`DELETE ${BASE}/draft/lock`]: notHolder });
    const r1 = await ok.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(r1.isError).toBeFalsy();
    expect(r1.structuredContent).toMatchObject({ rowVersion: 6 });
    expect(JSON.stringify(ok.logs)).toContain('draft_unlock_failed');

    const failed = await connect({
      [`DELETE ${BASE}/draft/lock`]: notHolder,
      [`PATCH ${BASE}/draft`]: new ApiCallError({
        status: 422,
        code: 'VALIDATION_FAILED',
        message: 'Invalid input',
      }),
    });
    const r2 = await failed.call('update_draft', {
      ...WRITE_TOOLS.update_draft,
      summary: SUMMARY,
    });
    expect(failed.text(r2)).toBe('VALIDATION_FAILED: Invalid input');
    expect(JSON.stringify(failed.logs)).toContain('draft_unlock_failed');
  });

  it('does not unlock when taking the lock fails', async () => {
    const t = await connect({ [`POST ${BASE}/draft/lock`]: conflict('HELD_BY_OTHER') });
    const r = await t.call('update_draft', { ...WRITE_TOOLS.update_draft, summary: SUMMARY });
    expect(t.text(r)).toMatch(/^CONFLICT: /);
    expect(t.made().some((c) => c[0] === 'DELETE')).toBe(false);
  });

  it('apply_profile uses the same lock sequence and passes rowVersion', async () => {
    const t = await connect();
    const r = await t.call('apply_profile', {
      estimateId: EST_ID,
      profileId: PROFILE_ID,
      summary: SUMMARY,
    });
    expect(r.isError).toBeFalsy();
    expect(t.made()).toEqual([
      ['GET', BASE],
      ['POST', `${BASE}/draft/lock`, { takeover: false }],
      ['POST', `${BASE}/draft/profile`, { profileId: PROFILE_ID, rowVersion: 5, summary: SUMMARY }],
      ['DELETE', `${BASE}/draft/lock`],
    ]);
  });

  it('save_version prefixes the default note and does not call submit', async () => {
    const t = await connect();
    const r = await t.call('save_version', { estimateId: EST_ID, summary: SUMMARY });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ status: 'SAVED' });
    expect(t.made()).toEqual([
      ['GET', BASE],
      ['POST', `${BASE}/draft/lock`, { takeover: false }],
      ['POST', `${BASE}/versions`, { note: `${NOTE_PREFIX}${SUMMARY}`, summary: SUMMARY }],
      // Saving releases the lock itself; there is no draft left to unlock.
    ]);
    expect(NOTE_PREFIX).toBe('Prepared with the estimation assistant: ');
  });

  it('save_version keeps a given note and releases the lock when saving fails', async () => {
    const t = await connect({ [`POST ${BASE}/versions`]: conflict('STALE') });
    const r = await t.call('save_version', {
      estimateId: EST_ID,
      note: 'Synthetic note',
      summary: SUMMARY,
    });
    expect(r.isError).toBe(true);
    expect(t.made().slice(2)).toEqual([
      ['POST', `${BASE}/versions`, { note: 'Synthetic note', summary: SUMMARY }],
      ['DELETE', `${BASE}/draft/lock`],
    ]);
  });

  it('submit_version calls only the submit endpoint', async () => {
    const t = await connect();
    const r = await t.call('submit_version', {
      estimateId: EST_ID,
      number: 1,
      note: 'Synthetic note',
      summary: SUMMARY,
    });
    expect(r.isError).toBeFalsy();
    expect(t.made()).toEqual([
      ['POST', `${BASE}/versions/1/submit`, { note: 'Synthetic note', summary: SUMMARY }],
    ]);
  });

  it('no tool exists for approve, return, delete, publish or takeover', async () => {
    const t = await connect();
    const { tools } = await t.client.listTools();
    expect(tools.map((x) => x.name).sort()).toEqual([
      'apply_profile',
      'compare_versions',
      'create_estimate',
      'describe_assumptions',
      'describe_inputs',
      'get_estimate',
      'get_profile',
      'get_version',
      'list_estimates',
      'list_profiles',
      'list_projects',
      'preview_estimate',
      'save_version',
      'start_draft',
      'submit_version',
      'update_draft',
      'whoami',
    ]);
    for (const x of tools) expect(x.name).not.toMatch(/approve|return|delete|publish|takeover/);
  });

  it('write tools are not marked read-only', async () => {
    const t = await connect();
    const { tools } = await t.client.listTools();
    for (const name of Object.keys(WRITE_TOOLS)) {
      const tool = tools.find((x) => x.name === name);
      expect(tool?.annotations?.readOnlyHint, name).toBe(false);
      expect(tool?.annotations?.destructiveHint, name).toBe(false);
      expect(tool?.inputSchema.required, name).toContain('summary');
    }
  });
});
