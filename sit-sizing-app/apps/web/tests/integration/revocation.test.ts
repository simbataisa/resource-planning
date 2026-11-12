import { describe, expect, it } from 'vitest';
import { isSessionRevoked, revokeSession } from '@/server/auth/revocation';
import { db } from '@/server/db';

describe('revoked Keycloak sessions (back-channel logout)', () => {
  it('records a revoked session id and finds it again', async () => {
    expect(await isSessionRevoked('kc-session-synthetic-1')).toBe(false);
    await revokeSession('kc-session-synthetic-1');
    expect(await isSessionRevoked('kc-session-synthetic-1')).toBe(true);
    await revokeSession('kc-session-synthetic-1'); // a repeated logout is harmless
    expect(await isSessionRevoked(undefined)).toBe(false);
  });

  it('removes rows that have outlived any app session', async () => {
    await db().revokedSession.create({
      data: { sid: 'kc-session-synthetic-old', expiresAt: new Date('2020-01-01T00:00:00Z') },
    });
    await revokeSession('kc-session-synthetic-2');
    expect(await isSessionRevoked('kc-session-synthetic-old')).toBe(false);
  });
});
