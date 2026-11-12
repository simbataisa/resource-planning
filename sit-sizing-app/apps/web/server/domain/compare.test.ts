import { describe, expect, it } from 'vitest';
import { diffJson } from './compare';

describe('version compare: field-level differences', () => {
  it('lists changed leaves with their path, triples as one value', () => {
    expect(
      diffJson(
        { team: { weeks: 6, mix: { junior: 30 } }, cases: { api: [4, 6, 10] }, same: 1 },
        { team: { weeks: 8, mix: { junior: 30 } }, cases: { api: [5, 7, 11] }, same: 1 },
      ),
    ).toEqual([
      { path: 'cases.api', a: [4, 6, 10], b: [5, 7, 11] },
      { path: 'team.weeks', a: 6, b: 8 },
    ]);
  });

  it('walks arrays of objects by position and reports added or removed items', () => {
    expect(
      diffJson(
        { f: [{ name: 'A', qty: 1 }] },
        {
          f: [
            { name: 'A', qty: 2 },
            { name: 'B', qty: 1 },
          ],
        },
      ),
    ).toEqual([
      { path: 'f[0].qty', a: 1, b: 2 },
      { path: 'f[1]', a: null, b: { name: 'B', qty: 1 } },
    ]);
    expect(diffJson({ x: 1 }, { x: 1 })).toEqual([]);
  });
});
