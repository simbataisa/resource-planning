import { describe, expect, it } from 'vitest';
import { randomCase } from '../tools/random-inputs.mjs';
import {
  compute,
  computeBoth,
  DEFAULT_ASSUMPTIONS,
  DRIVERS,
  EXAMPLE_INPUTS,
  GROUP_KEYS,
  shiftLeftScenarios,
} from '../src/index.ts';
import type { Assumptions, EstimateInputs } from '@sit/schemas';

/** Property tests (design 6.4 req. 3) over seeded random estimates. */
const shim = {
  clone: <T>(o: T): T => structuredClone(o),
  DEFAULTS: DEFAULT_ASSUMPTIONS,
  SAMPLE_SCOPE: EXAMPLE_INPUTS,
};
const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);
const defaultsOnly = (seed: number) => {
  const { S } = randomCase(shim, seed);
  return { A: structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions, S: S as EstimateInputs };
};

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

describe('engine properties', () => {
  it.each(SEEDS)('seed %i: results are never negative and totals add up', (seed) => {
    const { A, S } = randomCase(shim, seed);
    for (const mode of ['rough', 'detailed'] as const) {
      const r = compute(mode, S, A);
      let cases = 0;
      let hours = 0;
      for (const k of GROUP_KEYS) {
        expect(r.groups[k].cases).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(r.groups[k].cases)).toBe(true);
        expect(r.groups[k].hours).toBeGreaterThanOrEqual(0);
        cases += r.groups[k].cases;
        hours += r.groups[k].hours;
      }
      expect(r.cases).toBe(cases);
      expect(r.hours).toBeCloseTo(hours, 6);
      expect(r.fte).toBeGreaterThanOrEqual(0);
      expect(r.lo).toBeLessThanOrEqual(r.hi);
    }
  });

  it.each(SEEDS.slice(0, 40))(
    'seed %i: raising any detailed count never lowers total cases',
    (seed) => {
      const { A, S } = defaultsOnly(seed);
      const base = compute('detailed', S, A).cases;
      const bump = (edit: (s: EstimateInputs) => void) => {
        const s = structuredClone(S);
        edit(s);
        return compute('detailed', s, A).cases;
      };
      for (const d of DRIVERS)
        for (const b of [0, 1, 2] as const)
          expect(
            bump((s) => {
              s.detail[d][b] += 1;
            }),
          ).toBeGreaterThanOrEqual(base);
      for (const k of [
        'fields',
        'roles',
        'actions',
        'approvals',
        'critical',
        'variants',
        'languages',
      ] as const) {
        expect(
          bump((s) => {
            s.detail[k] += 1;
          }),
          k,
        ).toBeGreaterThanOrEqual(base);
      }
      for (const k of ['feed', 'pipe', 'table', 'report'] as const)
        expect(
          bump((s) => {
            s.detail.data[k][1] += 1;
          }),
          k,
        ).toBeGreaterThanOrEqual(base);
      for (const k of ['columns', 'dq', 'scd', 'secured', 'accessRoles'] as const)
        expect(
          bump((s) => {
            s.detail.data[k] += 1;
          }),
          k,
        ).toBeGreaterThanOrEqual(base);
      for (const k of ['intent', 'ocr'] as const)
        expect(
          bump((s) => {
            s.detail.ai[k][1] += 1;
          }),
          k,
        ).toBeGreaterThanOrEqual(base);
      for (const k of ['rag', 'tools', 'guard', 'hitl'] as const)
        expect(
          bump((s) => {
            s.detail.ai[k] += 1;
          }),
          k,
        ).toBeGreaterThanOrEqual(base);
      expect(
        bump((s) => {
          s.detail.pt.scen[1] += 1;
        }),
      ).toBeGreaterThanOrEqual(base);
    },
  );

  it.each(SEEDS.slice(0, 40))(
    'seed %i: raising a rough feature quantity never lowers total cases',
    (seed) => {
      const { A, S } = defaultsOnly(seed);
      const base = compute('rough', S, A).cases;
      S.features.forEach((_, i) => {
        const s = structuredClone(S);
        s.features[i]!.qty += 1;
        expect(compute('rough', s, A).cases).toBeGreaterThanOrEqual(base);
      });
    },
  );

  it.each(SEEDS.slice(0, 60))(
    'seed %i: with all gates met, FTE is no higher than with no gates',
    (seed) => {
      const { A, S } = defaultsOnly(seed);
      const [all, current, none] = shiftLeftScenarios(S, A);
      expect(all!.result.fte).toBeLessThanOrEqual(none!.result.fte + 1e-9);
      expect(all!.result.fte).toBeLessThanOrEqual(current!.result.fte + 1e-9);
    },
  );

  it.each(SEEDS.slice(0, 20))('seed %i: doubling the SIT window halves the FTE', (seed) => {
    const { A, S } = randomCase(shim, seed);
    const r1 = compute('detailed', S, A);
    if (r1.per === 0) return;
    const s2 = structuredClone(S);
    s2.team.weeks *= 2;
    expect(compute('detailed', s2, A).fte).toBeCloseTo(r1.fte / 2, 9);
  });

  it('never mutates its inputs and is deterministic', () => {
    const S = deepFreeze(structuredClone(EXAMPLE_INPUTS) as EstimateInputs);
    const A = deepFreeze(structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions);
    const a = computeBoth(S, A);
    const b = computeBoth(S, A);
    expect(a).toEqual(b);
  });
});
