import { describe, expect, it } from 'vitest';
import { applyChanges, PathError } from './merge';

const BASE = {
  team: { weeks: 8, mix: { junior: 30, mid: 50, senior: 20 } },
  features: [
    { name: 'Synthetic feature A', qty: 1 },
    { name: 'Synthetic feature B', qty: 2 },
  ],
  a11y: false,
};

describe('applyChanges', () => {
  it('sets a nested value and an array element without mutating the base', () => {
    const before = structuredClone(BASE);
    const out = applyChanges(BASE, [
      { path: 'team.mix.senior', value: 40 },
      { path: 'features.1.qty', value: 5 },
      { path: 'a11y', value: true },
      { path: 'features', value: [] },
    ]);
    expect(out).toEqual({
      ...BASE,
      team: { ...BASE.team, mix: { ...BASE.team.mix, senior: 40 } },
      features: [],
      a11y: true,
    });
    expect(BASE).toEqual(before);
    const only = applyChanges(BASE, [{ path: 'features.1.qty', value: 5 }]);
    expect(only.features[1]?.qty).toBe(5);
    expect(only.features[0]).not.toBe(BASE.features[0]);
    expect(BASE.features[1]?.qty).toBe(2);
  });

  it('throws PathError naming a path that does not exist', () => {
    for (const path of [
      'team.nope',
      'team.weeks.deeper',
      'features.2.qty',
      'features.x',
      'features.-1',
      'missing',
      '',
      'team..weeks',
      '__proto__.polluted',
      'team.constructor',
    ]) {
      let caught: unknown;
      try {
        applyChanges(BASE, [{ path, value: 1 }]);
      } catch (err) {
        caught = err;
      }
      expect(caught, path).toBeInstanceOf(PathError);
      expect((caught as PathError).path).toBe(path);
      expect((caught as PathError).message).toContain(`'${path}'`);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
