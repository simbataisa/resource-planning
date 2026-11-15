# ADR-0016: MCP server and client compatibility

|                           |                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Status**                | Accepted 2026-11-15 (security review confirmed by the product owner; reviewer named in the PR) |
| **Date**                  | 2026-11-13                                                                                     |
| **Deciders**              | Product owner; security reviewer (realm decision)                                              |
| **Backlog / design refs** | MCP server design spec 2026-11-13, sections 2, 6.2, 6.2a; plan task 0                          |

## Context

An estimate needs many inputs and 142 assumption values. A Quality Engineer will instead talk to an AI assistant, which proposes inputs and an assumption profile, explains every value, shows the result and, after an explicit yes, saves a version. The MCP server gives that assistant access to SIT Sizing by exposing the existing `/api/v1` functions as tools.

QEs use coding agents on their own machines (Claude Code, Codex, Antigravity, Kiro and others) and connect to one hosted server. Support for remote servers with OAuth sign-in differs between clients and changes between releases, and has not been verified. A throwaway protected endpoint against the dev Keycloak was used to find out (task 0).

## Decisions made with the product owner

1. The engine computes; the assistant does not. Every figure comes from `@sit/engine` or the API. No free-form "feature x activity" table, no new record type.
2. A separate MCP server that calls the REST API.
3. The assistant saves versions and can submit them for review, each behind the user's explicit confirmation. It never approves or returns them.
4. The server is hosted; clients run on laptops. A local (stdio) server was offered and declined.

## Client compatibility

Tested against a throwaway server and a throwaway public client `sit-sizing-mcp-spike` in the dev realm. Run on 2026-11-13 on one developer machine. All test clients and the two policy relaxations used for the Codex runs were removed afterwards, and anonymous registration was confirmed refused again (403).

| Client      | Version tested                                 | Streamable HTTP | Finds authorization server from resource metadata | Configured client ID accepted, or dynamic registration required                                                                                                                                            | Redirect URI used                         | Sends `resource` (value)                                            | `ping` succeeded                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | ---------------------------------------------- | --------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | 2.1.321                                        | yes             | yes                                               | Configured client ID accepted (`--client-id`); no registration attempt                                                                                                                                     | loopback (exact value not recorded)       | not recorded; the access token carries no `resource` or `aud` claim | yes (`pong`)                                                                                                                                                                                                                                                                                                                                                            |
| Codex       | codex-cli 0.167.0                              | yes             | yes                                               | Dynamic registration required (no client-ID option). Keycloak's default anonymous policies refuse it twice: "Allowed Client Scopes", then "Trusted Hosts". With both relaxed in dev it registered a client | `http://127.0.0.1:<random port>/callback` | yes (`http://localhost:3999/mcp`)                                   | no. Without `scopes_supported` in the resource metadata it requested every scope the realm advertises. With `scopes_supported` set to `openid profile email` it requested those plus `offline_access`, and the token exchange failed with "Offline tokens not allowed for the user or client". Not tested further: the next step would be granting users offline tokens |
| Antigravity | CLI 1.5.6                                      | yes             | It fetches the resource metadata, then stops      | Neither: no sign-in is started. The server is listed as failed (`initialize: Unauthorized`); its only actions are Restart and Disable                                                                      | not reached                               | not reached                                                         | no                                                                                                                                                                                                                                                                                                                                                                      |
| Kiro        | not tested (not installed on the test machine) | not tested      | not tested                                        | not tested                                                                                                                                                                                                 | not tested                                | not tested                                                          | not tested                                                                                                                                                                                                                                                                                                                                                              |

Clients that cannot sign in to a remote server at all are listed as unsupported; no per-client workaround is built in this version. As tested, with the realm's current rules: **Claude Code works; Codex and Antigravity do not; Kiro is not tested.**

What Codex would need from the realm, all three refused today:

1. Anonymous dynamic client registration with the scopes it asks for (policy "Allowed Client Scopes").
2. Registration from any laptop (policy "Trusted Hosts"; limiting the registered client's redirect URIs to `127.0.0.1`/`localhost` was enough in the test).
3. Offline tokens for users. Codex always adds `offline_access`. Offline tokens outlive the SSO session, which works against the session limits and back-channel logout in design 10.4.

Other findings:

- Access tokens for a plain public client carry **no `aud` claim**. The real client needs an explicit audience mapper for `sit-sizing-api`; without it the API's audience check would refuse every token.
- Codex sends `resource=<MCP URL>`; Keycloak 26.8 did not copy it into the token.
- A client follows `scopes_supported` in the protected-resource metadata, so `apps/mcp` must publish `openid profile email` there. Without it Codex requested every scope the realm advertises, including `service_account`.
- The realm already advertises an anonymous registration endpoint; the default policies are what keep it closed.
- **Both clients ask for an offline token whenever the realm advertises one.** Claude Code too, once the server publishes `scopes_supported`: Its first run (no `scopes_supported`) got scope `email profile` and worked. A later run on 2026-11-13 against a server publishing `openid profile email`, with the pre-registered client and a user without the offline role, failed at the token exchange with "Offline tokens not allowed for the user or client" (Keycloak event `CODE_TO_TOKEN_ERROR`, client `sit-sizing-mcp-spike`). So without offline tokens, publishing scopes breaks Claude Code, and not publishing them makes Codex ask for every scope.
- Tested afterwards: with the scope removed from the realm, neither client asks for it (see Decision).

## Options considered

| Option                                                                                                           | Pros                                                                                      | Cons                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A. One pre-registered public client, loopback redirect URIs, authorization code + PKCE S256                      | Smallest realm change; nothing open to anonymous callers                                  | Every required client must accept a configured client ID                                                             |
| B. Dynamic client registration restricted by realm policy (redirect patterns, public + PKCE, one audience scope) | Works with clients that cannot take a configured client ID                                | Larger surface to review; anonymous registration endpoint. For Codex it also needs offline tokens                    |
| C. Local (stdio) server on each laptop that signs in by itself                                                   | Works with every client that can start a local server, including the two that failed here | Declined by the product owner before this evidence existed; a session stored on each laptop; distribution to laptops |

## Decision

Realm decision rule (spec 6.2a):

- **Preferred:** option A, if every required client works with it.
- **Fallback, only if a required client cannot work that way:** option B with its restrictions. This is a decision for the security reviewer.

**Product owner's decision (2026-11-13): Codex must work in the first version, by opening the realm (option B).** Option A alone was offered and declined; a sign-in broker inside the MCP server and a local server (option C) were also offered and declined.

**This is not accepted until the security reviewer accepts it (rule 13).** The reviewer may refuse it; the alternatives above then come back.

Proposed realm change, every line for the security reviewer:

1. **A pre-registered public client `sit-sizing-mcp`** for clients that accept a configured client ID (Claude Code): standard flow, PKCE S256, redirect URIs `http://127.0.0.1/*` and `http://localhost/*`, no implicit flow, no direct grants, no service account.
2. **Anonymous dynamic client registration, restricted by policy:**
   - "Trusted Hosts": the sending host is not checked (laptops cannot be listed); the registered client's URIs must be `127.0.0.1` or `localhost`.
   - "Allowed Client Scopes": only `openid`, `profile`, `email`, `offline_access` and the audience scope below. Not `service_account`, `roles` or the rest.
   - "Consent Required", "Full Scope Disabled", "Allowed Protocol Mapper Types" and "Max Clients Limit" stay as they are. Each Codex sign-in registers a new client (two were created in two runs), so the limit will be reached; stale self-registered clients need a documented clean-up.
3. **Audience for every client.** A realm default client scope with an audience mapper adding `sit-sizing-api`, so that self-registered clients get it too. Without it tokens carry no `aud` and the API refuses them.
4. **No offline tokens.** The realm has no `offline_access` client scope, so it is not in the scopes Keycloak advertises, and no user has the `offline_access` role. Neither the web app nor the realm export uses offline tokens today; the export currently gets the scope only because Keycloak creates it on import, so the export must remove it explicitly and an identity test must check it is absent.

**Proven in dev on 2026-11-13, in two steps:**

- With offline tokens allowed for one dev user, Codex (0.168.0) registered itself, the user signed in, and `ping` returned `pong`; the token carried `aud: sit-sizing-api`.
- **Then without offline tokens** (points 1 to 4 as written above): with the `offline_access` scope removed from the realm, **both clients stopped asking for it**. Codex requested `openid profile email`, registered, signed in and received an ordinary refresh token. Claude Code signed in through the pre-registered client with the same scopes and `ping` returned `pong`. No user had the offline role. Keycloak events `CLIENT_REGISTER` and `CODE_TO_TOKEN` (scope `openid email profile`, refresh type `Refresh`) record it.

So the earlier need for offline tokens came only from the realm advertising the scope. Dropping it keeps the session limits and back-channel logout in design 10.4 intact.

All test settings were removed afterwards and anonymous registration was confirmed refused again (403).

Consequence for the API: `azp` is a different generated ID per Codex sign-in, so "came through the assistant" cannot be decided by comparing `azp` with one client ID. Every bearer-authenticated request is recorded as channel `mcp`; the bearer path exists only for MCP clients.

Under this decision the first version supports **Claude Code and Codex**. **Antigravity** stays unsupported (it never starts a sign-in); **Kiro** is unknown until someone tests it.

Realm changes are made only through `docker/keycloak/realm/qe-tools-realm.json` and need human security review.

## Consequences

- Nothing is built until the security reviewer has accepted the realm decision.
- Option B is chosen: the registration policies, the default audience scope, the offline-token settings and their tests are part of the review scope and of plan task 1.
- The realm's anonymous registration endpoint becomes usable from the network the server is exposed on; this goes into the threat model.
- Unsupported clients get no workaround in this version.
- We will know the decision was wrong if a client in regular use cannot sign in; revisit then.
