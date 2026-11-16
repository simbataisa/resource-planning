import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
import { versionSnapshot } from './snapshot.ts';
import { ENGINE_VERSION } from './version.ts';

describe('versionSnapshot', () => {
  it('stores the recomputed result and the denormalised columns', () => {
    const s = versionSnapshot(
      structuredClone(EXAMPLE_INPUTS) as EstimateInputs,
      structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions,
    );
    expect(s.engineVersion).toBe(ENGINE_VERSION);
    expect(s.roughFte).toBe(20.83);
    expect(s.detailedFte).toBe(21.69);
    expect(s.totalCasesDetailed).toBe(4047);
    expect(s.uncalibrated).toBe(142);
    expect(s.result.detailed.cases).toBe(4047);
  });
});

describe('blankInputs', () => {
  it('has no scope, so both modes count no cases', async () => {
    const { blankInputs } = await import('./defaults.ts');
    const s = versionSnapshot(blankInputs(), structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions);
    expect(s.totalCasesDetailed).toBe(0);
    expect(s.result.rough.cases).toBe(0);
  });
});
