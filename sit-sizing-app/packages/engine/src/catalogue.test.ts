import * as schemas from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { ASSUMPTION_PATHS, FIELD_TYPES, GROUP_KEYS, GROUPS, PT_TYPES, SIZES } from './catalogue.ts';
import { DEFAULT_ASSUMPTIONS } from './defaults.ts';

describe('catalogue', () => {
  it('matches the shared schema lists', () => {
    expect([...GROUP_KEYS]).toEqual([...schemas.GROUP_KEYS]);
    expect([...FIELD_TYPES]).toEqual([...schemas.FIELD_TYPES]);
    expect([...PT_TYPES]).toEqual([...schemas.PT_TYPES]);
    expect([...SIZES]).toEqual([...schemas.SIZES]);
  });

  it('has 34 groups in four families', () => {
    expect(GROUPS).toHaveLength(34);
    expect(new Set(GROUPS.map((g) => g.family))).toEqual(new Set(['app', 'data', 'ai', 'pt']));
  });

  it('has 142 assumption rows, each resolving to a default value', () => {
    expect(ASSUMPTION_PATHS).toHaveLength(142);
    for (const p of ASSUMPTION_PATHS) {
      const v = p
        .split('.')
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], DEFAULT_ASSUMPTIONS);
      expect(v, p).not.toBeUndefined();
    }
  });
});
