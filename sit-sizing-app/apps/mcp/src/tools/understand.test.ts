import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  computeBoth,
  DEFAULT_ASSUMPTIONS,
  ENGINE_VERSION,
  EXAMPLE_INPUTS,
  GROUP_KEYS,
  toStoredResult,
} from '@sit/engine';
import type * as Engine from '@sit/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createToolContext } from '../context';
import { createRateLimiter } from '../rate-limit';
import { fakeApi, fakeLogger, ME } from '../test-support';
import { registerUnderstandTools } from './understand';

vi.mock('@sit/engine', async (importOriginal) => {
  const m = await importOriginal<typeof Engine>();
  return { ...m, computeBoth: vi.fn(m.computeBoth) };
});

const USER = {
  id: 'clx0synthetic0001',
  displayName: 'Sample Estimator',
  email: 'sample.estimator@example.test',
};
const AT = '2026-01-01T00:00:00.000Z';
const EST_ID = 'clx0synthetic0e01';
const PROFILE_ID = 'clx0synthetic0f01';

const VERSION = {
  id: 'clx0synthetic0v01',
  number: 1,
  status: 'SAVED',
  engineVersion: ENGINE_VERSION,
  roughFte: 1,
  detailedFte: 1,
  totalCasesDetailed: 1,
  uncalibrated: 141,
  note: null,
  createdBy: USER,
  createdAt: AT,
  updatedAt: AT,
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  inputs: EXAMPLE_INPUTS,
  assumptions: { ...structuredClone(DEFAULT_ASSUMPTIONS), criticalShare: 0.5 },
  result: toStoredResult(computeBoth(EXAMPLE_INPUTS, DEFAULT_ASSUMPTIONS)),
  profileId: null,
  schemaVersion: 1,
  rowVersion: 1,
  lock: null,
  reviews: [],
};
const PROFILE = {
  id: PROFILE_ID,
  scope: 'GLOBAL',
  projectId: null,
  name: 'Synthetic profile',
  status: 'PUBLISHED',
  uncalibrated: 141,
  basedOnId: null,
  createdAt: AT,
  publishedAt: AT,
  values: { ...structuredClone(DEFAULT_ASSUMPTIONS), wiringCases: 3 },
  calibration: { wiringCases: { source: 'Synthetic retro', measuredAt: '2026-02-01' } },
};

async function connect() {
  const { api, get } = fakeApi({
    '/me': ME,
    [`/estimates/${EST_ID}/versions/1`]: VERSION,
    [`/profiles/${PROFILE_ID}`]: PROFILE,
  });
  const { log } = fakeLogger();
  const ctx = createToolContext({
    api,
    log,
    userKey: 'u',
    limiter: createRateLimiter({ limit: 1000 }),
  });
  const server = new McpServer({ name: 't', version: '0' });
  registerUnderstandTools(server, ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'c', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args });
  const text = (r: Awaited<ReturnType<typeof call>>) =>
    (r.content as Array<{ text: string }>)[0]?.text ?? '';
  return { client, call, text, get, api };
}

type Out = Record<string, unknown> & {
  rough: Record<string, number>;
  detailed: Record<string, number>;
  groups: Array<{
    group: string;
    rough: { cases: number; hours: number };
    detailed: { cases: number; hours: number };
  }>;
};

beforeEach(() => {
  vi.mocked(computeBoth).mockClear();
});

describe('understand tools', () => {
  it('are all read-only', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'describe_assumptions',
      'describe_inputs',
      'preview_estimate',
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it('describe_inputs uses the locale from GET /me unless one is given', async () => {
    const { call } = await connect();
    const vi1 = (await call('describe_inputs', { group: 'team' })).structuredContent as {
      fields: Array<{ path: string; label: string }>;
    };
    const en = (await call('describe_inputs', { group: 'team', locale: 'en' }))
      .structuredContent as typeof vi1;
    expect(en.fields.find((f) => f.path === 'team.weeks')?.label).toBe('SIT window (weeks)');
    expect(vi1.fields.find((f) => f.path === 'team.weeks')?.label).not.toBe('SIT window (weeks)');
  });

  it('describe_assumptions with neither version nor profile gives defaults only', async () => {
    const { call, get } = await connect();
    const r = (await call('describe_assumptions', { locale: 'en' })).structuredContent as {
      rows: unknown[];
      uncalibrated: number;
    };
    expect(r.rows).toHaveLength(142);
    expect(r.uncalibrated).toBe(142);
    expect(get.mock.calls.map((c) => c[0])).toEqual(['/me']);
  });

  it('describe_assumptions reads a version or a profile, never both', async () => {
    const { call, text } = await connect();
    const v = (
      await call('describe_assumptions', {
        estimateId: EST_ID,
        number: 1,
        paths: ['criticalShare'],
        locale: 'en',
      })
    ).structuredContent as { rows: Array<Record<string, unknown>>; uncalibrated: number };
    expect(v.rows).toEqual([expect.objectContaining({ value: 0.5, calibrated: true })]);
    expect(v.uncalibrated).toBe(141);

    const p = (await call('describe_assumptions', { profileId: PROFILE_ID, group: 'rules' }))
      .structuredContent as { rows: Array<Record<string, unknown>> };
    expect(p.rows.find((r) => r.path === 'wiringCases')).toMatchObject({
      value: 3,
      calibrated: true,
      source: 'Synthetic retro',
      measuredAt: '2026-02-01',
    });

    const both = await call('describe_assumptions', {
      estimateId: EST_ID,
      number: 1,
      profileId: PROFILE_ID,
    });
    expect(both.isError).toBe(true);
    expect(text(both)).toMatch(/^VALIDATION_FAILED/);
    expect(text(both)).toContain('profileId');

    const half = await call('describe_assumptions', { estimateId: EST_ID });
    expect(half.isError).toBe(true);
    expect(text(half)).toContain('number');

    const unknown = await call('describe_assumptions', { paths: ['cases.nope'] });
    expect(unknown.isError).toBe(true);
    expect(text(unknown)).toMatch(/^VALIDATION_FAILED/);
    expect(text(unknown)).toContain('cases.nope');
  });

  it('preview of EXAMPLE_INPUTS with DEFAULT_ASSUMPTIONS equals toStoredResult(computeBoth(...)) summary figures', async () => {
    const { call } = await connect();
    const r = await call('preview_estimate', { inputs: EXAMPLE_INPUTS });
    expect(r.isError).toBeFalsy();
    const out = r.structuredContent as Out;
    const both = computeBoth(EXAMPLE_INPUTS, DEFAULT_ASSUMPTIONS);
    const stored = toStoredResult(both);
    const { groups: _rg, ...rough } = stored.rough;
    const { groups: _dg, ...detailed } = stored.detailed;
    expect(out.rough).toEqual(rough);
    expect(out.detailed).toEqual(detailed);
    expect(out.engineVersion).toBe(ENGINE_VERSION);
    expect(out.uncalibrated).toBe(142);
    for (const g of out.groups) {
      expect(g.rough).toEqual(stored.rough.groups[g.group as keyof typeof stored.rough.groups]);
      expect(g.detailed).toEqual(
        stored.detailed.groups[g.group as keyof typeof stored.detailed.groups],
      );
    }
    expect(out.topGap).toEqual(expect.objectContaining({ group: expect.any(String) }));
    const sens = out.sensitivity as { swing: number; rough: unknown[]; detailed: unknown[] };
    expect(sens.swing).toBe(0.25);
    expect(sens.detailed.length).toBeGreaterThan(0);
    expect(sens.rough[0]).toEqual({
      key: expect.any(String),
      lo: expect.any(Number),
      hi: expect.any(Number),
      span: expect.any(Number),
    });
  });

  it('preview matches every file in packages/engine/golden', async () => {
    const dir = fileURLToPath(new URL('../../../../packages/engine/golden/', import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(26);
    const { call } = await connect();
    for (const f of files) {
      const g = JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
        assumptions: unknown;
        scope: unknown;
        expected: Record<
          'rough' | 'detailed',
          Record<string, number> & { groups: Record<string, { cases: number; hours: number }> }
        >;
      };
      const r = await call('preview_estimate', { inputs: g.scope, assumptions: g.assumptions });
      expect(r.isError, f).toBeFalsy();
      const out = r.structuredContent as Out;
      for (const mode of ['rough', 'detailed'] as const) {
        const e = g.expected[mode];
        expect(out[mode].cases, `${f} ${mode} cases`).toBe(e.cases);
        for (const [k, dp] of [
          ['hours', 2],
          ['fte', 4],
          ['lo', 4],
          ['hi', 4],
          ['smeLabelHours', 2],
        ] as const) {
          expect(Math.abs(out[mode][k]! - e[k]!), `${f} ${mode} ${k}`).toBeLessThanOrEqual(
            0.5 * 10 ** -dp + 1e-9,
          );
        }
        for (const k of GROUP_KEYS) {
          const got = out.groups.find((x) => x.group === k)?.[mode] ?? { cases: 0, hours: 0 };
          expect(got.cases, `${f} ${mode} ${k} cases`).toBe(e.groups[k]?.cases);
          expect(Math.abs(got.hours - (e.groups[k]?.hours ?? NaN))).toBeLessThanOrEqual(
            0.005 + 1e-9,
          );
        }
      }
    }
  });

  it('preview with base + changes fetches the version once and writes nothing', async () => {
    const { call, get, api } = await connect();
    const r = await call('preview_estimate', {
      base: { estimateId: EST_ID, number: 1 },
      changes: [
        { path: 'inputs.team.weeks', value: 12 },
        { path: 'assumptions.criticalShare', value: 0.3 },
      ],
    });
    expect(r.isError).toBeFalsy();
    const changed = structuredClone(EXAMPLE_INPUTS);
    changed.team.weeks = 12;
    const expected = toStoredResult(computeBoth(changed, DEFAULT_ASSUMPTIONS));
    const out = r.structuredContent as Out;
    expect(out.detailed.fte).toBe(expected.detailed.fte);
    expect(out.uncalibrated).toBe(142);
    expect(get.mock.calls.map((c) => c[0])).toEqual(['/me', `/estimates/${EST_ID}/versions/1`]);
    expect(api.post).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.del).not.toHaveBeenCalled();
  });

  it('refuses a change path that does not exist or lacks the inputs./assumptions. prefix', async () => {
    const { call, text } = await connect();
    for (const path of ['inputs.team.nope', 'team.weeks']) {
      const r = await call('preview_estimate', {
        base: { estimateId: EST_ID, number: 1 },
        changes: [{ path, value: 1 }],
      });
      expect(r.isError, path).toBe(true);
      expect(text(r)).toMatch(/^VALIDATION_FAILED/);
      expect(text(r)).toContain(path);
    }
    const neither = await call('preview_estimate', {});
    expect(neither.isError).toBe(true);
    const both = await call('preview_estimate', {
      inputs: EXAMPLE_INPUTS,
      base: { estimateId: EST_ID, number: 1 },
    });
    expect(both.isError).toBe(true);
    expect(computeBoth).not.toHaveBeenCalled();
  });

  it('refuses 501 features and a non-numeric band without calling the engine', async () => {
    const { call, text } = await connect();
    const feature = EXAMPLE_INPUTS.features[0]!;
    const many = { ...EXAMPLE_INPUTS, features: Array.from({ length: 501 }, () => feature) };
    const r1 = await call('preview_estimate', { inputs: many });
    expect(r1.isError).toBe(true);
    expect(text(r1)).toMatch(/^VALIDATION_FAILED/);
    expect(text(r1)).toContain('"path":"inputs.features"');

    const band = structuredClone(EXAMPLE_INPUTS) as unknown as { detail: { api: unknown[] } };
    band.detail.api = [1, 'three', 2];
    const r2 = await call('preview_estimate', { inputs: band });
    expect(r2.isError).toBe(true);
    expect(text(r2)).toContain('"path":"inputs.detail.api.1"');

    const r3 = await call('preview_estimate', {
      base: { estimateId: EST_ID, number: 1 },
      changes: [{ path: 'inputs.detail.api', value: [1, 'x', 2] }],
    });
    expect(r3.isError).toBe(true);
    expect(text(r3)).toContain('"path":"inputs.detail.api.1"');
    expect(computeBoth).not.toHaveBeenCalled();
  });

  it('output is flagged preview: true', async () => {
    const { client, call } = await connect();
    const r = await call('preview_estimate', { inputs: EXAMPLE_INPUTS });
    expect((r.structuredContent as Out).preview).toBe(true);
    expect(JSON.parse((r.content as Array<{ text: string }>)[0]!.text).preview).toBe(true);
    const { tools } = await client.listTools();
    const t = tools.find((x) => x.name === 'preview_estimate');
    expect(t?.description).toMatch(/saves nothing/i);
    expect(t?.outputSchema?.properties).toHaveProperty('preview');
  });
});
