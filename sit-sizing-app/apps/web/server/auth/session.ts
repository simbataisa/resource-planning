import { EncryptJWT, jwtDecrypt } from 'jose';
import { z } from 'zod';

/**
 * The app session (design 10.3, 10.4; ADR-0004): an encrypted, HttpOnly cookie
 * (JWE dir + A256GCM) holding the user id and the tokens needed for refresh and
 * sign-out. Idle limit 8 h, absolute limit 12 h, matching the Keycloak SSO session.
 * No server-side session store. Revocation: back-channel logout marks the Keycloak session
 * id as revoked (checked on every request); the refresh check (every access-token lifetime,
 * 10 minutes) also ends sessions Keycloak no longer knows.
 */
export const IDLE_SECONDS = 8 * 60 * 60;
export const ABSOLUTE_SECONDS = 12 * 60 * 60;
/** Write the cookie back at most this often just to move the idle clock. */
export const TOUCH_SECONDS = 5 * 60;

const SessionData = z.object({
  /** app User.id */
  uid: z.string().min(1),
  /** OIDC subject (Keycloak user id) */
  sub: z.string().min(1),
  /** Keycloak session id (ID token `sid`), for back-channel logout. */
  sid: z.string().min(1).optional(),
  idToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  /** Unix seconds when the next refresh check is due. */
  refreshAt: z.number().int(),
  /** Unix seconds: last activity (idle limit). */
  lastSeen: z.number().int(),
  /** Unix seconds: hard end of the session (absolute limit). */
  expiresAt: z.number().int(),
});
export type SessionData = z.infer<typeof SessionData>;

/** Short-lived transaction cookie between sign-in redirect and callback. */
const SignInTx = z.object({
  state: z.string(),
  nonce: z.string(),
  verifier: z.string(),
  next: z.string(),
});
export type SignInTx = z.infer<typeof SignInTx>;

const keys = new Map<string, Uint8Array>();
async function keyFor(secret: string, purpose: string): Promise<Uint8Array> {
  const id = `${purpose}:${secret}`;
  let k = keys.get(id);
  if (!k) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`sit-sizing/${purpose}/${secret}`),
    );
    k = new Uint8Array(digest);
    keys.set(id, k);
  }
  return k;
}

async function seal(
  payload: Record<string, unknown>,
  secret: string,
  purpose: string,
  expiresAt: number,
) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .encrypt(await keyFor(secret, purpose));
}

async function open(token: string, secret: string, purpose: string): Promise<unknown> {
  try {
    const { payload } = await jwtDecrypt(token, await keyFor(secret, purpose), {
      clockTolerance: 5,
    });
    return payload;
  } catch {
    return null;
  }
}

export const nowSeconds = (d: Date = new Date()) => Math.floor(d.getTime() / 1000);

export function sealSession(data: SessionData, secret: string): Promise<string> {
  return seal(data, secret, 'session', data.expiresAt);
}

/** Decrypts and checks the limits. Returns null for anything invalid, tampered or expired. */
export async function openSession(
  token: string | undefined,
  secret: string,
  now: number,
): Promise<SessionData | null> {
  if (!token) return null;
  const parsed = SessionData.safeParse(await open(token, secret, 'session'));
  if (!parsed.success) return null;
  const s = parsed.data;
  if (now >= s.expiresAt || now - s.lastSeen >= IDLE_SECONDS) return null;
  return s;
}

export function sealSignInTx(tx: SignInTx, secret: string, now: number): Promise<string> {
  return seal(tx, secret, 'signin', now + 10 * 60);
}

export async function openSignInTx(
  token: string | undefined,
  secret: string,
): Promise<SignInTx | null> {
  if (!token) return null;
  const parsed = SignInTx.safeParse(await open(token, secret, 'signin'));
  return parsed.success ? parsed.data : null;
}

/** Cookie names: `__Host-` prefix (Secure, host-only, Path=/) whenever the app runs on https. */
export function cookieNames(appBaseUrl: string) {
  const secure = appBaseUrl.startsWith('https://');
  return {
    secure,
    session: secure ? '__Host-sit.session' : 'sit.session',
    signIn: secure ? '__Host-sit.signin' : 'sit.signin',
  };
}

/** Only same-site relative paths, never back into the auth routes (open-redirect guard). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (next.startsWith('/api/auth')) return '/';
  return next;
}
