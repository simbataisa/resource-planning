/**
 * Draft edit lock rules (design 5.2.1, A-06). Pure: the caller passes the clock.
 * A lock lasts LOCK_MINUTES and is renewed by a heartbeat (POST …/lock) or by an autosave.
 * After it expires anyone allowed to edit can take it; a QE Lead can take it over at any time.
 */
export const LOCK_MINUTES = 15;

export interface LockState {
  holderId: string | null;
  expiresAt: Date | null;
}

export type LockDecision =
  | { ok: true; expiresAt: Date; takeover: boolean }
  | { ok: false; reason: 'HELD_BY_OTHER' | 'TAKEOVER_NOT_ALLOWED' };

export function lockExpiry(now: Date): Date {
  return new Date(now.getTime() + LOCK_MINUTES * 60_000);
}

/** The holder while the lock is still valid, otherwise null. */
export function activeHolder(state: LockState, now: Date): string | null {
  return state.holderId && state.expiresAt && state.expiresAt.getTime() > now.getTime()
    ? state.holderId
    : null;
}

export function holdsLock(state: LockState, userId: string, now: Date): boolean {
  return activeHolder(state, now) === userId;
}

export function decideLock(
  state: LockState,
  userId: string,
  now: Date,
  opts: { takeover: boolean; canTakeover: boolean },
): LockDecision {
  const holder = activeHolder(state, now);
  if (holder === null || holder === userId)
    return { ok: true, expiresAt: lockExpiry(now), takeover: false };
  if (!opts.takeover) return { ok: false, reason: 'HELD_BY_OTHER' };
  if (!opts.canTakeover) return { ok: false, reason: 'TAKEOVER_NOT_ALLOWED' };
  return { ok: true, expiresAt: lockExpiry(now), takeover: true };
}
