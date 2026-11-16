import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { blankInputs, computeBoth, DEFAULT_ASSUMPTIONS, toStoredResult } from '@sit/engine';
import { describe, expect, it } from 'vitest';
import { createToolContext } from '../context';
import { ApiCallError } from '../errors';
import { createRateLimiter } from '../rate-limit';
import { fakeApi, fakeLogger, ME } from '../test-support';
import { registerReadTools } from './read';

const USER = {
  id: 'clx0synthetic0001',
  displayName: 'Sample Estimator',
  email: 'sample.estimator@example.test',
};
const AT = '2026-01-01T00:00:00.000Z';
const PROJECT_ID = 'clx0synthetic0p01';
const EST_ID = 'clx0synthetic0e01';

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

const PROJECT = {
  id: PROJECT_ID,
  key: 'SYN',
  name: 'Synthetic Project',
  description: null,
  archived: false,
  createdAt: AT,
  myRole: 'ESTIMATOR',
};
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
const DETAIL = {
  ...ESTIMATE,
  versions: [summary(2, 'DRAFT'), summary(1)],
  draftLock: null,
};
const inputs = blankInputs();
const VERSION = {
  ...summary(1),
  inputs,
  assumptions: DEFAULT_ASSUMPTIONS,
  result: toStoredResult(computeBoth(inputs, DEFAULT_ASSUMPTIONS)),
  profileId: null,
  schemaVersion: 1,
  rowVersion: 1,
  lock: null,
  reviews: [],
};
const FIG = { fte: 1, cases: 2, hours: 3 };
const COMPARE = {
  a: summary(1),
  b: summary(2, 'DRAFT'),
  results: {
    rough: { a: FIG, b: FIG },
    detailed: { a: FIG, b: FIG },
  },
  groups: [],
  changes: [{ area: 'inputs', path: 'team.weeks', a: 8, b: 12 }],
  truncated: false,
};
function profile(id: string, status: string) {
  return {
    id,
    scope: 'GLOBAL',
    projectId: null,
    name: `Profile ${id}`,
    status,
    uncalibrated: 0,
    assumptionRows: 160,
    basedOnId: null,
    createdAt: AT,
    publishedAt: status === 'DRAFT' ? null : AT,
  };
}
const PROFILE_ID = 'clx0synthetic0f01';

async function connect(extra: Record<string, unknown> = {}) {
  const { api, get } = fakeApi({
    '/me': ME,
    '/projects': { items: [PROJECT], nextCursor: null },
    [`/projects/${PROJECT_ID}/estimates`]: { items: [ESTIMATE], nextCursor: null },
    [`/estimates/${EST_ID}`]: DETAIL,
    [`/estimates/${EST_ID}/versions/1`]: VERSION,
    [`/estimates/${EST_ID}/versions/2`]: { ...VERSION, ...summary(2, 'DRAFT') },
    [`/estimates/${EST_ID}/compare`]: COMPARE,
    '/profiles': {
      items: [
        profile('p-pub', 'PUBLISHED'),
        profile('p-draft', 'DRAFT'),
        profile('p-old', 'RETIRED'),
      ],
    },
    [`/profiles/${PROFILE_ID}`]: {
      ...profile(PROFILE_ID, 'PUBLISHED'),
      values: DEFAULT_ASSUMPTIONS,
      calibration: {},
    },
    ...extra,
  });
  const { log, calls } = fakeLogger();
  const ctx = createToolContext({
    api,
    log,
    userKey: 'u',
    limiter: createRateLimiter({ limit: 60 }),
  });
  const server = new McpServer({ name: 't', version: '0' });
  registerReadTools(server, ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'c', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args });
  const text = (r: Awaited<ReturnType<typeof call>>) =>
    (r.content as Array<{ text: string }>)[0]?.text;
  return { client, call, text, get, calls };
}

/** The API calls other than the per-request `GET /me`. */
function apiCalls(get: ReturnType<typeof fakeApi>['get']) {
  return get.mock.calls.filter((c) => c[0] !== '/me').map((c) => [c[0], c[2]]);
}

describe('read tools', () => {
  it('whoami returns the parsed user from one GET /me', async () => {
    const { call, get } = await connect();
    const r = await call('whoami');
    expect(r.structuredContent).toEqual(ME);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('whoami passes NOT_PROVISIONED through as a tool error', async () => {
    const { call, text } = await connect({
      '/me': new ApiCallError({
        status: 403,
        code: 'NOT_PROVISIONED',
        message: 'Sign in to SIT Sizing once first',
      }),
    });
    const r = await call('whoami');
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/^NOT_PROVISIONED: /);
  });

  it('every read tool is read-only', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'compare_versions',
      'get_estimate',
      'get_profile',
      'get_version',
      'list_estimates',
      'list_profiles',
      'list_projects',
      'whoami',
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it('list_projects calls GET /projects and returns the page', async () => {
    const { call, get } = await connect();
    const r = await call('list_projects', { limit: 10 });
    expect(r.structuredContent).toEqual({ items: [PROJECT], nextCursor: null });
    expect(apiCalls(get)).toEqual([['/projects', { cursor: undefined, limit: 10 }]]);
  });

  it('list_estimates calls GET /projects/{id}/estimates', async () => {
    const { call, get } = await connect();
    const r = await call('list_estimates', { projectId: PROJECT_ID, cursor: 'c1' });
    expect(r.structuredContent).toEqual({ items: [ESTIMATE], nextCursor: null });
    expect(apiCalls(get)).toEqual([
      [`/projects/${PROJECT_ID}/estimates`, { cursor: 'c1', limit: undefined }],
    ]);
  });

  it('get_estimate calls GET /estimates/{id}', async () => {
    const { call, get } = await connect();
    const r = await call('get_estimate', { estimateId: EST_ID });
    expect(r.structuredContent).toEqual(DETAIL);
    expect(apiCalls(get)).toEqual([[`/estimates/${EST_ID}`, undefined]]);
  });

  it('get_version with a number calls GET /estimates/{id}/versions/{n}', async () => {
    const { call, get } = await connect();
    const r = await call('get_version', { estimateId: EST_ID, number: 1 });
    expect(r.structuredContent).toMatchObject({ number: 1, status: 'SAVED' });
    expect(apiCalls(get)).toEqual([[`/estimates/${EST_ID}/versions/1`, undefined]]);
  });

  it('get_version with "draft" resolves the draft number, and errors clearly when there is no draft', async () => {
    const { call, get } = await connect();
    const r = await call('get_version', { estimateId: EST_ID, number: 'draft' });
    expect(r.structuredContent).toMatchObject({ number: 2, status: 'DRAFT' });
    expect(apiCalls(get).map((c) => c[0])).toEqual([
      `/estimates/${EST_ID}`,
      `/estimates/${EST_ID}/versions/2`,
    ]);

    const none = await connect({
      [`/estimates/${EST_ID}`]: { ...DETAIL, hasDraft: false, versions: [summary(1)] },
    });
    const e = await none.call('get_version', { estimateId: EST_ID, number: 'draft' });
    expect(e.isError).toBe(true);
    expect(none.text(e)).toMatch(/^NO_DRAFT: This estimate has no open draft\. Call start_draft/);
  });

  it('compare_versions sends a and b as query parameters', async () => {
    const { call, get } = await connect();
    const r = await call('compare_versions', { estimateId: EST_ID, a: 1, b: 'draft' });
    expect(r.structuredContent).toEqual(COMPARE);
    expect(apiCalls(get)).toEqual([
      [`/estimates/${EST_ID}`, undefined],
      [`/estimates/${EST_ID}/compare`, { a: 1, b: 2 }],
    ]);
  });

  it('list_profiles hides draft and retired profiles and passes projectId', async () => {
    const { call, get } = await connect();
    const r = await call('list_profiles', { projectId: PROJECT_ID });
    expect(r.structuredContent).toEqual({ items: [profile('p-pub', 'PUBLISHED')] });
    expect(apiCalls(get)).toEqual([['/profiles', { projectId: PROJECT_ID }]]);
  });

  it('get_profile calls GET /profiles/{id}', async () => {
    const { call, get } = await connect();
    const r = await call('get_profile', { profileId: PROFILE_ID });
    expect(r.structuredContent).toMatchObject({ id: PROFILE_ID, status: 'PUBLISHED' });
    expect(apiCalls(get)).toEqual([[`/profiles/${PROFILE_ID}`, undefined]]);
  });

  it('a 404 from the API becomes a NOT_FOUND tool error', async () => {
    const { call, text } = await connect({
      [`/estimates/${EST_ID}`]: new ApiCallError({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Estimate not found',
      }),
    });
    const r = await call('get_estimate', { estimateId: EST_ID });
    expect(r.isError).toBe(true);
    expect(text(r)).toBe('NOT_FOUND: Estimate not found');
  });

  it('an expired token during a read becomes an auth challenge', async () => {
    const { call, text, calls } = await connect({
      [`/estimates/${EST_ID}`]: new ApiCallError({
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Token expired',
      }),
    });
    const r = await call('get_estimate', { estimateId: EST_ID });
    // The SDK shows a throw as an error result; the HTTP layer answers 401 from the client hook.
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/Authentication required/);
    expect(JSON.stringify(calls)).toContain('"status":"auth_challenge"');
  });

  it('rejects an id that is not an Id before calling the API', async () => {
    const { call, get } = await connect();
    for (const bad of ['', 'x'.repeat(41), 7]) {
      const r = await call('get_estimate', { estimateId: bad });
      expect(r.isError).toBe(true);
    }
    const v = await call('get_version', { estimateId: EST_ID, number: 0 });
    expect(v.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });
});
