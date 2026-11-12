import { describe, expect, it } from 'vitest';
import { computeBoth } from './compute.ts';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
import type { Assumptions, EstimateInputs } from '@sit/schemas';

/**
 * Performance budget (design 8.3, 13): the editor runs computeBoth() on every keystroke, so a
 * large scope must stay well inside one frame (16 ms). Measured as the median of many runs.
 */
function largeScope(): EstimateInputs {
  const s = structuredClone(EXAMPLE_INPUTS) as EstimateInputs;
  s.features = Array.from({ length: 50 }, (_, i) => ({
    ...s.features[i % s.features.length]!,
    name: `Synthetic feature ${i + 1}`,
  }));
  const times10 = (t: number[]) => t.map((n) => n * 10) as [number, number, number];
  for (const k of [
    'api',
    'screen',
    'integration',
    'rule',
    'journey',
    'batch',
    'event',
    'workflow',
  ] as const)
    s.detail[k] = times10(s.detail[k]);
  s.detail.fields *= 10;
  return s;
}

describe('performance budget', () => {
  it('computeBoth on a large scope takes under 16 ms (median of 50 runs)', () => {
    const inputs = largeScope();
    const A = structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
    for (let i = 0; i < 10; i += 1) computeBoth(inputs, A); // warm up
    const times: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      const t = performance.now();
      computeBoth(inputs, A);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)]!;
    expect(median).toBeLessThan(16);
  });
});
