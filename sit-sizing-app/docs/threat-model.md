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

## Open items

- ~~Back-channel logout~~ **Done in 1.7:** Keycloak posts a signed logout token to `/api/auth/backchannel-logout`; the session id is recorded in `RevokedSession` and refused on the next request (T-01).

- Session lifetime and MFA scope: confirm with information security (Q2).
- Rate-limit thresholds: derive from the non-functional targets (Q10).
- Penetration test of the IdP configuration before the pilot (step 1.7).
