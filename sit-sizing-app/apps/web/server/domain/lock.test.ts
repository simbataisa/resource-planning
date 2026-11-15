import { describe, expect, it } from 'vitest';
import { activeHolder, decideLock, holdsLock, LOCK_MINUTES, lockExpiry, lockUse } from './lock';

const t0 = new Date('2026-11-12T09:00:00Z');
const at = (min: number) => new Date(t0.getTime() + min * 60_000);
const held = (by: string, untilMin: number, tokenHash: string | null = 'h-a') => ({
  holderId: by,
  expiresAt: at(untilMin),
  tokenHash,
});
const free = { holderId: null, expiresAt: null, tokenHash: null };
const opts = (
  o: { takeover?: boolean; canTakeover?: boolean; tokenHash?: string | null } = {},
) => ({
  takeover: o.takeover ?? false,
  canTakeover: o.canTakeover ?? false,
  tokenHash: o.tokenHash ?? null,
});

describe('edit lock', () => {
  it('lasts the configured number of minutes', () => {
    expect(lockExpiry(t0).getTime() - t0.getTime()).toBe(LOCK_MINUTES * 60_000);
  });

  it('a free lock can be taken, with a new token', () => {
    expect(decideLock(free, 'a', t0, opts())).toEqual({
      ok: true,
      expiresAt: at(LOCK_MINUTES),
      takeover: false,
      newToken: true,
      own: false,
    });
  });

  it('the holder renews it with the matching token (heartbeat), keeping the token', () => {
    const d = decideLock(held('a', 5), 'a', at(4), opts({ tokenHash: 'h-a' }));
    expect(d).toEqual({
      ok: true,
      expiresAt: at(4 + LOCK_MINUTES),
      takeover: false,
      newToken: false,
      own: false,
    });
  });

  it('the holder without the token, or with another one, is told it is open elsewhere', () => {
    expect(decideLock(held('a', 5), 'a', at(4), opts())).toEqual({
      ok: false,
      reason: 'LOCKED_ELSEWHERE',
    });
    expect(decideLock(held('a', 5), 'a', at(4), opts({ tokenHash: 'h-other' }))).toEqual({
      ok: false,
      reason: 'LOCKED_ELSEWHERE',
    });
    // A lock taken before tokens existed has no hash: it counts as open elsewhere.
    expect(decideLock(held('a', 5, null), 'a', at(4), opts({ tokenHash: 'h-a' }))).toMatchObject({
      ok: false,
      reason: 'LOCKED_ELSEWHERE',
    });
  });

  it('the holder can take over their own lock on purpose, whatever their role', () => {
    expect(
      decideLock(held('a', 5), 'a', at(4), opts({ takeover: true, canTakeover: false })),
    ).toEqual({
      ok: true,
      expiresAt: at(4 + LOCK_MINUTES),
      takeover: true,
      newToken: true,
      own: true,
    });
  });

  it('an expired lock with a stale token is taken afresh, with a new token', () => {
    expect(decideLock(held('a', 5), 'a', at(6), opts({ tokenHash: 'h-a' }))).toMatchObject({
      ok: true,
      takeover: false,
      newToken: true,
    });
  });

  it('someone else is refused while it is valid', () => {
    expect(
      decideLock(held('a', 5), 'b', at(4), opts({ canTakeover: true, tokenHash: 'h-a' })),
    ).toEqual({
      ok: false,
      reason: 'HELD_BY_OTHER',
    });
  });

  it('an expired lock is free for anyone', () => {
    expect(activeHolder(held('a', 5), at(5))).toBeNull();
    expect(decideLock(held('a', 5), 'b', at(5), opts()).ok).toBe(true);
  });

  it('only a QE Lead can take over a valid lock', () => {
    expect(decideLock(held('a', 5), 'b', at(1), opts({ takeover: true }))).toEqual({
      ok: false,
      reason: 'TAKEOVER_NOT_ALLOWED',
    });
    expect(
      decideLock(held('a', 5), 'b', at(1), opts({ takeover: true, canTakeover: true })),
    ).toMatchObject({ ok: true, takeover: true, newToken: true, own: false });
  });

  it('holdsLock is true only for a valid lock held by that user', () => {
    expect(holdsLock(held('a', 5), 'a', at(4))).toBe(true);
    expect(holdsLock(held('a', 5), 'a', at(6))).toBe(false);
    expect(holdsLock(held('a', 5), 'b', at(4))).toBe(false);
    expect(holdsLock(free, 'a', t0)).toBe(false);
  });

  it('using the lock needs the holder and the matching token', () => {
    expect(lockUse(held('a', 5), 'a', at(4), 'h-a')).toEqual({ ok: true });
    expect(lockUse(held('a', 5), 'a', at(4), null)).toEqual({
      ok: false,
      reason: 'LOCKED_ELSEWHERE',
    });
    expect(lockUse(held('a', 5), 'a', at(4), 'h-other')).toEqual({
      ok: false,
      reason: 'LOCKED_ELSEWHERE',
    });
    expect(lockUse(held('a', 5, null), 'a', at(4), null)).toEqual({
      ok: false,
      reason: 'LOCKED_ELSEWHERE',
    });
    expect(lockUse(held('a', 5), 'b', at(4), 'h-a')).toEqual({
      ok: false,
      reason: 'LOCK_REQUIRED',
    });
    expect(lockUse(held('a', 5), 'a', at(6), 'h-a')).toEqual({
      ok: false,
      reason: 'LOCK_REQUIRED',
    });
    expect(lockUse(free, 'a', t0, null)).toEqual({ ok: false, reason: 'LOCK_REQUIRED' });
  });
});
