import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { compute, computeBoth } from './compute.ts';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
import { ENGINE_VERSION } from './version.ts';

const A = () => structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
const S = () => structuredClone(EXAMPLE_INPUTS) as EstimateInputs;

describe('compute', () => {
  it('reproduces the design document headline numbers (design 6.4; engine 1.1.0, ADR-0019)', () => {
    const r = compute('rough', S(), A());
    const d = compute('detailed', S(), A());
    expect([r.cases, Math.round(r.hours), Number(r.fte.toFixed(2))]).toEqual([3511, 3562, 20.83]);
    expect([d.cases, Math.round(d.hours), Number(d.fte.toFixed(2))]).toEqual([4047, 3709, 21.69]);
  });

  it('stamps both modes with the engine version', () => {
    const b = computeBoth(S(), A());
    expect(b.engineVersion).toBe(ENGINE_VERSION);
    expect(ENGINE_VERSION).toBe('1.3.0');
    expect(b.rough.mode).toBe('rough');
    expect(b.detailed.mode).toBe('detailed');
  });

  it('replaces evidence as a whole when an override is given, but keeps PT reuse and APM from the estimate', () => {
    const s = S();
    s.evidence.ptReuse = 100;
    const r = compute('detailed', s, A(), { mutation: 100 });
    expect(r.mutOK).toBe(true);
    expect(r.fe).toBe('full'); // valFE missing from the override → treated as not proven
    expect(r.explain.ptReuse).toBe(1);
    expect(r.explain.evalCI).toBe(s.evidence.evalCI); // falls back to the estimate when not overridden
  });

  it('returns zero FTE when there is no capacity', () => {
    const s = S();
    s.team.weeks = 0;
    expect(compute('detailed', s, A()).fte).toBe(0);
    const t = S();
    t.team.mix = { junior: 0, mid: 0, senior: 0 };
    const r = compute('detailed', t, A());
    expect(r.fte).toBe(0);
    expect(r.levels).toEqual([0, 0, 0]);
  });

  it('applies the AI-assist cut to design time and clamps team settings', () => {
    const s = S();
    s.team.ai = 2;
    s.team.env = 3;
    s.team.automation = 100;
    const r = compute('detailed', s, A());
    expect(r.aiCut).toBe(DEFAULT_ASSUMPTIONS.aiDesignCut[2]);
    expect(r.design).toBeCloseTo(
      DEFAULT_ASSUMPTIONS.designFSD * (1 - DEFAULT_ASSUMPTIONS.aiDesignCut[2]),
      10,
    );
    expect(r.env).toBe(DEFAULT_ASSUMPTIONS.envFactor[3]);
    expect(r.auto).toBe(1);
  });

  it('turns off L4 journeys when they are excluded', () => {
    const s = S();
    s.includeL4 = false;
    expect(compute('detailed', s, A()).groups.journey).toEqual({ cases: 0, hours: 0 });
  });
});
