import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Realm baseline (design 10.4, K-02), checked on the realm export itself so a weakened
 * setting fails `pnpm test` before it reaches Keycloak. The container suite
 * (`pnpm test:idp`) checks the same rules on a running Keycloak.
 * AGENTS.md rule 13: never weaken a rule here to make a test pass.
 */
const dir = new URL('../../../../docker/keycloak/', import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Keycloak representation JSON
const realm: any = JSON.parse(
  readFileSync(fileURLToPath(new URL('realm/qe-tools-realm.json', dir)), 'utf8'),
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const devUsers: any = JSON.parse(
  readFileSync(fileURLToPath(new URL('dev/qe-tools-users-0.json', dir)), 'utf8'),
);
const client = realm.clients.find((c: { clientId: string }) => c.clientId === 'sit-sizing-web');

describe('realm baseline (design 10.4)', () => {
  it('password policy: 12+ characters, not username/email, history 5, blacklist', () => {
    const p: string = realm.passwordPolicy;
    expect(Number(/length\((\d+)\)/.exec(p)?.[1])).toBeGreaterThanOrEqual(12);
    for (const rule of ['notUsername', 'notEmail', 'passwordBlacklist']) expect(p).toContain(rule);
    expect(Number(/passwordHistory\((\d+)\)/.exec(p)?.[1])).toBeGreaterThanOrEqual(5);
    expect(p).not.toMatch(/hashAlgorithm|hashIterations/); // keep Keycloak's default hashing
  });

  it('brute-force detection with temporary lockout after 10 failures', () => {
    expect(realm.bruteForceProtected).toBe(true);
    expect(realm.permanentLockout).toBe(false);
    expect(realm.failureFactor).toBeLessThanOrEqual(10);
  });

  it('sessions 8 h idle / 12 h max; access tokens 10 min; refresh tokens rotated', () => {
    expect(realm.ssoSessionIdleTimeout).toBeLessThanOrEqual(8 * 3600);
    expect(realm.ssoSessionMaxLifespan).toBeLessThanOrEqual(12 * 3600);
    expect(realm.accessTokenLifespan).toBeLessThanOrEqual(600);
    expect(realm.revokeRefreshToken).toBe(true);
    expect(realm.refreshTokenMaxReuse).toBe(0);
  });

  it('no self-registration, events on, EN and VI', () => {
    expect(realm.registrationAllowed).toBe(false);
    expect(realm.eventsEnabled).toBe(true);
    expect(realm.adminEventsEnabled).toBe(true);
    expect(realm.supportedLocales).toEqual(expect.arrayContaining(['en', 'vi']));
    expect(realm.sslRequired).not.toBe('none');
  });

  it('client: confidential, code flow with PKCE S256, no implicit or password grant, exact URIs', () => {
    expect(client.publicClient).toBe(false);
    expect(client.standardFlowEnabled).toBe(true);
    expect(client.implicitFlowEnabled).toBe(false);
    expect(client.directAccessGrantsEnabled).toBe(false);
    expect(client.serviceAccountsEnabled).toBe(false);
    expect(client.attributes['pkce.code.challenge.method']).toBe('S256');
    expect(client.secret).toMatch(/^\$\{[A-Z_]+\}$/); // never a literal secret in the repository
    for (const uri of [
      ...client.redirectUris,
      client.attributes['post.logout.redirect.uris'],
      ...client.webOrigins,
    ]) {
      expect(uri).not.toContain('*');
    }
    expect(client.redirectUris).toEqual(['${SIT_WEB_BASE_URL}/api/auth/callback']);
  });

  it('ends app sessions by back-channel logout with the session id (step 1.7)', () => {
    expect(client.frontchannelLogout).toBe(false);
    expect(client.attributes['backchannel.logout.url']).toBe('${SIT_WEB_BACKCHANNEL_URL}');
    expect(client.attributes['backchannel.logout.session.required']).toBe('true');
  });

  it('client scopes give the profile and email claims the app requests (no offline access)', () => {
    // An explicit, complete list: with optionalClientScopes set but no defaults, Keycloak
    // rejects "openid profile email" with invalid_scope.
    expect(client.defaultClientScopes).toEqual(
      expect.arrayContaining(['basic', 'profile', 'email']),
    );
    expect(client.optionalClientScopes).toEqual([]);
  });

  it('groups claim and the admin group exist', () => {
    expect(realm.groups.map((g: { name: string }) => g.name)).toContain('sit-sizing-admins');
    const mapper = client.protocolMappers.find(
      (m: { protocolMapper: string }) => m.protocolMapper === 'oidc-group-membership-mapper',
    );
    expect(mapper.config['claim.name']).toBe('groups');
    expect(mapper.config['full.path']).toBe('false');
  });

  describe('MCP clients (ADR-0016)', () => {
    type Named = { name: string };
    const mcp = realm.clients.find((c: { clientId: string }) => c.clientId === 'sit-sizing-mcp');
    const policies: {
      name: string;
      providerId: string;
      subType: string;
      config: Record<string, string[]>;
    }[] =
      realm.components['org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy'];
    const anon = (providerId: string) =>
      policies.find((p) => p.subType === 'anonymous' && p.providerId === providerId)!;

    it('point 1: public client, code flow with PKCE S256 only, loopback redirect URIs', () => {
      expect(mcp.publicClient).toBe(true);
      expect(mcp.standardFlowEnabled).toBe(true);
      expect(mcp.implicitFlowEnabled).toBe(false);
      expect(mcp.directAccessGrantsEnabled).toBe(false);
      expect(mcp.serviceAccountsEnabled).toBe(false);
      expect(mcp.fullScopeAllowed).toBe(false);
      expect(mcp.attributes['pkce.code.challenge.method']).toBe('S256');
      expect(mcp.attributes['oauth2.device.authorization.grant.enabled']).toBe('false');
      expect(mcp.redirectUris).toEqual(['http://127.0.0.1/*', 'http://localhost/*']);
      expect(mcp.webOrigins).toEqual([]);
      expect(mcp.defaultClientScopes).toContain('sit-sizing-api');
      expect(mcp.optionalClientScopes).toEqual([]);
    });

    it('point 2: anonymous registration only for loopback clients and the allowed scopes', () => {
      // Every policy is listed: Keycloak adds its defaults only when the export has none.
      expect(
        policies
          .filter((p) => p.subType === 'anonymous')
          .map((p) => p.providerId)
          .sort(),
      ).toEqual([
        'allowed-client-templates',
        'allowed-protocol-mappers',
        'consent-required',
        'max-clients',
        'registration-web-origins',
        'scope',
        'trusted-hosts',
      ]);
      const hosts = anon('trusted-hosts').config;
      expect(hosts['trusted-hosts']).toEqual(['127.0.0.1', 'localhost']);
      expect(hosts['client-uris-must-match']).toEqual(['true']);
      expect(hosts['host-sending-registration-request-must-match']).toEqual(['false']);
      const scopes = anon('allowed-client-templates').config;
      expect(scopes['allow-default-scopes']).toEqual(['false']);
      // Keycloak copies the realm default scopes into a registration request before the
      // policy runs, so those (basic, acr, web-origins, roles) must be allowed too.
      expect([...scopes['allowed-client-scopes']!].sort()).toEqual([
        'acr',
        'basic',
        'email',
        'openid',
        'profile',
        'roles',
        'sit-sizing-api',
        'web-origins',
      ]);
      for (const s of ['offline_access', 'service_account', 'address', 'phone'])
        expect(scopes['allowed-client-scopes']).not.toContain(s);
      expect(anon('max-clients').config['max-clients']).toEqual(['200']);
      expect(policies.filter((p) => p.subType === 'authenticated').length).toBeGreaterThan(0);
    });

    it('point 3: a realm default scope adds the sit-sizing-api audience to access tokens', () => {
      expect(realm.defaultDefaultClientScopes).toContain('sit-sizing-api');
      const scope = realm.clientScopes.find((s: Named) => s.name === 'sit-sizing-api');
      const mapper = scope.protocolMappers.find(
        (m: { protocolMapper: string }) => m.protocolMapper === 'oidc-audience-mapper',
      );
      expect(mapper.config['included.custom.audience']).toBe('sit-sizing-api');
      expect(mapper.config['access.token.claim']).toBe('true');
    });

    it('point 4: no offline tokens: scope unadvertised and unassigned, role given to nobody', () => {
      // Keycloak creates offline_access (scope, and role as a default role) on every import
      // unless the export defines both, so both are defined here, switched off.
      const offline = realm.clientScopes.find((s: Named) => s.name === 'offline_access');
      expect(offline.attributes['include.in.openid.provider.metadata']).toBe('false');
      expect(offline.protocolMappers ?? []).toEqual([]);
      expect(realm.scopeMappings ?? []).toEqual([]);
      expect(realm.defaultDefaultClientScopes).not.toContain('offline_access');
      expect(realm.defaultOptionalClientScopes ?? []).not.toContain('offline_access');
      for (const c of realm.clients) {
        expect(c.defaultClientScopes, c.clientId).not.toContain('offline_access');
        expect(c.optionalClientScopes, c.clientId).not.toContain('offline_access');
      }
      expect(realm.roles.realm.map((r: Named) => r.name)).toContain('offline_access');
      expect(realm.defaultRole?.composites?.realm ?? []).not.toContain('offline_access');
      for (const u of devUsers.users) expect(u.realmRoles ?? []).not.toContain('offline_access');
    });
  });

  it('dev users are synthetic, use a placeholder password, and match the seeded subjects', () => {
    for (const u of devUsers.users) {
      expect(u.email).toMatch(/@example\.invalid$/);
      expect(u.credentials[0].value).toBe('${KC_DEV_USER_PASSWORD}');
    }
    expect(devUsers.users.map((u: { id: string }) => u.id).sort()).toEqual([
      'dev-admin',
      'dev-estimator',
      'dev-lead',
      'dev-outsider',
      'dev-viewer',
    ]);
    const admin = devUsers.users.find((u: { id: string }) => u.id === 'dev-admin');
    expect(admin.requiredActions).toContain('CONFIGURE_TOTP'); // MFA for admins (design 10.4)
  });
});
