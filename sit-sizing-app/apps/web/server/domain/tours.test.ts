import { describe, expect, it } from 'vitest';
import type { TourState } from '@sit/schemas';
import { mergeTours } from './tours';

const now = new Date('2026-11-17T10:00:00.000Z');
const old = '2026-11-01T00:00:00.000Z';

describe('mergeTours', () => {
  it('stamps new and changed keys with now and keeps untouched keys', () => {
    const stored: TourState = {
      'a@1': { status: 'completed', at: old },
      'b@1': { status: 'dismissed', at: old },
    };
    const out = mergeTours(
      stored,
      { 'b@1': { status: 'skipped' }, 'c@1': { status: 'completed' } },
      now,
    );
    expect(out['a@1']).toEqual({ status: 'completed', at: old });
    expect(out['b@1']).toEqual({ status: 'skipped', at: now.toISOString() });
    expect(out['c@1']).toEqual({ status: 'completed', at: now.toISOString() });
  });

  it('removes keys given null', () => {
    const stored: TourState = { 'a@1': { status: 'completed', at: old } };
    expect(mergeTours(stored, { 'a@1': null, 'zz@1': null }, now)).toEqual({});
  });

  it('does not mutate the stored state', () => {
    const stored: TourState = { 'a@1': { status: 'completed', at: old } };
    mergeTours(stored, { 'a@1': null }, now);
    expect(stored['a@1']).toBeDefined();
  });

  it('keeps at most 100 keys, dropping the oldest at', () => {
    const stored: TourState = {};
    for (let i = 0; i < 100; i++) {
      const at = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
      stored[`t${i}@1`] = { status: 'completed', at };
    }
    const out = mergeTours(stored, { 'new@1': { status: 'completed' } }, now);
    expect(Object.keys(out)).toHaveLength(100);
    expect(out['t0@1']).toBeUndefined();
    expect(out['t1@1']).toBeDefined();
    expect(out['new@1']).toBeDefined();
  });
});
