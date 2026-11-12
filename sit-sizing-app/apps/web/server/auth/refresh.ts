import { client, oidcConfig } from './oidc';
import { nowSeconds, TOUCH_SECONDS, type SessionData } from './session';

export type SessionUpdate =
  | { kind: 'keep' }
  | { kind: 'update'; session: SessionData }
  | { kind: 'end'; reason: 'REFRESH_FAILED' | 'NO_REFRESH_TOKEN' };

/**
 * Decides what to do with a valid session on this request (design 10.4, 10.5):
 * - every access-token lifetime, ask Keycloak for new tokens. If the user was disabled,
 *   signed out elsewhere or the SSO session ended, the refresh fails and the app session
 *   ends too ("disabling an account takes effect within one access-token lifetime");
 * - otherwise move the idle clock at most every TOUCH_SECONDS.
 */
export async function updateSession(
  s: SessionData,
  now: number,
  refresh: (
    refreshToken: string,
  ) => Promise<{ refresh_token?: string; id_token?: string; expires_in?: number }>,
): Promise<SessionUpdate> {
  if (now >= s.refreshAt) {
    if (!s.refreshToken) return { kind: 'end', reason: 'NO_REFRESH_TOKEN' };
    try {
      const t = await refresh(s.refreshToken);
      return {
        kind: 'update',
        session: {
          ...s,
          refreshToken: t.refresh_token ?? s.refreshToken,
          idToken: t.id_token ?? s.idToken,
          refreshAt: now + Math.max(60, (t.expires_in ?? 600) - 60),
          lastSeen: now,
        },
      };
    } catch {
      return { kind: 'end', reason: 'REFRESH_FAILED' };
    }
  }
  if (now - s.lastSeen >= TOUCH_SECONDS)
    return { kind: 'update', session: { ...s, lastSeen: now } };
  return { kind: 'keep' };
}

/** The production refresh call (refresh token rotation is enforced by the realm). */
export async function keycloakRefresh(refreshToken: string) {
  return client.refreshTokenGrant(await oidcConfig(), refreshToken);
}

export { nowSeconds };
