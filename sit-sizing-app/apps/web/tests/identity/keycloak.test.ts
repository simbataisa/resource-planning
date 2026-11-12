import { createWriteStream, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureContainerRuntime } from '../support/container-runtime';

/**
 * Realm baseline on a running Keycloak (design 10.4, K-02): the realm and dev users import
 * cleanly, the settings survive the import, disallowed flows are really refused, and the
 * password policy is enforced. Runs with `pnpm test:idp`.
 */
configureContainerRuntime();
const { GenericContainer, Wait } = await import('testcontainers');
type Started = Awaited<ReturnType<InstanceType<typeof GenericContainer>['start']>>;

const KC_IMAGE = `${process.env.REGISTRY_PREFIX ?? ''}keycloak/keycloak:26.8.0`;
const docker = (p: string) =>
  fileURLToPath(new URL(`../../../../docker/keycloak/${p}`, import.meta.url));
const ADMIN_PASSWORD = 'synthetic-test-admin-only';
const CLIENT_SECRET = 'synthetic-test-client-secret';

let kc: Started;
let base: string;
let adminToken: string;

async function json(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, init);
  return {
    status: res.status,
    body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text(),
  };
}
const asAdmin = (init: RequestInit = {}) => ({
  ...init,
  headers: { ...(init.headers ?? {}), authorization: `Bearer ${adminToken}` },
});

const reportsDir = fileURLToPath(new URL('../../../../reports/', import.meta.url));
mkdirSync(reportsDir, { recursive: true });

beforeAll(async () => {
  const kcLog = createWriteStream(`${reportsDir}keycloak-test.log`);
  kc = await new GenericContainer(KC_IMAGE)
    .withLogConsumer((stream) => stream.pipe(kcLog))
    .withCommand(['start-dev', '--import-realm'])
    .withEnvironment({
      KC_BOOTSTRAP_ADMIN_USERNAME: 'admin',
      KC_BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD,
      KC_HEALTH_ENABLED: 'true',
      SIT_WEB_BASE_URL: 'http://localhost:3000',
      SIT_WEB_BACKCHANNEL_URL: 'http://web:3000/api/auth/backchannel-logout',
      SIT_WEB_CLIENT_SECRET: CLIENT_SECRET,
      KC_DEV_USER_PASSWORD: 'synthetic-Dev-user-pass-01',
    })
    // Explicit modes: Keycloak runs as uid 1000 and cannot read files copied with the host's 0600.
    .withCopyFilesToContainer([
      {
        source: docker('realm/qe-tools-realm.json'),
        target: '/opt/keycloak/data/import/qe-tools-realm.json',
        mode: 0o644,
      },
      {
        source: docker('dev/qe-tools-users-0.json'),
        target: '/opt/keycloak/data/import/qe-tools-users-0.json',
        mode: 0o644,
      },
      {
        source: docker('password-blacklists/common-passwords.txt'),
        target: '/opt/keycloak/data/password-blacklists/common-passwords.txt',
        mode: 0o644,
      },
    ])
    .withCopyDirectoriesToContainer([
      { source: docker('themes/tcb'), target: '/opt/keycloak/themes/tcb', mode: 0o755 },
    ])
    .withExposedPorts(8080, 9000)
    .withWaitStrategy(Wait.forHttp('/health/ready', 9000).forStatusCode(200))
    .withStartupTimeout(240_000)
    .start();
  base = `http://${kc.getHost()}:${kc.getMappedPort(8080)}`;
  const tok = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: 'admin',
      password: ADMIN_PASSWORD,
    }),
  });
  adminToken = ((await tok.json()) as { access_token: string }).access_token;
});

afterAll(async () => {
  await kc?.stop();
});

describe('Keycloak realm qe-tools', () => {
  it('serves discovery with PKCE S256 and no implicit flow', async () => {
    const { status, body } = await json('/realms/qe-tools/.well-known/openid-configuration');
    expect(status).toBe(200);
    expect(body.issuer).toBe(`${base}/realms/qe-tools`);
    expect(body.code_challenge_methods_supported).toContain('S256');
    expect(body.end_session_endpoint).toBeTruthy();
  });

  it('keeps the baseline settings after import', async () => {
    const { body: r } = await json('/admin/realms/qe-tools', asAdmin());
    expect(r.passwordPolicy).toContain('length(12)');
    expect(r.bruteForceProtected).toBe(true);
    expect(r.ssoSessionIdleTimeout).toBe(28800);
    expect(r.accessTokenLifespan).toBe(600);
    expect(r.revokeRefreshToken).toBe(true);
    expect(r.registrationAllowed).toBe(false);
    expect(r.loginTheme).toBe('tcb');
  });

  it('client flags and secret placeholder resolved', async () => {
    const { body } = await json(
      '/admin/realms/qe-tools/clients?clientId=sit-sizing-web',
      asAdmin(),
    );
    const c = body[0];
    expect(c.publicClient).toBe(false);
    expect(c.implicitFlowEnabled).toBe(false);
    expect(c.directAccessGrantsEnabled).toBe(false);
    expect(c.redirectUris).toEqual(['http://localhost:3000/api/auth/callback']);
    const secret = await json(`/admin/realms/qe-tools/clients/${c.id}/client-secret`, asAdmin());
    expect(secret.body.value).toBe(CLIENT_SECRET);
  });

  it('assigns the profile and email scopes to the client', async () => {
    const { body } = await json(
      '/admin/realms/qe-tools/clients?clientId=sit-sizing-web',
      asAdmin(),
    );
    const scopes = await json(
      `/admin/realms/qe-tools/clients/${body[0].id}/default-client-scopes`,
      asAdmin(),
    );
    expect(scopes.body.map((s: { name: string }) => s.name)).toEqual(
      expect.arrayContaining(['basic', 'profile', 'email']),
    );
  });

  it('refuses the password grant (direct access grants are disabled)', async () => {
    const res = await fetch(`${base}/realms/qe-tools/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'sit-sizing-web',
        client_secret: CLIENT_SECRET,
        username: 'dev-estimator',
        password: 'synthetic-Dev-user-pass-01',
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(((await res.json()) as { error: string }).error).toBe('unauthorized_client');
  });

  it('imports the dev users with their fixed ids and the admin group', async () => {
    const { status, body } = await json('/admin/realms/qe-tools/users/dev-estimator', asAdmin());
    expect(status).toBe(200);
    expect(body.email).toBe('estimator@example.invalid');
    const groups = await json('/admin/realms/qe-tools/users/dev-admin/groups', asAdmin());
    expect(groups.body.map((g: { name: string }) => g.name)).toContain('sit-sizing-admins');
  });

  it('enforces the password policy', async () => {
    const set = (value: string) =>
      fetch(
        `${base}/admin/realms/qe-tools/users/dev-viewer/reset-password`,
        asAdmin({
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'password', value, temporary: false }),
        }),
      );
    expect((await set('Short1!')).status).toBe(400);
    expect((await set('password123456')).status).toBe(400); // blacklisted
    expect((await set('synthetic-Ok-Passphrase-42')).status).toBe(204);
  });
});
