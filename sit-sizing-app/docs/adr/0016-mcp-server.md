# ADR-0016: MCP server and client compatibility

|                           |                                                                       |
| ------------------------- | --------------------------------------------------------------------- |
| **Status**                | Proposed (needs security review, rule 13)                             |
| **Date**                  | 2026-11-13                                                            |
| **Deciders**              | Product owner; security reviewer (realm decision)                     |
| **Backlog / design refs** | MCP server design spec 2026-11-13, sections 2, 6.2, 6.2a; plan task 0 |

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

**Proposed outcome (for the product owner and the security reviewer to confirm):** option A. One pre-registered public client `sit-sizing-mcp`: standard flow, PKCE S256, redirect URIs `http://127.0.0.1/*` and `http://localhost/*`, no implicit flow, no direct grants, no service account, no offline tokens, plus an audience mapper adding `sit-sizing-api`. Anonymous registration stays closed.

Under option A this version supports **Claude Code**. Codex and Antigravity are unsupported as tested; Kiro is unknown until someone tests it.

Open for the deciders:

- **Product owner:** is Claude Code alone acceptable for the first version, or must Codex and Antigravity work? If they must, the choice is between option B with offline tokens (Codex only; Antigravity still does not sign in) and option C.
- **Security reviewer:** accept option A as described; and, only if the product owner needs Codex, whether option B with offline tokens is acceptable at all.

Realm changes are made only through `docker/keycloak/realm/qe-tools-realm.json` and need human security review.

## Consequences

- Nothing is built until the security reviewer has accepted the realm decision.
- If option B is chosen, the realm policy and its tests become part of the review scope.
- Unsupported clients get no workaround in this version.
- We will know the decision was wrong if a client in regular use cannot sign in; revisit then.
