import { createHash, randomBytes } from 'node:crypto';
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
const DEV_USER_PASSWORD = 'synthetic-Dev-user-pass-01';

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
      KC_DEV_USER_PASSWORD: DEV_USER_PASSWORD,
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

  describe('MCP clients (ADR-0016)', () => {
    const LOOPBACK = 'http://127.0.0.1:53682/callback';
    const register = (body: Record<string, unknown>) =>
      json('/realms/qe-tools/clients-registrations/openid-connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_name: 'synthetic-test-assistant',
          redirect_uris: [LOOPBACK],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          ...body,
        }),
      });
    const claims = (jwt: string) =>
      JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;

    /** Browser sign-in with PKCE, consent included, without following the final redirect. */
    async function signIn(clientId: string, scope: string) {
      const verifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const jar = new Map<string, string>();
      const send = async (url: string, init: RequestInit = {}) => {
        const res = await fetch(url, {
          ...init,
          redirect: 'manual',
          headers: {
            ...(init.headers ?? {}),
            cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
          },
        });
        for (const c of res.headers.getSetCookie()) {
          const [pair] = c.split(';');
          const i = pair!.indexOf('=');
          jar.set(pair!.slice(0, i), pair!.slice(i + 1));
        }
        return res;
      };
      const formOf = (html: string) => {
        const action = /<form[^>]*action="([^"]+)"/.exec(html)?.[1]?.replaceAll('&amp;', '&');
        const hidden = [...html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)].map((m) => [
          /name="([^"]+)"/.exec(m[0])?.[1] ?? '',
          /value="([^"]*)"/.exec(m[0])?.[1] ?? '',
        ]);
        if (!action) throw new Error('no form on the page');
        return { action, hidden: Object.fromEntries(hidden) as Record<string, string> };
      };
      const auth = new URL(`${base}/realms/qe-tools/protocol/openid-connect/auth`);
      for (const [k, v] of Object.entries({
        client_id: clientId,
        redirect_uri: LOOPBACK,
        response_type: 'code',
        scope,
        state: 'synthetic-state',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }))
        auth.searchParams.set(k, v);
      const login = formOf(await (await send(auth.toString())).text());
      let res = await send(login.action, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: 'dev-lead', password: DEV_USER_PASSWORD }),
      });
      if (res.status === 200) {
        // Self-registered clients require consent (anonymous policy "Consent Required").
        const consent = formOf(await res.text());
        res = await send(consent.action, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ ...consent.hidden, accept: 'Yes' }),
        });
      }
      const location = res.headers.get('location') ?? '';
      expect(location.startsWith(LOOPBACK)).toBe(true);
      const code = new URL(location).searchParams.get('code');
      expect(code).toBeTruthy();
      const tok = await fetch(`${base}/realms/qe-tools/protocol/openid-connect/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          code: code!,
          redirect_uri: LOOPBACK,
          code_verifier: verifier,
        }),
      });
      expect(tok.status).toBe(200);
      return (await tok.json()) as { access_token: string; refresh_token: string; scope: string };
    }

    it('pre-registers a public client with code flow and PKCE S256 only', async () => {
      const { body } = await json(
        '/admin/realms/qe-tools/clients?clientId=sit-sizing-mcp',
        asAdmin(),
      );
      const c = body[0];
      expect(c.publicClient).toBe(true);
      expect(c.standardFlowEnabled).toBe(true);
      expect(c.implicitFlowEnabled).toBe(false);
      expect(c.directAccessGrantsEnabled).toBe(false);
      expect(c.serviceAccountsEnabled).toBe(false);
      expect(c.attributes['pkce.code.challenge.method']).toBe('S256');
      expect(c.redirectUris.sort()).toEqual(['http://127.0.0.1/*', 'http://localhost/*']);
    });

    it('does not advertise offline_access', async () => {
      const { body } = await json('/realms/qe-tools/.well-known/openid-configuration');
      expect(body.scopes_supported).toEqual(expect.arrayContaining(['openid', 'profile', 'email']));
      expect(body.scopes_supported).not.toContain('offline_access');
      const defaults = await json(
        '/admin/realms/qe-tools/default-default-client-scopes',
        asAdmin(),
      );
      const optional = await json(
        '/admin/realms/qe-tools/default-optional-client-scopes',
        asAdmin(),
      );
      const names = [...defaults.body, ...optional.body].map((s: { name: string }) => s.name);
      expect(names).toContain('sit-sizing-api');
      expect(names).not.toContain('offline_access');
      const role = await json(
        '/admin/realms/qe-tools/roles/default-roles-qe-tools/composites',
        asAdmin(),
      );
      expect(role.body.map((r: { name: string }) => r.name)).not.toContain('offline_access');
    });

    it('lets a loopback client register itself with openid profile email only', async () => {
      expect((await register({ scope: 'openid profile email' })).status).toBe(201);
      const offline = await register({ scope: 'openid profile email offline_access' });
      expect(offline.status).toBeGreaterThanOrEqual(400);
      expect(offline.status).toBeLessThan(500);
    });

    it('refuses registration with a non-loopback redirect URI or scope service_account', async () => {
      const remote = await register({
        scope: 'openid profile email',
        redirect_uris: ['https://attacker.example.invalid/callback'],
      });
      expect(remote.status).toBeGreaterThanOrEqual(400);
      expect(remote.status).toBeLessThan(500);
      const sa = await register({ scope: 'openid service_account' });
      expect(sa.status).toBeGreaterThanOrEqual(400);
      expect(sa.status).toBeLessThan(500);
    });

    it('gives a self-registered client the API audience and an ordinary refresh token that ends with the session', async () => {
      const reg = await register({ scope: 'openid profile email' });
      expect(reg.status).toBe(201);
      const tokens = await signIn(reg.body.client_id, 'openid profile email');
      const access = claims(tokens.access_token);
      expect([access.aud].flat()).toContain('sit-sizing-api');
      expect(access.sub).toBe('dev-lead');
      expect(typeof access.sid).toBe('string');
      expect(claims(tokens.refresh_token).typ).toBe('Refresh'); // not 'Offline'

      const { status } = await json(
        '/admin/realms/qe-tools/users/dev-lead/logout',
        asAdmin({ method: 'POST' }),
      );
      expect(status).toBe(204);
      const refresh = await fetch(`${base}/realms/qe-tools/protocol/openid-connect/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: reg.body.client_id,
          refresh_token: tokens.refresh_token,
        }),
      });
      expect(refresh.status).toBe(400);
      expect(((await refresh.json()) as { error: string }).error).toBe('invalid_grant');
    });

    it('gives the pre-registered client the API audience too', async () => {
      const tokens = await signIn('sit-sizing-mcp', 'openid profile email');
      expect([claims(tokens.access_token).aud].flat()).toContain('sit-sizing-api');
    });

    const native = (body: Record<string, unknown>) =>
      json('/realms/qe-tools/clients-registrations/default', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ redirectUris: [LOOPBACK], publicClient: true, ...body }),
      });
    const refused = (status: number) => {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    };

    it('refuses a self-registered client that brings a protocol mapper (forged sub)', async () => {
      const res = await native({
        clientId: 'synthetic-forger',
        protocolMappers: [
          {
            name: 'forged-sub',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-usermodel-property-mapper',
            config: {
              'user.attribute': 'firstName',
              'claim.name': 'sub',
              'access.token.claim': 'true',
              'jsonType.label': 'String',
            },
          },
        ],
      });
      refused(res.status);
    });

    it('gives a client that drops the basic scope no token the API accepts', async () => {
      const res = await native({
        clientId: 'synthetic-no-basic',
        defaultClientScopes: ['profile', 'email', 'sit-sizing-api'],
      });
      if (res.status === 201) {
        const tokens = await signIn('synthetic-no-basic', 'openid profile email');
        // The API requires sub (server/auth/bearer.ts); without basic there is none.
        expect(claims(tokens.access_token).sub).toBeUndefined();
      } else {
        refused(res.status);
      }
    });

    it('refuses self-registration with the password grant, client credentials or implicit flow', async () => {
      refused((await register({ grant_types: ['password'] })).status);
      refused(
        (
          await register({
            grant_types: ['client_credentials'],
            token_endpoint_auth_method: 'client_secret_basic',
          })
        ).status,
      );
      refused(
        (await register({ token_endpoint_auth_method: 'client_secret_basic', scope: 'openid' }))
          .status,
      );
      refused((await register({ response_types: ['token'], grant_types: ['implicit'] })).status);
    });

    it('enforces PKCE S256 on a client that registered without asking for it', async () => {
      const reg = await register({ scope: 'openid profile email' });
      expect(reg.status).toBe(201);
      const { body } = await json(
        `/admin/realms/qe-tools/clients?clientId=${encodeURIComponent(reg.body.client_id)}`,
        asAdmin(),
      );
      expect(body[0].publicClient).toBe(true);
      expect(body[0].attributes['pkce.code.challenge.method']).toBe('S256');
      expect(body[0].directAccessGrantsEnabled).toBe(false);
      expect(body[0].implicitFlowEnabled).toBe(false);
      expect(body[0].protocolMappers ?? []).toEqual([]);
    });

    it("gives Keycloak's built-in clients no API token by password grant", async () => {
      for (const clientId of ['admin-cli', 'account-console']) {
        const res = await fetch(`${base}/realms/qe-tools/protocol/openid-connect/token`, {
          method: 'POST',
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: clientId,
            username: 'dev-lead',
            password: DEV_USER_PASSWORD,
            scope: 'openid',
          }),
        });
        if (res.status === 200) {
          const access = claims(((await res.json()) as { access_token: string }).access_token);
          // Also refused by azp in server/auth/bearer.ts (REFUSED_CLIENTS).
          expect([access.aud].flat(), clientId).not.toContain('sit-sizing-api');
        } else {
          expect(res.status, clientId).toBeGreaterThanOrEqual(400);
        }
      }
    });
  });
});
