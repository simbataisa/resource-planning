import { jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * OpenID Connect Back-Channel Logout 1.0, section 2.6: validation of the logout token that
 * Keycloak posts when a session ends (sign-out elsewhere, admin action, session expiry).
 */
const LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

export class LogoutTokenError extends Error {}

export async function verifyLogoutToken(
  token: string,
  opts: { getKey: JWTVerifyGetKey; issuer: string; audience: string; currentDate?: Date },
): Promise<{ sid: string; sub?: string }> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, opts.getKey, {
      issuer: opts.issuer,
      audience: opts.audience,
      maxTokenAge: '5m',
      clockTolerance: 30,
      ...(opts.currentDate ? { currentDate: opts.currentDate } : {}),
    }));
  } catch (err) {
    throw new LogoutTokenError(`invalid logout token: ${(err as Error).name}`);
  }
  const events = payload.events as Record<string, unknown> | undefined;
  if (!events || typeof events !== 'object' || !(LOGOUT_EVENT in events))
    throw new LogoutTokenError('not a back-channel logout token');
  if ('nonce' in payload) throw new LogoutTokenError('logout tokens must not carry a nonce');
  // The realm requires the session id (backchannel.logout.session.required).
  if (typeof payload.sid !== 'string' || payload.sid === '')
    throw new LogoutTokenError('the logout token has no session id');
  return { sid: payload.sid, ...(typeof payload.sub === 'string' ? { sub: payload.sub } : {}) };
}
