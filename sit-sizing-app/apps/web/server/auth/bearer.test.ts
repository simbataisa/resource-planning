import {
  createLocalJWKSet,
  createRemoteJWKSet,
  customFetch,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
} from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const ISSUER = 'http://localhost:8080/realms/qe-tools';
const AUDIENCE = 'sit-sizing-api';

const warn = vi.hoisted(() => vi.fn());
vi.mock('../logger', () => ({ logger: { warn } }));

vi.mock('../env', () => ({
  getEnv: () => ({
    AUTH_MODE: 'oidc',
    OIDC_ISSUER: 'http://localhost:8080/realms/qe-tools',
    OIDC_API_AUDIENCE: 'sit-sizing-api',
  }),
}));

const { KeySetUnavailable, verifyAccessToken } = await import('./bearer');
const { bearerToken } = await import('./bearer-header');

type Keys = Awaited<ReturnType<typeof generateKeyPair>>;
let good: Keys;
let other: Keys;
let keys: ReturnType<typeof createLocalJWKSet>;
const NOW = new Date('2026-11-15T10:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);

beforeAll(async () => {
  good = await generateKeyPair('RS256');
  other = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(good.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  keys = createLocalJWKSet({ keys: [jwk] });
});

function token(
  claims: Record<string, unknown> = {},
  opts: { key?: Keys; kid?: string; iat?: number; exp?: number } = {},
) {
  return new SignJWT({ sid: 'kc-session-synthetic', azp: 'synthetic-client', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: opts.kid ?? 'k1' })
    .setSubject('dev-estimator')
    .setIssuer((claims.iss as string | undefined) ?? ISSUER)
    .setAudience((claims.aud as string | string[] | undefined) ?? [AUDIENCE, 'account'])
    .setIssuedAt(opts.iat ?? nowSec - 60)
    .setExpirationTime(opts.exp ?? nowSec + 540)
    .sign((opts.key ?? good).privateKey);
}

describe('verifyAccessToken (ADR-0016)', () => {
  it('accepts a token with the right issuer, audience and expiry', async () => {
    expect(await verifyAccessToken(await token(), { keys, now: NOW })).toEqual({
      sub: 'dev-estimator',
      sid: 'kc-session-synthetic',
      azp: 'synthetic-client',
    });
    // aud as a plain string is fine too
    expect(await verifyAccessToken(await token({ aud: AUDIENCE }), { keys, now: NOW })).toEqual(
      expect.objectContaining({ sub: 'dev-estimator' }),
    );
  });

  it('refuses a wrong audience', async () => {
    expect(await verifyAccessToken(await token({ aud: 'account' }), { keys, now: NOW })).toBeNull();
  });

  it('refuses a Keycloak token that is not an access token', async () => {
    for (const typ of ['ID', 'Refresh', 'Logout']) {
      expect(await verifyAccessToken(await token({ typ }), { keys, now: NOW }), typ).toBeNull();
    }
    expect(
      await verifyAccessToken(await token({ typ: 'Bearer' }), { keys, now: NOW }),
    ).not.toBeNull();
  });

  it('refuses a wrong issuer', async () => {
    const t = await token({ iss: 'http://localhost:8080/realms/other' });
    expect(await verifyAccessToken(t, { keys, now: NOW })).toBeNull();
  });

  it('refuses an expired token', async () => {
    const t = await token({}, { iat: nowSec - 1200, exp: nowSec - 600 });
    expect(await verifyAccessToken(t, { keys, now: NOW })).toBeNull();
  });

  it('refuses a token signed by another key', async () => {
    expect(await verifyAccessToken(await token({}, { key: other }), { keys, now: NOW })).toBeNull();
  });

  it('refuses alg none and a malformed token', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      sub: 'dev-estimator',
      iss: ISSUER,
      aud: AUDIENCE,
      azp: 'x',
      exp: nowSec + 500,
    })}.`;
    expect(await verifyAccessToken(none, { keys, now: NOW })).toBeNull();
    expect(await verifyAccessToken('not-a-jwt', { keys, now: NOW })).toBeNull();
    expect(await verifyAccessToken('', { keys, now: NOW })).toBeNull();
    // a valid signature but no subject or azp is not a usable identity
    const noSub = await new SignJWT({ azp: 'x' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(nowSec + 500)
      .sign(good.privateKey);
    expect(await verifyAccessToken(noSub, { keys, now: NOW })).toBeNull();
  });

  it('refuses an HS256 token, even when the key set holds a matching secret', async () => {
    const secret = new TextEncoder().encode('synthetic-hmac-secret-for-tests-0000000000');
    const hs = await new SignJWT({ sid: 's', azp: 'x' })
      .setProtectedHeader({ alg: 'HS256', kid: 'h1' })
      .setSubject('dev-estimator')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(nowSec + 500)
      .sign(secret);
    const withSecret = createLocalJWKSet({
      keys: [{ kty: 'oct', k: Buffer.from(secret).toString('base64url'), kid: 'h1', alg: 'HS256' }],
    });
    expect(await verifyAccessToken(hs, { keys: withSecret, now: NOW })).toBeNull();
    expect(await verifyAccessToken(hs, { keys, now: NOW })).toBeNull();
  });

  it('refuses a token without sid (revocation could not be checked)', async () => {
    expect(await verifyAccessToken(await token({ sid: undefined }), { keys, now: NOW })).toBeNull();
    expect(await verifyAccessToken(await token({ sid: '' }), { keys, now: NOW })).toBeNull();
  });

  it("refuses tokens minted by Keycloak's built-in clients and the web client", async () => {
    for (const azp of [
      'admin-cli',
      'account',
      'account-console',
      'security-admin-console',
      'broker',
      'realm-management',
      'sit-sizing-web',
    ]) {
      expect(await verifyAccessToken(await token({ azp }), { keys, now: NOW }), azp).toBeNull();
    }
    expect(
      await verifyAccessToken(await token({ azp: 'sit-sizing-mcp' }), { keys, now: NOW }),
    ).not.toBeNull();
  });
});

describe('verifyAccessToken when the key set is unavailable', () => {
  /** A remote key set whose fetch fails as given. */
  const remote = (f: () => Promise<Response>) =>
    createRemoteJWKSet(new URL('http://keycloak.invalid/certs'), { [customFetch]: f });

  it('throws KeySetUnavailable and logs only an error code', async () => {
    const t = await token();
    const cases: Array<[() => Promise<Response>, string]> = [
      [() => Promise.reject(new TypeError('fetch failed')), 'JWKS_FETCH_FAILED'],
      [async () => new Response('down', { status: 503 }), 'ERR_JOSE_GENERIC'],
      [async () => Response.json({ nope: true }), 'ERR_JWKS_INVALID'],
    ];
    for (const [f, code] of cases) {
      warn.mockClear();
      await expect(verifyAccessToken(t, { keys: remote(f), now: NOW })).rejects.toThrow(
        KeySetUnavailable,
      );
      expect(warn).toHaveBeenCalledWith({ code }, 'bearer key set unavailable');
      expect(JSON.stringify(warn.mock.calls)).not.toContain(t);
    }
  });

  it('still refuses a malformed token or one with an unknown key id (null)', async () => {
    const down = () => Promise.reject(new TypeError('fetch failed'));
    expect(await verifyAccessToken('not-a-jwt', { keys: down, now: NOW })).toBeNull();
    expect(await verifyAccessToken(await token({}, { kid: 'k9' }), { keys, now: NOW })).toBeNull();
  });
});

describe('bearerToken', () => {
  it('reads the token of an Authorization: Bearer header only', () => {
    expect(bearerToken('Bearer abc.def')).toBe('abc.def');
    expect(bearerToken('bearer   abc')).toBe('abc');
    expect(bearerToken('Bearer')).toBe('');
    expect(bearerToken('Bearer ')).toBe('');
    expect(bearerToken('Basic dXNlcg==')).toBeUndefined();
    expect(bearerToken('Bearerabc')).toBeUndefined();
    expect(bearerToken(null)).toBeUndefined();
    expect(bearerToken('')).toBeUndefined();
  });
});
