import { describe, expect, it } from 'vitest';
import { updateSession } from './refresh';
import type { SessionData } from './session';

const base: SessionData = {
  uid: 'u1',
  sub: 'dev-estimator',
  idToken: 'id',
  refreshToken: 'r1',
  refreshAt: 1000,
  lastSeen: 900,
  expiresAt: 50000,
};

describe('updateSession', () => {
  it('keeps the cookie when nothing is due', async () => {
    expect(await updateSession(base, 950, async () => ({}))).toEqual({ kind: 'keep' });
  });

  it('moves the idle clock after five minutes', async () => {
    const r = await updateSession({ ...base, refreshAt: 5000 }, 900 + 300, async () => ({}));
    expect(r).toEqual({ kind: 'update', session: { ...base, refreshAt: 5000, lastSeen: 1200 } });
  });

  it('refreshes when due and rotates the refresh token', async () => {
    const r = await updateSession(base, 1000, async (t) => {
      expect(t).toBe('r1');
      return { refresh_token: 'r2', id_token: 'id2', expires_in: 600 };
    });
    expect(r).toEqual({
      kind: 'update',
      session: { ...base, refreshToken: 'r2', idToken: 'id2', refreshAt: 1540, lastSeen: 1000 },
    });
  });

  it('ends the session when Keycloak refuses the refresh', async () => {
    expect(
      await updateSession(base, 1000, async () => {
        throw new Error('invalid_grant');
      }),
    ).toEqual({ kind: 'end', reason: 'REFRESH_FAILED' });
    const { refreshToken: _r, ...noRefresh } = base;
    expect(await updateSession(noRefresh, 1000, async () => ({}))).toEqual({
      kind: 'end',
      reason: 'NO_REFRESH_TOKEN',
    });
  });
});
