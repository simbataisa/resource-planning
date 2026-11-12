import { describe, expect, it } from 'vitest';
import { activeHolder, decideLock, holdsLock, LOCK_MINUTES, lockExpiry } from './lock';

const t0 = new Date('2026-11-12T09:00:00Z');
const at = (min: number) => new Date(t0.getTime() + min * 60_000);
const held = (by: string, untilMin: number) => ({ holderId: by, expiresAt: at(untilMin) });
const free = { holderId: null, expiresAt: null };

describe('edit lock', () => {
  it('lasts the configured number of minutes', () => {
    expect(lockExpiry(t0).getTime() - t0.getTime()).toBe(LOCK_MINUTES * 60_000);
  });

  it('a free lock can be taken', () => {
    expect(decideLock(free, 'a', t0, { takeover: false, canTakeover: false })).toEqual({
      ok: true,
      expiresAt: at(LOCK_MINUTES),
      takeover: false,
    });
  });

  it('the holder renews it (heartbeat)', () => {
    const d = decideLock(held('a', 5), 'a', at(4), { takeover: false, canTakeover: false });
    expect(d).toEqual({ ok: true, expiresAt: at(4 + LOCK_MINUTES), takeover: false });
  });

  it('someone else is refused while it is valid', () => {
    expect(decideLock(held('a', 5), 'b', at(4), { takeover: false, canTakeover: true })).toEqual({
      ok: false,
      reason: 'HELD_BY_OTHER',
    });
  });

  it('an expired lock is free for anyone', () => {
    expect(activeHolder(held('a', 5), at(5))).toBeNull();
    expect(decideLock(held('a', 5), 'b', at(5), { takeover: false, canTakeover: false }).ok).toBe(
      true,
    );
  });

  it('only a QE Lead can take over a valid lock', () => {
    expect(decideLock(held('a', 5), 'b', at(1), { takeover: true, canTakeover: false })).toEqual({
      ok: false,
      reason: 'TAKEOVER_NOT_ALLOWED',
    });
    expect(
      decideLock(held('a', 5), 'b', at(1), { takeover: true, canTakeover: true }),
    ).toMatchObject({ ok: true, takeover: true });
  });

  it('holdsLock is true only for a valid lock held by that user', () => {
    expect(holdsLock(held('a', 5), 'a', at(4))).toBe(true);
    expect(holdsLock(held('a', 5), 'a', at(6))).toBe(false);
    expect(holdsLock(held('a', 5), 'b', at(4))).toBe(false);
    expect(holdsLock(free, 'a', t0)).toBe(false);
  });
});
