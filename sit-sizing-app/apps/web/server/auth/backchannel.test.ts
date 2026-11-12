import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { LogoutTokenError, verifyLogoutToken } from './backchannel';

const ISSUER = 'http://localhost:18080/realms/qe-tools';
const AUD = 'sit-sizing-web';
const EVENT = { 'http://schemas.openid.net/event/backchannel-logout': {} };

let sign: (claims: Record<string, unknown>, key?: CryptoKey) => Promise<string>;
let getKey: ReturnType<typeof createLocalJWKSet>;
let otherKey: CryptoKey;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  otherKey = (await generateKeyPair('RS256')).privateKey;
  getKey = createLocalJWKSet({
    keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }],
  });
  sign = (claims, key = privateKey) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1', typ: 'logout+jwt' })
      .setIssuer(ISSUER)
      .setAudience(AUD)
      .setIssuedAt()
      .setJti(crypto.randomUUID())
      .sign(key);
});

const verify = (token: string) =>
  verifyLogoutToken(token, { getKey, issuer: ISSUER, audience: AUD });

describe('back-channel logout token (OIDC BCL 1.0, 2.6)', () => {
  it('accepts a signed token with the logout event and a session id', async () => {
    await expect(
      verify(await sign({ sub: 'kc-user', sid: 'kc-session-1', events: EVENT })),
    ).resolves.toEqual({
      sid: 'kc-session-1',
      sub: 'kc-user',
    });
  });

  it.each([
    ['without the logout event', { sid: 's', events: { other: {} } }],
    ['with a nonce', { sid: 's', events: EVENT, nonce: 'n' }],
    ['without a session id', { sub: 'u', events: EVENT }],
  ])('rejects a token %s', async (_name, claims) => {
    await expect(verify(await sign(claims))).rejects.toBeInstanceOf(LogoutTokenError);
  });

  it('rejects a token signed by another key, for another client, or too old', async () => {
    await expect(verify(await sign({ sid: 's', events: EVENT }, otherKey))).rejects.toBeInstanceOf(
      LogoutTokenError,
    );
    await expect(
      verifyLogoutToken(await sign({ sid: 's', events: EVENT }), {
        getKey,
        issuer: ISSUER,
        audience: 'other',
      }),
    ).rejects.toBeInstanceOf(LogoutTokenError);
    await expect(
      verifyLogoutToken(await sign({ sid: 's', events: EVENT }), {
        getKey,
        issuer: ISSUER,
        audience: AUD,
        currentDate: new Date(Date.now() + 10 * 60_000),
      }),
    ).rejects.toBeInstanceOf(LogoutTokenError);
  });
});
