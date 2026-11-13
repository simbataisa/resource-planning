# MCP server for SIT Sizing — design

|            |                                                                             |
| ---------- | --------------------------------------------------------------------------- |
| **Status** | Draft for product-owner approval                                            |
| **Date**   | 2026-11-13                                                                  |
| **Refs**   | Solution design sections 6, 9, 10, 11, 15; ADR-0002, 0003, 0004, 0008, 0013 |
| **Needs**  | A new ADR (0016) and human security review before build (AGENTS.md rule 13) |

## 1. Intent

An estimate needs many inputs (scope counts, team, evidence) and 142 assumption values, calibrated or not. A person cannot review and set all of them well without understanding each one.

A Quality Engineer will instead talk to an AI assistant (the "QE Estimation Assistant" prompt supplied by the product owner). They give it business requirements or an FSD. The assistant proposes the inputs and an assumption profile, explains every value, asks clarifying questions, shows the result, and, after an explicit yes, saves a version in SIT Sizing.

The MCP server is what gives that assistant access to SIT Sizing. It exposes the app's existing functions as MCP tools on top of the existing `/api/v1` API.

## 2. Decisions made with the product owner

1. **The engine computes; the assistant does not.** The assistant turns a document into engine inputs and a profile choice. Every figure it shows comes from `@sit/engine` or from the API. It never stores a free-form "feature × activity" table, and the app gets no new record type.
2. **A separate MCP server that calls the REST API** (approach 1 in section 5).
3. **The assistant saves versions and can submit them for review, each behind the user's explicit confirmation. It never approves or returns them.** Review decisions stay with a QE Lead in the app.
4. **The server is hosted; the clients are on laptops.** QEs use coding agents on their own machines (Claude Code, Codex, Antigravity, Kiro and others) and connect to one hosted MCP server. A local (stdio) server was offered and declined.

## 3. Goals, non-goals, anti-goals

**Goals**

- A QE with the Estimator role can go from a document to a saved estimate version without opening the editor.
- The assistant can explain any input and any of the 142 assumption rows: what it means, its current value, its default, and whether it is calibrated (with source and measured date when a profile supplies them).
- The assistant can preview results for proposed values without saving anything.
- Everything the assistant changes is done as the signed-in user, under the same permissions, edit lock, rate limit and audit trail as the web app.

**Non-goals (this version)**

- Creating, editing, publishing or retiring assumption profiles.
- Approve and return; actuals; portfolio; audit; user and member administration; spreadsheet export.
- The assistant itself (prompt, model, chat client). This design covers only the server it connects to.
- Service accounts or any access that is not tied to one signed-in person.

**Anti-goals (would make this a failure even if it works)**

- A number reaches the user that the tool cannot reproduce from saved inputs and assumptions.
- The server becomes a second way around permissions, the edit lock or the audit trail.
- Requirement or FSD text is stored, logged or traced by the server. Documents stay in the chat; only counts, values and short notes reach the app (design section 11: no PII or customer data).
- A write happens without the user's explicit confirmation in chat.

## 4. Constraints

- `AGENTS.md` rules apply, in particular: schema first (5), layers (6), no new dependencies without a stated reason and licence check (11), identity is configuration and auth code lives only in `apps/web/server/auth` and `app/api/auth` (13), API changes include the contract (15).
- `packages/engine` is not changed. Golden tests stay green.
- The realm export, `server/auth` and anything touching `lib/rbac.ts` need review by a named human.
- `minimumReleaseAge` in `pnpm-workspace.yaml`: dependencies must be at least 14 days old.

## 5. Approaches

| #              | Approach                                                                                                                                                                                                                                              | Trade-off                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 (chosen)** | New app `apps/mcp`. Each tool makes one or two `/api/v1` calls, typed from `@sit/schemas`. The user signs in through Keycloak from the MCP client; the server forwards that token; the API accepts a Keycloak bearer token beside the session cookie. | Every existing rule applies unchanged and there is one contract. Costs a second deployable and a reviewed change to auth code and the realm.            |
| 2              | MCP route inside `apps/web` calling services directly.                                                                                                                                                                                                | One deployable. Still needs bearer sign-in, and adds a second entry to the services that bypasses the published API. Not "through the underlying APIs". |
| 3              | Local stdio server with a personal access token generated in the app.                                                                                                                                                                                 | Simplest on a laptop. Adds a credential type the app must store, rotate and revoke, against rule 13.                                                    |

Chosen: 1, by the product owner, because it matches the request, keeps one contract, and adds the least new auth surface.

## 6. Design

### 6.1 Shape

```
MCP client (assistant)  ──Streamable HTTP + bearer──▶  apps/mcp  ──HTTP + same bearer──▶  apps/web /api/v1
        │                                                 │
        └────── OAuth 2.1 authorization code + PKCE ──────┴──▶ Keycloak (realm qe-tools)
```

- `apps/mcp` is a stateless Node service using the official MCP TypeScript SDK (Streamable HTTP transport). It has no database access and never imports `@sit/db` or anything from `apps/web/server`.
- It imports `@sit/schemas` (request and response types, tool input schemas) and `@sit/engine` (previews, defaults, catalogue, calibration check).
- It holds no user state between requests. The bearer token arrives with every MCP request and is forwarded as `Authorization: Bearer …` to the API.

### 6.2 Sign-in (needs security review)

- **MCP side.** `apps/mcp` acts as an OAuth protected resource as the MCP authorization spec describes: it answers 401 with a pointer to its protected-resource metadata, which names Keycloak as the authorization server. It checks the token's signature, issuer, expiry and audience before any tool runs.
- **Realm.** A new public client for MCP clients (authorization code + PKCE S256 only; no implicit flow, no direct grants, no service account), and an audience so that its access tokens are valid for the SIT Sizing API and for nothing else. Changed only through `docker/keycloak/realm/qe-tools-realm.json`.
- **API side.** `getCurrentUser` gains one more source: a bearer access token, verified against the realm's keys (issuer, audience, expiry), mapped to the app user by `subject` exactly as the cookie path does (`loadUser`, active users only). The verification lives in `apps/web/server/auth`. A request carrying a bearer token ignores cookies. Roles still come from the app's memberships, not from the token.
- **What does not change:** `lib/rbac.ts`, the permission matrix, the 404-not-403 rule, per-user rate limiting, audit.
- **Audit.** Changes made through a bearer token are recorded under the same user; the audit event additionally records that the channel was `mcp` (the token's client), so a reviewer can tell assistant-made changes from editor-made ones.
- **First-time users (builder's call, for the security reviewer to confirm).** Users are created only in the web sign-in callback (`server/auth/provision.ts`). The bearer path does not create users. A valid token for someone with no app user gets 403 with a distinct code and the message to sign in to SIT Sizing once first; `apps/mcp` passes it on as a tool error, not as an auth challenge.
- **Revoked sessions (builder's call, same review).** A bearer token whose `sid` is in `RevokedSession` is refused, as on the cookie path.
- **Dev mode.** With `AUTH_MODE=dev` (local only) the server may be started with a seeded dev user and sends the existing `x-dev-user` header, so tools can be exercised without Keycloak.

### 6.2a Client compatibility (first task, before the rest is built)

The server must work with several MCP clients, and their support for remote servers with OAuth sign-in differs and changes between releases. It has not been verified for each client. So the first task is a compatibility check, not code to keep:

- Stand up a minimal protected MCP endpoint against the dev Keycloak and connect from each client the team uses (at least Claude Code, Codex, Antigravity, Kiro).
- Record per client: Streamable HTTP support, whether it discovers the authorization server from protected-resource metadata, whether it needs dynamic client registration or accepts a configured client ID, the redirect URIs it uses, and whether it sends the `resource` parameter.
- The result decides the realm change, and goes into ADR-0016 for the security review:
  - **Preferred:** one pre-registered public client with loopback redirect URIs, no dynamic registration.
  - **Only if a required client cannot work that way:** dynamic client registration, restricted by realm policy (allowed redirect patterns, public clients with PKCE only, the one audience scope). This is a larger thing to review and is the security reviewer's decision.
- A client that cannot sign in to a remote server at all is listed as unsupported; no per-client workaround is built in this version.

### 6.3 Tools

Names are final; inputs and outputs are Zod schemas, reusing `@sit/schemas` types. Read tools are marked read-only in their MCP annotations; write tools are not.

**Read**

| Tool               | Does                                                  | API                                     |
| ------------------ | ----------------------------------------------------- | --------------------------------------- |
| `whoami`           | The user and their role per project                   | `GET /me`                               |
| `list_projects`    | Projects the user can see                             | `GET /projects`                         |
| `list_estimates`   | Estimates in a project                                | `GET /projects/{id}/estimates`          |
| `get_estimate`     | Estimate, its versions, draft and lock state          | `GET /estimates/{id}`                   |
| `get_version`      | One version or the draft: inputs, assumptions, result | `GET /estimates/{id}/versions/{number}` |
| `compare_versions` | What changed between two versions                     | `GET /estimates/{id}/compare`           |
| `list_profiles`    | Published profiles available to a project             | `GET /profiles`                         |
| `get_profile`      | A profile's values and calibration notes              | `GET /profiles/{id}`                    |

**Understand (no API call, no writes)**

| Tool                   | Does                                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `describe_inputs`      | The input fields of `EstimateInputs`, grouped as the editor groups them, each with its label, meaning, type and allowed range. Optional filter by group.                                                                                        |
| `describe_assumptions` | The 142 assumption rows: path, label, meaning, default value. Given a version or profile, also the current value, whether it is calibrated, and source and measured date where known. Optional filter by group or path.                         |
| `preview_estimate`     | Runs `computeBoth` on proposed inputs and assumptions (or on a saved version plus a partial change) and returns the summary, group breakdown, top gap, sensitivity rows and uncalibrated count. Saves nothing. Output is labelled as a preview. |

**Write (each needs the user's confirmation in chat; see 6.5)**

| Tool              | Does                                                                              | API                                                         |
| ----------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `create_estimate` | New estimate in a project, blank template, optional profile                       | `POST /projects/{id}/estimates`                             |
| `start_draft`     | Open a draft on an estimate from its latest or a named version                    | `POST /estimates/{id}/draft`                                |
| `update_draft`    | Take the edit lock, apply changed inputs and/or assumption rows, release the lock | `POST …/draft/lock`, `PATCH …/draft`, `DELETE …/draft/lock` |
| `apply_profile`   | Replace the draft's assumptions with a published profile                          | lock, `POST …/draft/profile`, unlock                        |
| `save_version`    | Save the draft as a numbered version with a note                                  | `POST /estimates/{id}/versions`                             |
| `submit_version`  | Submit a saved version for review, with an optional note                          | `POST /estimates/{id}/versions/{number}/submit`             |

- `update_draft` takes a **partial** change (a set of input paths and assumption paths with new values). The server reads the draft, merges, validates the whole object with the schema, and sends it with the `rowVersion` it read. On a 409 (someone else changed it) or a lock held by another user it does not retry or take over; it returns a clear error that names the holder and tells the assistant to ask the user.
- `submit_version` is a separate tool and a separate confirmation from `save_version`: saving never submits. It needs the same permission as in the app (`version.submit`, Estimator), and the API's workflow rules decide whether the version can be submitted (ADR-0007). Its summary goes into the existing submit audit event.
- Lock takeover is not exposed.
- **Same user in the editor and the assistant (builder's call).** The lock is per user, so the API cannot tell the two apart. Before it writes, `update_draft` and `apply_profile` read the estimate; if the user already holds an unexpired lock, the editor is open, and the tool refuses with a message asking the user to close the editor first. It never releases a lock it did not take.
- A draft saved through the server carries a note prefix so the version history shows it was prepared with the assistant (wording left to the builder, in EN; it is data, not UI text).
- Results returned by write tools are the server's stored result, not a local preview.

### 6.4 Explanations

The API has no descriptions of inputs or assumption rows; they live in the web app's message files (`catalogue`, `detailTab`, `evidenceTab`, `teamTab`, `assumptionsTab`). `describe_inputs` and `describe_assumptions` serve the same wording so the assistant and the editor never disagree.

- EN and VI are both served; the tool takes a `locale` argument that defaults to the user's locale from `GET /me`.
- Numbers in tool output are raw values, not formatted strings; the assistant formats them.
- **Explanations for the assumption rows are part of this work** (product-owner decision). Today `assumptionsTab.rows` holds labels only; only the evidence rows have descriptions. Each of the 142 rows gets a short explanation: what the value means, its unit, and what raising it does to the result.
  - Drafted from the prototype (`../sit-sizing-reference/`, its VI dictionary) and solution design sections 6 and 7. Where those sources do not say what a row means, the row is listed for the reviewer instead of being given invented text.
  - Stored in the message files with the labels, EN and VI, same keys (the existing key-parity test covers them). VI goes through `pnpm i18n:review` / `pnpm i18n:apply`.
  - **Sign-off (builder's call, to confirm):** the QE practice lead, who owns global profiles under design open question Q7. The explanations are not released until that person has approved the EN text; `describe_assumptions` returns label-only for a row whose explanation is not yet approved.
  - Showing the explanations in the editor too is out of scope here.

### 6.5 Confirmation and safety

- The server cannot see the chat, so "explicit confirmation" is enforced in two layers: the assistant's prompt requires it, and every write tool carries MCP annotations (not read-only, not idempotent where true) so clients that prompt for approval do so.
- Every write tool requires a `summary` argument: one sentence stating what the user agreed to. A missing or empty summary is refused. Where it is recorded (builder's call):
  - The six request schemas behind the write tools (`EstimateCreate`, `DraftCreate`, `DraftPatch`, `ProfileApply`, `VersionSave`, and the submit note) each gain an optional `summary` field (max 300 characters). It is a body field, not a header, so it is in the contract and can hold Vietnamese text.
  - Create estimate, start draft, apply profile, save version and submit already write audit events; the summary goes into the event's `detail`. For `save_version` it is also the version note when no note is given.
  - Draft changes: when `summary` is present the service writes a new audit event, `estimate.draft.update`. The editor's autosave never sends it, so autosave stays unaudited as today.
  - `AuditEvent.detail` is JSON, so the channel and summary need no migration.
- No tool deletes anything.
- Tool results never include tokens, email addresses of other users beyond what the API already returns, or raw document text.
- Logging and tracing follow the web app's rules: request ID, user ID, tool name, status and duration. Tool arguments that are free text are not logged.
- The server sets its own conservative limit on tool calls per user per minute, below the API's `RATE_LIMIT_PER_MINUTE`, and passes API 429s through with the retry time.

### 6.6 Errors

API errors keep their code (`NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `VALIDATION`, `RATE_LIMITED`, …) and are returned as MCP tool errors with the API's message and details, so the assistant can explain them. Validation errors name the path of the offending value. A 401 from the API becomes an MCP auth challenge.

### 6.7 Running it

- **Deployment is in scope.** `apps/mcp` gets its own image (a target in `docker/Dockerfile` or a second Dockerfile) and a build, scan and publish stage in the pipeline. The pipeline is a sensitive path: that change is its own PR with a named reviewer. The hosting platform follows design open question Q4 (default: container images plus Compose).
- The server's URL must be reachable over HTTPS from QE laptops, and Keycloak must be reachable from the same laptops for sign-in. Network exposure (VPN-only or wider) is the platform team's decision and is recorded in the threat model.
- `docker/compose.yaml` gets an `mcp` service beside `web`; `pnpm dev:up` starts it. Port and env names are the builder's choice, added to `.env.example` and validated at start-up in the same way as `apps/web/server/env.ts`.
- New env for `apps/mcp`: the API base URL, the OIDC issuer and expected audience, and its own public URL. No secrets beyond what token verification needs (public keys are fetched from the issuer).
- Health and readiness endpoints like the web app's.
- The runbook gains a section for the new service; the threat model gains the MCP entry point and the bearer path.

### 6.8 Tests

- Unit tests for every tool against a mocked API client: input validation, merge logic of `update_draft`, error mapping, locale selection. Coverage gate for `apps/mcp`: 80% lines and branches, added to the root Vitest config as a new project.
- `preview_estimate` is checked against the engine's golden examples: same inputs, same numbers.
- Integration tests (Testcontainers, with the existing suite): bearer token accepted, wrong audience refused, expired token refused, inactive user refused, cross-project access still 404, role too low still 403, audit records the channel.
- One end-to-end test: document-free scripted flow through the MCP server in dev mode — create estimate, update draft, preview equals saved result, save version, submit it.

## 7. What changes outside `apps/mcp`

| Area                                                               | Change                                                                                      | Review                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------- |
| `docker/keycloak/realm`                                            | New public client and audience                                                              | Security                    |
| `apps/web/server/auth`                                             | Bearer-token source in `getCurrentUser`                                                     | Security                    |
| Audit                                                              | Channel and summary in `detail`; new `estimate.draft.update` event                          | Tech lead; no migration     |
| `packages/schemas`, services, OpenAPI                              | Optional `summary` on the six write requests; new error code for a user with no app account | ADR-0003; integration tests |
| `docs/adr/0016-…`                                                  | The decisions in this document                                                              | Product owner, tech lead    |
| `docs/threat-model.md`, `docs/runbook.md`, `.env.example`, compose | New entry point and service                                                                 | Tech lead                   |
| OpenAPI                                                            | Bearer security scheme added to the document; regenerate                                    | ADR-0003                    |

## 8. Left to the builder

- File layout inside `apps/mcp`, HTTP framework, port, env names.
- How the message texts reach `apps/mcp` (a build step that extracts the needed groups, or moving them to a shared package). No copy that can drift without a test noticing.
- The exact output shape of each tool, as long as it is a Zod schema and uses `@sit/schemas` types where one exists.
- Which library verifies tokens (prefer what the stack already has: `openid-client`/`jose`).
- Task split and order. Suggested: (0) the client compatibility check in 6.2a; (1) ADR + realm + API bearer path, reviewed on its own; (2) `apps/mcp` skeleton with read tools; (3) understand tools, and the explanation texts as a content task that can run in parallel; (4) write tools; (5) compose, runbook, threat model; (6) image and pipeline stage, reviewed on its own.

## 9. Open questions for the product owner

1. _Answered:_ clients are coding agents on laptops; the server is hosted (decision 4, section 6.2a).
2. _Answered:_ explanations are included (section 6.4). Still to confirm: that the QE practice lead signs them off.
3. _Answered:_ submit is offered behind its own confirmation (decision 3). Approve and return stay out.
