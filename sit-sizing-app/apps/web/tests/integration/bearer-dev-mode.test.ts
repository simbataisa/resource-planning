import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as me from '@/app/api/v1/me/route';
import { setKeysForTests } from '@/server/auth/bearer';
import { DEV_USER_HEADER } from '@/server/auth/current-user';

/**
 * AUTH_MODE=dev (the integration default): bearer tokens are not accepted at all, and a
 * bearer header still switches off the dev header (ADR-0016). Synthetic data only.
 */
let token: string;

beforeAll(async () => {
  const key = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(key.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  setKeysForTests(createLocalJWKSet({ keys: [jwk] }));
  token = await new SignJWT({ sid: 'kc-session-synthetic-dev', azp: 'sit-sizing-mcp' })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject('dev-estimator')
    .setIssuer('http://localhost:8080/realms/qe-tools')
    .setAudience('sit-sizing-api')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key.privateKey);
});

afterAll(() => setKeysForTests(undefined));

const get = (headers: Record<string, string>) =>
  me.GET(new Request('http://localhost:3000/api/v1/me', { headers }), {
    params: Promise.resolve({}),
  });

describe('bearer tokens with AUTH_MODE=dev', () => {
  it('answers 401 to a signed bearer token plus x-dev-user', async () => {
    expect((await get({ [DEV_USER_HEADER]: 'dev-estimator' })).status).toBe(200);
    const res = await get({ authorization: `Bearer ${token}`, [DEV_USER_HEADER]: 'dev-estimator' });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer error="invalid_token"');
  });
});
