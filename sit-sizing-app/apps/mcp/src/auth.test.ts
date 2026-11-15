import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parseEnv } from './env';
import {
  bearerFromHeader,
  challengeHeader,
  protectedResourceMetadata,
  verifyAccessToken,
} from './auth';

const ISSUER = 'http://localhost:8080/realms/qe-tools';
const AUDIENCE = 'sit-sizing-api';
const env = parseEnv({
  SIT_API_BASE_URL: 'http://web:3000',
  OIDC_ISSUER: ISSUER,
  MCP_PUBLIC_URL: 'http://localhost:3100',
});

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
  opts: { key?: Keys; iat?: number; exp?: number } = {},
) {
  return new SignJWT({ sid: 'kc-session-synthetic', azp: 'synthetic-client', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject('dev-estimator')
    .setIssuer((claims.iss as string | undefined) ?? ISSUER)
    .setAudience((claims.aud as string | string[] | undefined) ?? [AUDIENCE, 'account'])
    .setIssuedAt(opts.iat ?? nowSec - 60)
    .setExpirationTime(opts.exp ?? nowSec + 540)
    .sign((opts.key ?? good).privateKey);
}

const verify = (t: string) => verifyAccessToken(t, env, { keys, now: NOW });

describe('verifyAccessToken (ADR-0016)', () => {
  it('accepts a token with the right issuer, audience and expiry', async () => {
    expect(await verify(await token())).toEqual({ sub: 'dev-estimator' });
    expect(await verify(await token({ aud: AUDIENCE, typ: 'Bearer' }))).toEqual({
      sub: 'dev-estimator',
    });
  });

  it('refuses a wrong audience', async () => {
    expect(await verify(await token({ aud: 'account' }))).toBeNull();
  });

  it('refuses a wrong issuer', async () => {
    expect(await verify(await token({ iss: 'http://localhost:8080/realms/other' }))).toBeNull();
  });

  it('refuses an expired token', async () => {
    expect(await verify(await token({}, { iat: nowSec - 1200, exp: nowSec - 600 }))).toBeNull();
  });

  it('refuses a token signed by another key', async () => {
    expect(await verify(await token({}, { key: other }))).toBeNull();
  });

  it('refuses alg none and a malformed token', async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${enc({ alg: 'none' })}.${enc({ sub: 'dev-estimator', iss: ISSUER, aud: AUDIENCE, exp: nowSec + 60, sid: 's' })}.`;
    expect(await verify(none)).toBeNull();
    expect(await verify('not-a-jwt')).toBeNull();
    expect(await verify('')).toBeNull();
  });

  it('refuses a token without sid or sub, and non-access tokens', async () => {
    expect(await verify(await token({ sid: undefined }))).toBeNull();
    expect(await verify(await token({ sid: '' }))).toBeNull();
    for (const typ of ['ID', 'Refresh', 'Logout']) {
      expect(await verify(await token({ typ })), typ).toBeNull();
    }
    const noSub = await new SignJWT({ sid: 's' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(nowSec + 60)
      .sign(good.privateKey);
    expect(await verify(noSub)).toBeNull();
  });

  it('logs only an error code when the key set is unavailable', async () => {
    const log = { warn: vi.fn() };
    const broken = () =>
      Promise.reject(Object.assign(new Error('boom'), { code: 'ERR_JWKS_TIMEOUT' }));
    const t = await token();
    expect(await verifyAccessToken(t, env, { keys: broken, now: NOW, log })).toBeNull();
    expect(log.warn).toHaveBeenCalledWith(
      { code: 'ERR_JWKS_TIMEOUT' },
      'bearer key set unavailable',
    );
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain(t);
  });

  it('builds the remote key set from the internal URL without fetching it yet', async () => {
    const internal = parseEnv({
      SIT_API_BASE_URL: 'http://web:3000',
      OIDC_ISSUER: ISSUER,
      OIDC_INTERNAL_URL: 'http://keycloak:8080',
      MCP_PUBLIC_URL: 'http://localhost:3100',
    });
    // An unreachable key set refuses the token rather than throwing.
    const log = { warn: vi.fn() };
    expect(await verifyAccessToken('a.b.c', internal, { log })).toBeNull();
  });
});

describe('protected resource metadata (RFC 9728)', () => {
  it('metadata names the issuer and the public URL', () => {
    expect(protectedResourceMetadata(env)).toEqual({
      resource: 'http://localhost:3100',
      authorization_servers: [ISSUER],
      bearer_methods_supported: ['header'],
    });
  });

  it('builds the WWW-Authenticate challenge and reads the bearer header', () => {
    expect(challengeHeader(env)).toBe(
      'Bearer resource_metadata="http://localhost:3100/.well-known/oauth-protected-resource"',
    );
    expect(challengeHeader(env, 'invalid_token')).toBe(
      'Bearer error="invalid_token", resource_metadata="http://localhost:3100/.well-known/oauth-protected-resource"',
    );
    expect(bearerFromHeader('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerFromHeader('bearer   abc')).toBe('abc');
    expect(bearerFromHeader('Basic abc')).toBeNull();
    expect(bearerFromHeader(undefined)).toBeNull();
    expect(bearerFromHeader('Bearer ')).toBeNull();
  });
});
