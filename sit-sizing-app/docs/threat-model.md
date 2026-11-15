# Threat model and data classification (step 1.0)

|            |                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| **Status** | First pass. Review with information security before step 1.3. Update whenever a trust boundary changes. |
| **Scope**  | Sign-in, REST API, exports, containers and pipeline                                                     |
| **Method** | STRIDE per trust boundary                                                                               |

## Data classification

| Data                                                  | Class              | Notes                                                   |
| ----------------------------------------------------- | ------------------ | ------------------------------------------------------- |
| Estimates: inputs, assumptions, results, versions     | Internal           | Planning figures about delivery work. No customer data. |
| Assumption profiles and actuals                       | Internal           | Calibration data for the QE practice                    |
| User record: username, display name, work email, role | Internal, personal | The only personal data stored. Never in logs.           |
| Credentials, MFA secrets                              | Restricted         | Keycloak database only. The app never sees them.        |
| Audit events                                          | Internal           | Who did what, for accountability                        |
| Customer, account, patient or member data             | **Not allowed**    | Must never be entered. The UI and API state this.       |

## Trust boundaries

1. Browser ↔ web app (HTTPS, session cookie)
2. Browser ↔ Keycloak (sign-in pages)
3. Web app ↔ Keycloak (OIDC back channel: token exchange, JWKS)
4. Web app ↔ PostgreSQL `app` database
5. Pipeline ↔ Nexus ↔ runtime environments
6. MCP client on a laptop ↔ MCP server ↔ web app API (`Authorization: Bearer` Keycloak access token; ADR-0016)
7. Anyone on the network ↔ Keycloak anonymous client registration endpoint (ADR-0016)

## STRIDE

| ID   | Threat                                                                | Boundary | Mitigation                                                                                                                                                                                     | Step                        |
| ---- | --------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| T-01 | **Spoofing**: stolen session cookie reused                            | 1        | `HttpOnly`, `Secure`, `SameSite=Lax` encrypted cookie; short session lifetime; sign-out ends the Keycloak session                                                                              | 1.3                         |
| T-02 | **Spoofing**: password guessing                                       | 2        | Keycloak brute-force detection, password policy, MFA for privileged roles                                                                                                                      | 1.3                         |
| T-03 | **Tampering**: client sends a manipulated total                       | 1        | Server recomputes every saved version with the engine and never trusts client results (design 4.1)                                                                                             | **1.2 ✓**                   |
| T-04 | **Tampering**: two editors overwrite each other                       | 1, 4     | `rowVersion` optimistic locking plus the draft edit lock                                                                                                                                       | **1.2 ✓**                   |
| T-05 | **Repudiation**: "I didn't approve that"                              | 1, 4     | Audit events for create, update, submit, approve, publish, role change and export                                                                                                              | 1.2 / R2                    |
| T-06 | **Information disclosure**: secrets or personal data in logs          | 4        | pino redaction, no request bodies in logs, env errors name the variable but not its value                                                                                                      | **1.0 ✓**                   |
| T-07 | **Information disclosure**: cross-site scripting                      | 1        | React escaping; CSP with a per-request script nonce and `'strict-dynamic'` (no `'unsafe-inline'` scripts), `frame-ancestors 'none'`, no `object-src` (`server/http/csp.ts`, set in `proxy.ts`) | **1.7 ✓**                   |
| T-08 | **Information disclosure**: reading another project's estimate        | 1        | Authorisation by role **and** project membership in every service call; RBAC matrix tests; non-members get 404                                                                                 | **1.2 ✓**                   |
| T-09 | **Information disclosure**: export leaks data                         | 1        | Exports carry only estimate data, are audited and respect membership                                                                                                                           | 1.5 / R2                    |
| T-10 | **Information disclosure**: API reference exposes internals           | 1        | `/api/v1/docs` behind sign-in, bundled assets, no external calls (ADR-0003)                                                                                                                    | 1.2                         |
| T-11 | **Denial of service**: API flooding                                   | 1        | Per-user rate limit (`RATE_LIMIT_PER_MINUTE`, default 300, per instance) answers 429 with Retry-After; Keycloak throttles sign-in                                                              | **1.7 ✓** (thresholds: Q10) |
| T-12 | **Elevation of privilege**: role escalation through the API           | 1        | Roles come from Keycloak groups and project membership only; role changes audited; Admin only by group mapping                                                                                 | 1.3                         |
| T-13 | **Elevation of privilege**: app reaches the IdP database              | 4        | Separate database and role; `REVOKE ALL … FROM PUBLIC`; the app has no Keycloak database credentials                                                                                           | **1.0 ✓**                   |
| T-14 | **Supply chain**: malicious or brand-new package version              | 5        | Nexus proxy, committed lockfile, `minimumReleaseAge` 14 days, audit, licence check, image scan                                                                                                 | **1.0 ✓**                   |
| T-15 | **Container breakout or tampering**                                   | runtime  | Non-root user, read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`                                                                                                                 | **1.0 ✓**                   |
| T-16 | **CSRF** on state-changing routes                                     | 1        | SameSite cookies (1.3) plus an Origin check on POST, PUT, PATCH and DELETE (`assertSameOrigin`)                                                                                                | **1.2 ✓** Origin check      |
| T-17 | **Spoofing**: the local `x-dev-user` sign-in left on outside a laptop | 1        | `AUTH_MODE=dev` is rejected at start-up unless `APP_ENV=local`; compose defaults to `oidc`; removed from use once Keycloak lands (1.3)                                                         | **1.2 ✓**                   |

| T-18 | **Open redirect / login CSRF** in the sign-in flow | 1, 2 | `state`, `nonce`, PKCE; redirect URI from `APP_BASE_URL`; `next` limited to same-site paths | **1.3 ✓** |
| T-19 | **Forced sign-out** through a link to `/api/auth/signout` | 1 | Accepted risk (nuisance only); a GET keeps sign-out working under `form-action 'self'` | 1.3 (accepted) |
| T-20 | **Spoofing**: forged or altered bearer token on `/api/v1` | 6 | `server/auth/bearer.ts`: signature against the realm JWKS, asymmetric algorithms only (no `none`, no HMAC), issuer = `OIDC_ISSUER`, expiry with 30 s tolerance, `typ` `Bearer`, and `sub`, `azp` and `sid` required; accepted only with `AUTH_MODE=oidc`. One check decides whether a request carries a bearer token (`server/auth/bearer-header.ts`); such a request ignores cookies and `x-dev-user`. Any failure is 401 with `WWW-Authenticate: Bearer error="invalid_token"`; the token is never logged | MCP task 1 |
| T-21 | **Spoofing**: token stolen from a laptop MCP client and replayed | 6 | Access tokens live at most 10 minutes; no offline tokens (T-24); refresh tokens rotate and end with the Keycloak session; roles still come from app memberships, so a stolen token has exactly the user's rights. Residual: a token is usable until it expires | MCP task 1 (accepted residual) |
| T-22 | **Spoofing**: audience confusion (a token from another client accepted here) | 6 | `aud` must contain `OIDC_API_AUDIENCE` (`sit-sizing-api`). The audience scope is a realm default, so every client created after import gets it, including self-registered ones (by design) and any future client (a reviewer must check each new client). Built-in clients are created before the scope during import and so probably do not get it (not yet verified on a running Keycloak); the guaranteed control is the `azp` refusal: whatever their audience, tokens whose `azp` is a built-in client (`admin-cli`, `account`, `account-console`, `security-admin-console`, `broker`, `realm-management`) or `sit-sizing-web` are refused (`REFUSED_CLIENTS`) | MCP task 1 |
| T-23 | **Spoofing**: bearer token used after sign-out or session end | 6 | A token whose `sid` is in `RevokedSession` is refused, as on the cookie path; a token without `sid` is refused (fail closed). Residual: `RevokedSession` is filled by back-channel logout to `sit-sizing-web`; a Keycloak session that never included the web client sends no logout to the app, so its last access token stays valid for up to 10 minutes (its refresh token stops at once) | MCP task 1 (accepted residual) |
| T-24 | **Elevation of privilege**: long-lived offline token outliving the session limits | 2, 7 | Not offered: the `offline_access` scope is not advertised or assigned to any client, no user or default role has the `offline_access` role, and anonymous registration refuses it (realm-baseline and identity tests) | MCP task 1 |
| T-25 | **Elevation / DoS**: abuse of anonymous client registration | 7 | Registration policies: redirect URIs only `127.0.0.1`/`localhost`; scopes limited to `openid profile email`, the realm defaults and the audience scope (no `service_account`, no `offline_access`); no protocol mappers (T-27); consent required; full scope disabled; at most 200 clients. Client policies (STRICT, matching anonymous registration and registration-access-token updates only): PKCE S256 set on the client, implicit flow and password grant refused, confidential clients (secret, service account) refused, so a registered client is public and can only start a user's own sign-in. Residual: the 200-client limit can be exhausted, blocking new Codex sign-ins; stale self-registered clients are removed by the clean-up procedure in runbook section 11, run by a person on a schedule | MCP task 1 (accepted residual) |
| T-26 | **Spoofing**: valid token for someone with no app user creates an account | 6 | The bearer path never creates users; it answers 403 `NOT_PROVISIONED` (sign in once in the browser). Inactive users get the same answer | MCP task 1 |
| T-27 | **Spoofing**: claim forgery through a self-registered client's protocol mapper (e.g. a user property mapped to `sub`) | 7 | The anonymous "Allowed Protocol Mapper Types" list is empty, so registration with any mapper is refused (realm-baseline and identity tests). A client that drops the `basic` scope gets tokens without `sub`, which the API refuses | MCP task 1 |
| T-28 | **SSRF from Keycloak** through URL fields on the anonymous registration endpoint (`sector_identifier_uri`, fetched when the registration is validated; `jwks_uri` and `request_uris`, fetched at authorization or token time; the back-channel logout URL, called when a session ends) | 7 | Not mitigated by a realm setting: Trusted Hosts checks the redirect and client URLs, not every URL field. Keycloak must not reach internal services it does not need (network egress rules). In the penetration test scope | MCP task 1 (pentest) |

## Network exposure (MCP server)

Hosting follows design open question Q4 (default: container images plus Compose); the platform team decides it. What is decided and what is not:

| Item                                                                       | Status                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MCP URL over HTTPS, reachable from QE laptops                              | **Required** (design spec 6.7). The server refuses a non-https `MCP_PUBLIC_URL` outside `local`. TLS termination point not decided                                                                                             |
| Keycloak reachable from the same laptops                                   | **Required**: the MCP client opens Keycloak in the laptop's browser to sign in                                                                                                                                                 |
| Who can reach the MCP URL and Keycloak (VPN only, internal network, wider) | **Open: platform team.** Assumed for this model: internal network or VPN only, never the internet. Boundaries 6 and 7 widen with the exposure chosen; T-25 and T-28 assume this assumption holds                               |
| MCP server ↔ web API                                                       | Server-to-server inside the deployment (`SIT_API_BASE_URL`); the server needs no route to the database                                                                                                                         |
| MCP server egress                                                          | Only the web API and Keycloak's JWKS (`OIDC_INTERNAL_URL`); no other outbound need. Enforcement (network policy or firewall) is the platform team's                                                                            |
| Image                                                                      | `sit-sizing-mcp`, built, Trivy-scanned and smoke-tested in the same pipeline run as web, published to Nexus from `main` only (runbook section 4). Runs non-root on a read-only filesystem with all capabilities dropped (T-15) |

Update this section and boundaries 6 and 7 when the platform team records the decision.

## Open items

- ~~Back-channel logout~~ **Done in 1.7:** Keycloak posts a signed logout token to `/api/auth/backchannel-logout`; the session id is recorded in `RevokedSession` and refused on the next request (T-01).

- Network exposure of the MCP URL and Keycloak (VPN only or wider): platform team decision, recorded in "Network exposure (MCP server)" above (Q4).
- Clean-up of stale self-registered MCP clients before the 200-client limit is reached (T-25, ADR-0016): procedure in runbook section 11; a person still has to run it on a schedule.
- Session lifetime and MFA scope: confirm with information security (Q2).
- Rate-limit thresholds: derive from the non-functional targets (Q10).
- Penetration test of the IdP configuration before the pilot: scope in `docs/security/pentest-scope.md`, configuration review in `docs/security/idp-review.md` (release gates, `docs/release-checklist.md`).
