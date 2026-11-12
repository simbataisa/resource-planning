# ADR-0002: Identity provider — self-hosted Keycloak

|                 |                                                                                    |
| --------------- | ---------------------------------------------------------------------------------- |
| **Status**      | Proposed. Blocked on Q2 (information security acceptance). Needed before step 1.3. |
| **Date**        | 2026-11-12                                                                         |
| **Deciders**    | Tech lead, IdP owner, information security                                         |
| **Design refs** | Sections 4.1, 5.2.2, 10, 11; open question Q2                                      |

## Context

The tool needs its own identity provider with username and password sign-in, SSO across internal apps, MFA, and later federation with the corporate IdP. Building authentication in-house would put password storage, reset flows and token issuance in our code. Those are high-risk areas with no product value for us.

## Options considered

| Option                                        | Pros                                                                                                                                                           | Cons                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Keycloak, self-hosted, configured as code** | Mature OIDC/OAuth 2.1 server; password policy, brute-force protection, MFA, admin console, events; federation by configuration; realm export in the repository | Operating duty (patching, upgrades, backups); a JVM container to run   |
| Small service on `node-oidc-provider`         | Lightweight, same language as the app                                                                                                                          | We would write and own login, reset and MFA screens and their security |
| Custom auth inside the web app                | No extra container                                                                                                                                             | Passwords and tokens in app code; no SSO for other apps; highest risk  |

## Decision

Use **Keycloak**, self-hosted in its own container with its own database and database role. The web app is only an OIDC client (openid-client, ADR-0004) with the authorization code flow and PKCE. It never sees passwords. All Keycloak configuration lives in `docker/keycloak/` as a realm export. Nobody makes manual console changes in `sit` or `prod`.

The step 1.0 database setup already creates a separate `keycloak` database and `keycloak_user` role that the app role cannot connect to (`docker/postgres/init/01-databases.sh`).

## Consequences

- An IdP owner is named (Q11) and owns upgrades, restore dry-runs and admin access.
- The realm baseline from design section 10.4 is tested automatically (identity test level, design 13).
- **Fallback:** if information security rejects Keycloak, swap in a `node-oidc-provider` service. The app depends only on standard OIDC, so it does not change.
