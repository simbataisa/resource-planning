import { describe, expect, it } from 'vitest';
import * as engine from './index.ts';

describe('public API (design 6.2)', () => {
  it('exports the documented functions and constants', () => {
    for (const name of [
      'compute',
      'computeBoth',
      'sensitivity',
      'shiftLeftScenarios',
      'derivedRows',
      'calendarChecks',
      'uncalibratedCount',
      'fromPrototypeProfile',
      'toStoredResult',
      'versionSnapshot',
    ] as const) {
      expect(typeof engine[name], name).toBe('function');
    }
    expect(engine.ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(engine.DEFAULT_ASSUMPTIONS.overhead).toBeGreaterThan(0);
  });
});
