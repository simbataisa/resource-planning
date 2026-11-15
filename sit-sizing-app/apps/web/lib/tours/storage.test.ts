// @vitest-environment jsdom
import type { Me, TourState } from '@sit/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingSync, readLocal, writeLocal } from './storage';

const AT = '2026-03-01T00:00:00.000Z';
const meWith = (tours: TourState) => ({ tours }) as Me;

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('readLocal', () => {
  it('returns {} when nothing is stored', () => {
    expect(readLocal('u1')).toEqual({});
  });

  it('round-trips what writeLocal stored, per user', () => {
    writeLocal('u1', 'a@1', 'completed', AT);
    writeLocal('u1', 'b@1', 'skipped', AT);
    expect(readLocal('u1')).toEqual({
      'a@1': { status: 'completed', at: AT },
      'b@1': { status: 'skipped', at: AT },
    });
    expect(readLocal('u2')).toEqual({});
  });

  it('returns {} when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readLocal('u1')).toEqual({});
  });

  it('returns {} when the value is not valid JSON or not a tour state', () => {
    window.localStorage.setItem('sit-tours:u1', '{nope');
    expect(readLocal('u1')).toEqual({});
    window.localStorage.setItem('sit-tours:u1', JSON.stringify({ 'bad key': { status: 'x' } }));
    expect(readLocal('u1')).toEqual({});
  });
});

describe('writeLocal', () => {
  it('does not throw when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeLocal('u1', 'a@1', 'completed', AT)).not.toThrow();
  });
});

describe('pendingSync', () => {
  it('returns entries absent or different on the server, and none that match', () => {
    const local: TourState = {
      'a@1': { status: 'completed', at: AT },
      'b@1': { status: 'completed', at: AT },
      'c@1': { status: 'skipped', at: AT },
    };
    const me = meWith({
      'b@1': { status: 'dismissed', at: AT },
      'c@1': { status: 'skipped', at: AT },
    });
    expect(pendingSync(me, local)).toEqual({
      'a@1': { status: 'completed' },
      'b@1': { status: 'completed' },
    });
  });

  it('returns {} when local is empty', () => {
    expect(pendingSync(meWith({}), {})).toEqual({});
  });
});
