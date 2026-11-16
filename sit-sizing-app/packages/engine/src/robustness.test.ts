import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { calendarChecks } from './calendar.ts';
import { isDefaultRow } from './calibration.ts';
import { compute, computeBoth } from './compute.ts';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
import { derivedRows } from './derived.ts';
import { gapRows } from './gap.ts';
import { fromPrototypeProfile } from './prototype-import.ts';

/**
 * The prototype tolerates loose or partial data (old saved profiles, hand-edited JSON).
 * The API validates with Zod first, but the engine keeps the same tolerance so imported
 * prototype payloads behave identically. These inputs are deliberately outside the schema.
 */
const A = () => structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
const S = () => structuredClone(EXAMPLE_INPUTS) as EstimateInputs;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately schema-invalid input
const loose = (o: unknown) => o as any;

describe('tolerance for loose inputs (prototype behaviour)', () => {
  it('skips features whose size has no proxy, and missing proxy keys count as 0', () => {
    const s = S();
    s.features = loose([
      { name: 'a', size: 'XXXXL', cx: 0, qty: 1 },
      { name: 'b', type: 'data', size: 'XXXXL', cx: 0, qty: 1, pt: true },
      { name: 'c', type: 'ai', size: 'XXXXL', cx: 0, qty: 1 },
    ]);
    const none = S();
    none.features = [];
    expect(compute('rough', s, A()).cases).toBe(compute('rough', none, A()).cases);

    const b = A();
    delete loose(b.proxies.S).api;
    delete loose(b.dproxies.S).feed;
    delete loose(b.dproxies.S).columns;
    delete loose(b.aproxies.S).intent;
    delete loose(b.aproxies.S).rag;
    delete loose(b.aproxies.S).guard;
    const t = S();
    t.features = [
      { name: 'a', size: 'S', cx: 0, qty: 1 },
      { name: 'b', type: 'data', size: 'S', cx: 0, qty: 1 },
      { name: 'c', type: 'ai', size: 'S', cx: 0, qty: 1 },
    ];
    const r = compute('rough', t, b);
    expect(r.counts.api).toEqual([0, 0, 0]);
    expect(r.counts.data.feed).toEqual([0, 0, 0]);
    expect(r.counts.ai.guard).toBe(0);
  });

  it('treats missing channels, detail drivers and sub-scopes as empty', () => {
    const s = loose(S());
    delete s.channels;
    delete s.detail.api;
    delete s.detail.pt;
    s.detail.data = {
      ...s.detail.data,
      feed: [0, 0, 0],
      pipe: [0, 0, 0],
      table: [0, 0, 0],
      report: [0, 0, 0],
      dq: [0, 0, 0],
      secured: 0,
      columns: [10, 0, 0],
    };
    delete s.detail.fieldTypes;
    s.team.aiIters = 0;
    s.ptTypes = undefined;
    const d = compute('detailed', s, A());
    expect(d.counts.api).toEqual([0, 0, 0]);
    expect(d.explain.mobOn).toEqual([]);
    expect(d.explain.dOn).toBe(true);
    expect(d.explain.iters).toBe(1);
    expect(d.explain.ptOn).toBe(false);

    const t = loose(S());
    t.detail.pt = {};
    expect(compute('detailed', t, A()).explain.ptN).toBe(0);
  });

  it('falls back to zero cases per field when the typical mix is all zero', () => {
    const a = A();
    for (const t of Object.keys(a.ftypes) as (keyof Assumptions['ftypes'])[]) a.ftypes[t].mix = 0;
    expect(compute('detailed', S(), a).explain.perField).toBe(0);
  });

  it('uses zero for missing PT size proxies', () => {
    const a = A();
    delete loose(a.ptRoughScen).L;
    const s = S();
    s.features = [{ name: 'p', size: 'L', cx: 1, qty: 1, pt: true }];
    expect(compute('rough', s, a).explain.ptN).toBe(0);
  });

  it('calendar checks fall back to safe defaults', () => {
    const s = loose(S());
    s.team.weeks = 'n/a';
    s.team.aiSmes = 0;
    const checks = calendarChecks(computeBoth(s, A()), s, A());
    expect(checks.find((c) => c.kind === 'ai')).toMatchObject({ smes: 1, windowDays: 0 });
  });

  it('unknown assumption paths compare as equal (both undefined)', () => {
    expect(isDefaultRow(A(), DEFAULT_ASSUMPTIONS, 'no.such.path')).toBe(true);
  });

  it('derived rows show the non-APM environment setup', () => {
    const s = S();
    s.evidence.apm = false;
    const pt = derivedRows(compute('detailed', s, A()), A()).find((r) => r.group === 'ptEnv')!;
    expect(pt.params.setupHours).toBe(DEFAULT_ASSUMPTIONS.ptEnvHours);
  });

  it('gap rows keep hours-only groups such as data preparation', () => {
    const s = S();
    s.features = s.features.filter((f) => f.type !== 'data');
    const rows = gapRows(computeBoth(s, A()));
    const prep = rows.find((r) => r.group === 'dataPrep')!;
    expect(prep.detailedCases).toBe(0);
    expect(prep.deltaHours).toBeGreaterThan(0);
  });

  it('prototype import keeps valid feature types and zeroes bad quantities', () => {
    const { inputs } = fromPrototypeProfile({
      assumptions: {},
      scope: { features: [{ name: 'd', type: 'data', size: 'S', cx: 0, qty: 'x' }] },
    });
    expect(inputs!.features[0]).toMatchObject({ type: 'data', qty: 0 });
  });
});
