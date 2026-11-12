# ADR-0004: App sign-in with openid-client and an encrypted session cookie

|                 |                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Status**      | Accepted (2026-11-12, product owner). Needs the human security review required by AGENTS.md rule 13 before release 1. |
| **Date**        | 2026-11-12                                                                                                            |
| **Deciders**    | Product owner, tech lead                                                                                              |
| **Design refs** | Sections 3, 10.3–10.5; backlog A-03; replaces "Auth.js" in the design                                                 |

## Context

The design named Auth.js (NextAuth v5) as the app's OIDC client. In November 2026, v5 is still a beta (`5.0.0-beta.32`), and Auth.js is in maintenance under the Better Auth project. A beta dependency in the sign-in path of a bank tool is hard to justify.

## Options considered

| Option                      | Pros                                                                                        | Cons                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **openid-client v6 + jose** | OpenID Certified relying-party library, stable, small; standard JOSE library for the cookie | We own about 200 lines: routes, session cookie, refresh                       |
| Auth.js v5 beta             | Least code; Keycloak provider built in                                                      | Beta for years; maintenance mode; harder to reason about in a security review |
| Better Auth                 | Actively developed successor                                                                | Needs its own session tables and more setup than this app needs               |

## Decision

Use **openid-client** for the protocol: authorization code flow with PKCE (S256), `state` and `nonce`, ID token validation, refresh, and RP-initiated logout. Keep the app session in an **encrypted cookie** (JWE `dir` + `A256GCM` via jose, key derived from `SESSION_SECRET`), with no server-side session store.

| Concern         | Implementation                                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code            | `apps/web/server/auth/` (oidc, session, cookies, refresh, provision), `app/api/auth/{signin,callback,signout}`, `proxy.ts`                                                                                             |
| Cookies         | `__Host-sit.session` and `__Host-sit.signin` on https (`sit.*` on local http); HttpOnly, SameSite=Lax                                                                                                                  |
| Lifetimes       | Idle 8 h, absolute 12 h (same as the Keycloak SSO session)                                                                                                                                                             |
| Revocation      | Every access-token lifetime (10 min) the proxy refreshes with Keycloak. If the user was disabled or signed out elsewhere, the refresh fails and the app session ends (design 10.5: "within one access-token lifetime") |
| Provisioning    | Upsert `User` by `sub` on every sign-in; never link accounts by e-mail; `sit-sizing-admins` group → global Admin; a role change is audited                                                                             |
| Redirect safety | Redirect URI built from `APP_BASE_URL`, not the request host; `next` accepts same-site paths only                                                                                                                      |
| Sign-out        | Clears the cookie, then Keycloak end-session with `id_token_hint` to `/signed-out`                                                                                                                                     |

## Consequences

- AGENTS.md rule 13 changes from "no custom authentication code" to "authentication code lives only in `server/auth` and the auth routes; every change needs a named security reviewer".
- **Back-channel logout** (immediate sign-out of other apps' sessions) needs a server-side revocation list. It is deferred to step 1.7; until then sign-out elsewhere takes effect within 10 minutes.
- If the bank later standardises on another IdP, only `OIDC_*` settings change (ADR-0002 fallback).

## Amendment: back-channel logout (step 1.7)

- **Session id.** The session cookie now also carries the Keycloak session id (`sid` from the ID token).
- **Logout endpoint.** Keycloak posts a logout token to `/api/auth/backchannel-logout`, server to server. The realm attribute is `backchannel.logout.url` (`${SIT_WEB_BACKCHANNEL_URL}`), with the session id required.
- **Token checks.** The token is checked as OIDC Back-Channel Logout 1.0, section 2.6 requires (`server/auth/backchannel.ts`):
  - signature against the realm's JWKS;
  - issuer and audience;
  - age at most 5 minutes;
  - the logout event present, no `nonce`, and a `sid`.
- **Revocation.** The `sid` is stored in `RevokedSession` until the longest app session could have ended. `currentUserFromCookies` refuses a revoked session on the next request, so sign-out elsewhere, an admin "sign out" or a disabled user takes effect at once instead of after up to 10 minutes.
- **Review.** The changed auth code needs the named security review (AGENTS.md rule 13).
