/**
 * Draft edit lock rules (design 5.2.1, A-06). Pure: the caller passes the clock.
 * A lock lasts LOCK_MINUTES and is renewed by a heartbeat (POST …/lock) or by an autosave.
 * After it expires anyone allowed to edit can take it; a QE Lead can take it over at any time.
 * Taking a free or expired lock issues a token (lock-token.ts); renewing and using the lock
 * need its hash to match, so a second tab or the assistant cannot share the holder's lock.
 */
export const LOCK_MINUTES = 15;

export interface LockState {
  holderId: string | null;
  expiresAt: Date | null;
}

/** The lock state with the hash of the token that took it (null: no token). */
export interface TokenLockState extends LockState {
  tokenHash: string | null;
}

export type LockDecision =
  | { ok: true; expiresAt: Date; takeover: boolean; newToken: boolean; own: boolean }
  | { ok: false; reason: 'HELD_BY_OTHER' | 'TAKEOVER_NOT_ALLOWED' | 'LOCKED_ELSEWHERE' };

export type LockUse = { ok: true } | { ok: false; reason: 'LOCK_REQUIRED' | 'LOCKED_ELSEWHERE' };

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

const tokenMatches = (stored: string | null, presented: string | null) =>
  stored !== null && presented !== null && stored === presented;

/**
 * Take, renew or take over the lock. `opts.tokenHash` is the hash of the token the caller
 * presented (null: none). Free or expired → new token. Held by me with the matching token →
 * renewal. Held by me otherwise → LOCKED_ELSEWHERE, unless I take over my own lock on
 * purpose (any role). Held by someone else → unchanged rules (QE Lead takeover).
 */
export function decideLock(
  state: TokenLockState,
  userId: string,
  now: Date,
  opts: { takeover: boolean; canTakeover: boolean; tokenHash: string | null },
): LockDecision {
  const holder = activeHolder(state, now);
  const expiresAt = lockExpiry(now);
  if (holder === null) return { ok: true, expiresAt, takeover: false, newToken: true, own: false };
  if (holder === userId) {
    if (tokenMatches(state.tokenHash, opts.tokenHash))
      return { ok: true, expiresAt, takeover: false, newToken: false, own: false };
    if (!opts.takeover) return { ok: false, reason: 'LOCKED_ELSEWHERE' };
    return { ok: true, expiresAt, takeover: true, newToken: true, own: true };
  }
  if (!opts.takeover) return { ok: false, reason: 'HELD_BY_OTHER' };
  if (!opts.canTakeover) return { ok: false, reason: 'TAKEOVER_NOT_ALLOWED' };
  return { ok: true, expiresAt, takeover: true, newToken: true, own: false };
}

/** May this caller write to (or release) the draft? Holder and matching token required. */
export function lockUse(
  state: TokenLockState,
  userId: string,
  now: Date,
  tokenHash: string | null,
): LockUse {
  if (!holdsLock(state, userId, now)) return { ok: false, reason: 'LOCK_REQUIRED' };
  if (!tokenMatches(state.tokenHash, tokenHash)) return { ok: false, reason: 'LOCKED_ELSEWHERE' };
  return { ok: true };
}
