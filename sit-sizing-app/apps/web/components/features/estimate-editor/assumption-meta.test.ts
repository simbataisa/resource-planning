import { describe, expect, it } from 'vitest';
import { ASSUMPTION_PATHS } from '@sit/engine';
import en from '@/messages/en.json';
import { ASSUMPTION_META } from './assumption-meta';

const lookup = (key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en);

describe('Assumptions tab layout', () => {
  const rows = ASSUMPTION_META.flatMap((g) => g.rows);

  it('lists exactly the engine assumption paths, in the prototype order', () => {
    expect(rows.map((r) => r.path)).toEqual([...ASSUMPTION_PATHS]);
  });

  it('has a message for every group, row, column, key and unit', () => {
    const keys = [
      ...ASSUMPTION_META.map((g) => `assumptionsTab.groups.${g.group}`),
      ...rows.map((r) => r.label.key),
      ...rows.flatMap((r) => (r.kind === 'cols' ? r.cols : [])),
      ...rows.flatMap((r) =>
        r.kind === 'keys' ? r.keys.map(([, ref]) => ref).filter((ref) => !ref.startsWith('=')) : [],
      ),
      ...rows.flatMap((r) =>
        r.kind === 'cols' || r.kind === 'scalar' ? [`assumptionsTab.units.${r.unit}`] : [],
      ),
    ];
    expect(keys.filter((k) => typeof lookup(k) !== 'string')).toEqual([]);
  });
});
