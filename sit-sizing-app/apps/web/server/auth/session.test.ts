import { describe, expect, it } from 'vitest';
import { clearCookie, parseCookies, serializeCookie } from './cookies';
import { roleFromGroups, profileFromClaims } from './provision';
import { rewriteToInternal } from './oidc';
import {
  ABSOLUTE_SECONDS,
  cookieNames,
  IDLE_SECONDS,
  openSession,
  openSignInTx,
  safeNext,
  sealSession,
  sealSignInTx,
  type SessionData,
} from './session';

const SECRET = 'synthetic-session-secret-0123456789abcdef';
const now = 1_800_000_000;
const session: SessionData = {
  uid: 'u1',
  sub: 'dev-estimator',
  idToken: 'id',
  refreshToken: 'r',
  refreshAt: now + 540,
  lastSeen: now,
  expiresAt: now + ABSOLUTE_SECONDS,
};

describe('session cookie', () => {
  it('round-trips and is not readable without the secret', async () => {
    const token = await sealSession(session, SECRET);
    expect(token.split('.')).toHaveLength(5); // compact JWE
    expect(token).not.toContain('dev-estimator');
    expect(await openSession(token, SECRET, now)).toEqual(session);
    expect(await openSession(token, `${SECRET}-other`, now)).toBeNull();
  });

  it('rejects tampering, idle and absolute expiry', async () => {
    const token = await sealSession(session, SECRET);
    const parts = token.split('.');
    // Flip one character in the middle of the ciphertext (the last base64url characters can be padding bits).
    const c = parts[3]!;
    const mid = Math.floor(c.length / 2);
    parts[3] = c.slice(0, mid) + (c[mid] === 'A' ? 'B' : 'A') + c.slice(mid + 1);
    expect(await openSession(parts.join('.'), SECRET, now)).toBeNull();
    expect(await openSession(token, SECRET, now + IDLE_SECONDS)).toBeNull();
    const long = await sealSession({ ...session, lastSeen: now + ABSOLUTE_SECONDS - 10 }, SECRET);
    expect(await openSession(long, SECRET, now + ABSOLUTE_SECONDS)).toBeNull();
    expect(await openSession(undefined, SECRET, now)).toBeNull();
    expect(await openSession('garbage', SECRET, now)).toBeNull();
  });

  it('keeps the sign-in transaction separate from the session', async () => {
    const tx = await sealSignInTx(
      { state: 's', nonce: 'n', verifier: 'v', next: '/x' },
      SECRET,
      now,
    );
    expect(await openSignInTx(tx, SECRET)).toEqual({
      state: 's',
      nonce: 'n',
      verifier: 'v',
      next: '/x',
    });
    expect(await openSession(tx, SECRET, now)).toBeNull();
  });

  it('uses __Host- cookies on https', () => {
    expect(cookieNames('https://sit.example.invalid')).toEqual({
      secure: true,
      session: '__Host-sit.session',
      signIn: '__Host-sit.signin',
    });
    expect(cookieNames('http://localhost:3000').session).toBe('sit.session');
  });
});

describe('safeNext (open-redirect guard)', () => {
  it.each([
    ['/projects/1', '/projects/1'],
    [null, '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['/api/auth/signout', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe('cookies', () => {
  it('parses and serialises', () => {
    expect(parseCookies('a=1; b=two%20words; a=ignored')).toEqual({ a: '1', b: 'two words' });
    expect(serializeCookie('n', 'v', { secure: true, maxAge: 60 })).toBe(
      'n=v; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=60',
    );
    expect(clearCookie('n')).toContain('Max-Age=0');
  });
});

describe('provisioning helpers', () => {
  it('maps the admin group to ADMIN, everything else to USER', () => {
    expect(roleFromGroups(['sit-sizing-admins'])).toBe('ADMIN');
    expect(roleFromGroups(['/sit-sizing-admins'])).toBe('ADMIN');
    expect(roleFromGroups(['other'])).toBe('USER');
    expect(roleFromGroups(undefined)).toBe('USER');
  });

  it('takes identity fields from claims with safe fallbacks', () => {
    expect(
      profileFromClaims({
        sub: 's1',
        email: 'A@Example.Invalid',
        name: 'Synthetic A',
        locale: 'vi',
        groups: [],
      }),
    ).toEqual({
      email: 'a@example.invalid',
      displayName: 'Synthetic A',
      locale: 'vi',
      globalRole: 'USER',
    });
    expect(profileFromClaims({ sub: 's2', preferred_username: 'user2' })).toMatchObject({
      email: 's2@users.invalid',
      displayName: 'user2',
      locale: 'en',
    });
  });
});

describe('rewriteToInternal', () => {
  it('sends server-side calls for the public issuer origin to the internal origin', () => {
    const issuer = 'http://localhost:8080/realms/qe-tools';
    expect(
      rewriteToInternal(
        'http://localhost:8080/realms/qe-tools/protocol/openid-connect/token',
        issuer,
        'http://keycloak:8080',
      ),
    ).toBe('http://keycloak:8080/realms/qe-tools/protocol/openid-connect/token');
    expect(rewriteToInternal('https://other.example/x', issuer, 'http://keycloak:8080')).toBe(
      'https://other.example/x',
    );
    expect(rewriteToInternal('http://localhost:8080/x', issuer, undefined)).toBe(
      'http://localhost:8080/x',
    );
  });
});
