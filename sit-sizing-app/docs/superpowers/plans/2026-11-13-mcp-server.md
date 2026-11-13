# MCP Server for SIT Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hosted MCP server (`apps/mcp`) through which a coding agent on a QE's laptop can read, explain, preview, edit, save and submit SIT Sizing estimates as the signed-in user.

**Architecture:** `apps/mcp` is a stateless Node service speaking MCP over Streamable HTTP. It verifies a Keycloak access token, forwards it to the existing `/api/v1` API, and uses `@sit/schemas` for types and `@sit/engine` for unsaved previews. The API learns to accept that bearer token beside its session cookie; permissions, edit lock, rate limit and audit are unchanged.

**Tech Stack:** TypeScript, Node ≥ 24, `@modelcontextprotocol/sdk`, `jose`, Zod 4 (`catalog:`), Vitest, Keycloak 26, Next.js 16 route handlers, Prisma, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-13-mcp-server-design.md`

## Global Constraints

- `AGENTS.md` applies to every task. One task = one branch = one pull request; a person merges.
- **Sensitive paths need a named human reviewer:** `docker/keycloak`, `apps/web/server/auth`, `lib/rbac.ts`, `deploy/`. Tasks 1 and 9 touch them. Do not start Task 1 before Task 0's result is in ADR-0016.
- `packages/engine` is not changed. `lib/rbac.ts` is not changed.
- `apps/mcp` never imports `@sit/db` or anything under `apps/web/server` (add an ESLint `no-restricted-imports` rule in Task 3).
- Schema first: every tool input and output is a Zod schema; reuse `@sit/schemas` types where one exists.
- New dependencies (`@modelcontextprotocol/sdk` in `apps/mcp`; `jose` is already in `apps/web`): state the reason and licence in the PR; versions must be ≥ 14 days old (`minimumReleaseAge`).
- No requirement or FSD text is stored, logged or traced. Free-text tool arguments are never logged.
- Synthetic data only in tests, fixtures and examples.
- API changes: schema → service → route → `server/openapi/operations.ts` → `pnpm openapi:generate`; commit `docs/api/openapi.json`.
- EN and VI message keys stay identical; VI goes through `pnpm i18n:review` / `pnpm i18n:apply`.
- Coverage gate for `apps/mcp/src/**`: 80% lines and branches.
- `summary` on write requests: optional, trimmed, 1–300 characters.
- Before each PR: `pnpm check`; `pnpm test:int` when API or schema code changed; GitNexus `impact` before editing a symbol and `detect_changes` before committing.

## Review Focus

Each line has a test in the task that owns the code.

1. **A write fails half-way** (PATCH returns 409 or 422 after the lock was taken): the lock the tool took is released; a lock it did not take is never released. → Task 6.
2. **The access token expires mid-conversation:** the client gets an MCP auth challenge (401 with resource metadata), not a generic tool error. → Tasks 3 and 4.
3. **`update_draft` with a path that does not exist, or a value the schema rejects** (negative count, unknown assumption path): refused with the offending path named; no lock taken, nothing written. → Task 6.
4. **`update_draft` when the estimate has no open draft:** a clear error telling the assistant to call `start_draft`; it does not create one itself. → Task 6.
5. **`preview_estimate` with inputs the schema rejects** (more than 500 features, non-numeric band): validation error, engine not called. → Task 5.

---

## File map

```
apps/mcp/
  package.json  tsconfig.json  vitest.config.ts
  src/env.ts            parse and validate env at start-up
  src/auth.ts           verify bearer token; protected-resource metadata
  src/api-client.ts     typed fetch client for /api/v1; ApiCallError
  src/errors.ts         API error → MCP tool error / auth challenge
  src/rate-limit.ts     per-user tool-call limit
  src/context.ts        ToolContext (api client, user, locale, log)
  src/merge.ts          apply partial changes by path
  src/glossary.ts       describe inputs and assumptions from generated messages
  src/generated/        messages.en.json, messages.vi.json, assumption-rows.json (generated, committed)
  src/tools/read.ts  understand.ts  write.ts
  src/server.ts         createMcpServer(ctx): registers all tools
  src/http.ts  main.ts  Streamable HTTP transport, /health, /ready
  scripts/build-glossary.ts
apps/web/server/auth/bearer.ts            verify Keycloak access token (Task 1)
apps/web/server/auth/current-user.ts      bearer source, channel
apps/web/server/services/change-meta.ts   channel + summary → audit detail (Task 2)
```

---

### Task 0: Client compatibility check (human-run, nothing merged but the ADR)

**Files:**

- Create: `docs/adr/0016-mcp-server.md`
- Throwaway: a minimal protected MCP endpoint in the scratch directory, not in the repo.

This needs a person: each client must be installed and a browser sign-in completed. An agent prepares the endpoint and the table; a human runs the clients.

- [ ] **Step 1:** Start `pnpm dev:up`. In Keycloak dev only (admin console, not the realm export), create a public client `sit-sizing-mcp-spike`: standard flow, PKCE S256, redirect URIs `http://127.0.0.1/*` and `http://localhost/*`.
- [ ] **Step 2:** Run a throwaway Streamable HTTP MCP server with one tool `ping` that answers 401 with `WWW-Authenticate: Bearer resource_metadata=…` until a token from that client is presented, and serves `/.well-known/oauth-protected-resource` naming the dev realm as authorization server.
- [ ] **Step 3:** Connect from Claude Code, Codex, Antigravity and Kiro. For each, record in a table: version tested; Streamable HTTP (yes/no); discovers the authorization server from resource metadata (yes/no); accepts a configured client ID or requires dynamic client registration; redirect URI used; sends `resource` parameter (yes/no, value); `ping` succeeded (yes/no).
- [ ] **Step 4:** Write ADR-0016 from `docs/adr/0000-template.md`: context and the four decisions from spec section 2; the table; the realm decision — one pre-registered public client if every required client works with it, otherwise the dynamic-registration fallback with its restrictions, marked "decision for the security reviewer"; the audience value; unsupported clients listed.
- [ ] **Step 5:** Delete the spike client and the throwaway server. Commit the ADR only.

```bash
git add docs/adr/0016-mcp-server.md && git commit -m "ADR-0016: MCP server and client compatibility"
```

**Stop here** until the security reviewer has accepted the realm decision in ADR-0016.

---

### Task 1: Bearer sign-in in the API (security review)

**Files:**

- Modify: `docker/keycloak/realm/qe-tools-realm.json` (client `sit-sizing-mcp`, audience mapper), `apps/web/server/env.ts`, `.env.example`, `apps/web/server/auth/current-user.ts`, `packages/schemas/src/api-error.ts`, `apps/web/server/http/route.ts` (`authedRoute`), `apps/web/server/openapi/*` (bearer security scheme), `docs/threat-model.md`, `docs/api/openapi.json` (generated)
- Create: `apps/web/server/auth/bearer.ts`, `apps/web/server/auth/bearer.test.ts`
- Test: `apps/web/tests/integration/bearer.test.ts`, `apps/web/tests/identity/keycloak.test.ts` (one added case)

**Interfaces:**

- Produces:
  - Env: `OIDC_API_AUDIENCE` (default `sit-sizing-api`).
  - `verifyAccessToken(token: string, opts?: { keys?: JWTVerifyGetKey; now?: Date }): Promise<{ sub: string; sid?: string; azp: string } | null>` in `bearer.ts`. Checks signature, `iss === OIDC_ISSUER`, `aud` contains `OIDC_API_AUDIENCE`, expiry. Keys default to a cached remote JWKS fetched from `OIDC_INTERNAL_URL ?? OIDC_ISSUER`. Returns `null` on any failure; never logs the token.
  - `CurrentUser.channel: 'web' | 'mcp'` — `'mcp'` for every request authenticated by a bearer token (self-registered clients have a generated `azp`, ADR-0016); `'web'` otherwise.
  - `ApiErrorCode` gains `'NOT_PROVISIONED'`.
- `getCurrentUser(request)` order: (1) `Authorization: Bearer` present → bearer path only, cookies and dev header ignored; (2) session cookie; (3) dev header. Bearer path: `verifyAccessToken` → `null` ⇒ return `null` (401); `sid` in `RevokedSession` ⇒ `null`; `loadUser({ subject })` missing or inactive ⇒ throw `HttpError(403, 'NOT_PROVISIONED', 'Sign in to SIT Sizing once in the browser first.')`.
- Bearer is accepted only when `AUTH_MODE === 'oidc'` and `OIDC_ISSUER` is set.

- [ ] **Step 1: Write failing unit tests** in `bearer.test.ts`, signing tokens with a local `jose` key pair passed as `keys`:

```ts
it('accepts a token with the right issuer, audience and expiry', …)      // → { sub, sid, azp }
it('refuses a wrong audience', …)                                         // → null
it('refuses a wrong issuer', …)                                           // → null
it('refuses an expired token', …)                                         // → null
it('refuses a token signed by another key', …)                            // → null
it('refuses alg none and a malformed token', …)                           // → null
```

- [ ] **Step 2:** Run `pnpm vitest run --project web apps/web/server/auth/bearer.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `bearer.ts` with `jose` (`jwtVerify`, `createRemoteJWKSet`). Add the env variable to `env.ts` and `.env.example`.
- [ ] **Step 4:** Run the same command. Expected: PASS (6).
- [ ] **Step 5: Write failing integration tests** in `tests/integration/bearer.test.ts` (inject the test key set through a module-level setter exported for tests from `bearer.ts`, e.g. `setKeysForTests`):

```ts
it('GET /me with a valid bearer token returns the seeded user'); // 200, same body as dev-estimator
it('ignores cookies and the dev header when a bearer token is present'); // invalid bearer + dev header → 401
it('refuses a wrong audience'); // 401 UNAUTHENTICATED
it('refuses a token whose sid was revoked'); // 401
it('answers 403 NOT_PROVISIONED for a subject with no app user'); // code and message as above
it('answers 403 NOT_PROVISIONED for an inactive user');
it('still answers 404 across projects and 403 for a low role with bearer'); // reuse rbac-endpoints cases for two routes
it('rate-limits a bearer user like a cookie user'); // 429 after the limit
```

- [ ] **Step 6:** Run `pnpm --filter @sit/web exec vitest run --config vitest.integration.config.ts tests/integration/bearer.test.ts`. Expected: FAIL.
- [ ] **Step 7:** Implement the bearer source in `current-user.ts`; add `'NOT_PROVISIONED'` to `ApiErrorCode`; set `channel` on every `CurrentUser` (`'web'` on the cookie and dev paths). `currentUserFromCookies` keeps its signature.
- [ ] **Step 8:** Run Step 6's command. Expected: PASS (8). Run `pnpm test:int`. Expected: all pass.
- [ ] **Step 9:** Realm, exactly as ADR-0016's four numbered points once the security reviewer has accepted them: client `sit-sizing-mcp`; the two anonymous registration policies; the default audience client scope (`sit-sizing-api`); no `offline_access` client scope in the realm. The revoked-session check in the bearer path also refuses an offline session whose SSO session was ended. Add cases to `tests/identity/keycloak.test.ts`: the client's flags; the realm's advertised `scopes_supported` does not contain `offline_access`; anonymous registration with a loopback redirect URI and scopes `openid profile email` succeeds, and with `offline_access` added is refused; with a non-loopback redirect URI, or with scope `service_account`, it is refused; a token from a self-registered client carries `aud` `sit-sizing-api`; its refresh token is an ordinary (not offline) token and stops working after back-channel logout. Run `pnpm test:idp`. Expected: PASS.
- [ ] **Step 10:** OpenAPI: register a `bearerAuth` security scheme and list it beside the cookie scheme on every authed operation; add 403 `NOT_PROVISIONED` to the shared error responses. Run `pnpm openapi:generate && pnpm openapi:check`. Expected: no unapproved breaking change.
- [ ] **Step 11:** Add to `docs/threat-model.md`: the bearer entry point, token theft from a laptop client, audience confusion, revoked session, and the mitigations above.
- [ ] **Step 12:** `pnpm check`. Commit; open the PR with the sensitive-path box ticked and the security reviewer named.

```bash
git commit -m "API: accept Keycloak bearer tokens for the MCP client (ADR-0016)"
```

---

### Task 2: Confirmation summary and channel in the audit trail

**Files:**

- Modify: `packages/schemas/src/api.ts` (+ `api.test.ts`), `apps/web/server/services/{estimates,versions,profiles,review}.ts` (the file holding `submitVersion`), `apps/web/server/openapi/operations.ts`, `docs/api/openapi.json`, `apps/web/messages/{en,vi}.json` (`audit.actions` label for the new event)
- Create: `apps/web/server/services/change-meta.ts` (+ test)
- Test: `apps/web/tests/integration/change-summary.test.ts`

**Interfaces:**

- Consumes: `CurrentUser.channel` (Task 1).
- Produces:
  - `ChangeSummary = z.string().trim().min(1).max(300)` exported from `@sit/schemas`; optional field `summary` on `EstimateCreate`, `DraftCreate`, `DraftPatch`, `ProfileApply`, `VersionSave`, `ReviewNote`.
  - `changeDetail(user: CurrentUser, summary?: string): { channel?: 'mcp'; summary?: string }` — `channel` only when `'mcp'`, `summary` only when given.
  - New audit action `estimate.draft.update`, written by `patchDraft` only when `input.summary` is present; detail `{ number, changed: ('inputs' | 'assumptions' | 'note')[] , ...changeDetail }`. No values in the detail.
  - `DraftPatch`'s "Nothing to update" refinement ignores `summary`.
  - `saveVersion`: when `note` is absent and `summary` is present, the version note is the summary.

- [ ] **Step 1: Failing schema tests** in `api.test.ts`: `summary` accepted on each of the six schemas; 301 characters rejected; empty string rejected; `DraftPatch` with only `rowVersion` and `summary` rejected ("Nothing to update").
- [ ] **Step 2:** `pnpm vitest run --project schemas`. Expected: FAIL.
- [ ] **Step 3:** Add `ChangeSummary` and the six fields. Run again. Expected: PASS.
- [ ] **Step 4: Failing integration tests** in `change-summary.test.ts`:

```ts
it('patchDraft without summary writes no audit event'); // autosave unchanged
it('patchDraft with summary writes estimate.draft.update with summary'); // detail.summary, detail.changed
it('records channel "mcp" for a bearer user and no channel for a cookie user'); // web user: no channel key
it('createEstimate, createDraft, applyProfile, saveVersion, submit carry summary in detail');
it('saveVersion uses the summary as the note when no note is given');
it('never stores input or assumption values in the audit detail');
```

- [ ] **Step 5:** Run it. Expected: FAIL.
- [ ] **Step 6:** Implement `changeDetail`; spread it into the `detail` of the five existing events; add the new event in `patchDraft` (it gains a `meta: RequestMeta` parameter; update its route). Add the EN/VI label for `estimate.draft.update` under `audit.actions`.
- [ ] **Step 7:** Run Step 4's file, then `pnpm test:int`. Expected: PASS.
- [ ] **Step 8:** Update `operations.ts` examples (synthetic summaries); `pnpm openapi:generate && pnpm openapi:check`; `pnpm check`. Commit.

```bash
git commit -m "API: optional confirmation summary and channel on audited changes"
```

---

### Task 3: `apps/mcp` skeleton — env, auth, API client, transport, `whoami`

**Files:**

- Create: `apps/mcp/{package.json,tsconfig.json,vitest.config.ts}`, `src/{env,auth,api-client,errors,rate-limit,context,server,http,main}.ts` with `*.test.ts` beside each, `src/tools/read.ts` (only `whoami` here)
- Modify: root `vitest.config.ts` (coverage `include` and threshold `'apps/mcp/src/**': { lines: 80, branches: 80 }`), `eslint.config.*` (restricted imports for `apps/mcp`), `.env.example`, `AGENTS.md` repository map

**Interfaces:**

- Produces:
  - `parseEnv(source: NodeJS.ProcessEnv): McpEnv` with `SIT_API_BASE_URL` (url), `OIDC_ISSUER` (url), `OIDC_INTERNAL_URL` (url, optional), `OIDC_API_AUDIENCE` (default `sit-sizing-api`), `MCP_PUBLIC_URL` (url), `MCP_PORT` (default 3100), `MCP_RATE_LIMIT_PER_MINUTE` (default 60), `MCP_DEV_USER` (optional; allowed only when `APP_ENV=local`), `APP_ENV`, `LOG_LEVEL`.
  - `verifyAccessToken(token, env, opts?)` → `{ sub: string } | null` (same checks as the API's; the two do not share code across apps).
  - `protectedResourceMetadata(env)` → `{ resource: MCP_PUBLIC_URL, authorization_servers: [OIDC_ISSUER], bearer_methods_supported: ['header'] }`, served at `/.well-known/oauth-protected-resource`.
  - `createApiClient(opts: { baseUrl: string; token?: string; devUser?: string; fetch?: typeof fetch; requestId: string })` → `{ get<T>(path, schema: ZodType<T>, query?), post<T>(path, body, schema), patch<T>(…), del(path) }`. Sends `Authorization: Bearer` or, in dev mode, `x-dev-user`; always `x-request-id`. Parses responses with the given schema. Non-2xx throws `ApiCallError { status, code, message, details, retryAfter? }` parsed from the API error envelope.
  - `toToolResult(err: unknown)` in `errors.ts`: `ApiCallError` → MCP tool error (`isError: true`) whose text is `"<CODE>: <message>"` plus details as JSON; a 401 `ApiCallError` is rethrown as `AuthChallenge` so the transport answers 401 with `WWW-Authenticate: Bearer resource_metadata="<MCP_PUBLIC_URL>/.well-known/oauth-protected-resource"`; Zod errors → `VALIDATION_FAILED` with each issue's path.
  - `ToolContext = { api: ApiClient; locale: 'en' | 'vi'; log: Logger; userKey: string }`.
  - `createMcpServer(ctx: ToolContext): McpServer` — registers tools via `registerReadTools(server, ctx)` (later tasks add `registerUnderstandTools`, `registerWriteTools` with the same signature). A shared `defineTool` helper wraps every handler with the rate limit and `toToolResult`, and logs tool name, status and duration only.
  - `GET /health` (200 always), `GET /ready` (200 when the API's `/api/v1/ready` answers 200).
- Tool `whoami`: no input; output is the `GET /me` response schema from `@sit/schemas`; annotation `readOnlyHint: true`.
- `ctx.locale` is read once per request from `GET /me` the first time a tool needs it, and falls back to `'en'`.
- `apps/mcp/vitest.config.ts` sets `name: 'mcp'`, so `--project mcp` selects it.

- [ ] **Step 1: Failing tests** (one file per module):

```ts
// env.test.ts
it('refuses MCP_DEV_USER unless APP_ENV is local');
it('requires SIT_API_BASE_URL, OIDC_ISSUER and MCP_PUBLIC_URL');
// auth.test.ts  — same six cases as Task 1 Step 1, plus:
it('metadata names the issuer and the public URL');
// api-client.test.ts (fake fetch)
it('sends the bearer token and a request id');
it('sends x-dev-user instead of a token in dev mode');
it('parses a 2xx body with the given schema and rejects a body that does not match');
it('throws ApiCallError with code, message, details and retryAfter from a 429 envelope');
// errors.test.ts
it('maps a 404 envelope to a tool error starting "NOT_FOUND:"');
it('turns a 401 into an auth challenge, not a tool error'); // Review Focus 2
it('names the path of each Zod issue');
// rate-limit.test.ts
it('refuses the 61st call in a minute for one user and allows another user');
// server.test.ts (in-memory MCP client from the SDK)
it('lists whoami as read-only');
it('whoami returns the API user');
it('takes the locale from GET /me and falls back to en');
// http.test.ts
it('answers 401 with WWW-Authenticate and resource_metadata when no token is sent');
it('serves /.well-known/oauth-protected-resource, /health and /ready');
it('never logs tool arguments'); // spy on the logger
```

- [ ] **Step 2:** `pnpm vitest run --project mcp`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Scaffold the package (`"name": "@sit/mcp"`, `"type": "module"`, scripts `dev`, `build`, `start`, `typecheck`) and implement the modules. HTTP layer: `node:http` with the SDK's Streamable HTTP server transport in stateless mode, one server instance per request built from that request's token.
- [ ] **Step 4:** `pnpm vitest run --project mcp`. Expected: PASS. `pnpm test:coverage`. Expected: `apps/mcp/src/**` ≥ 80%.
- [ ] **Step 5:** Add the ESLint restriction and the `AGENTS.md` map row; `pnpm check`. Commit.

```bash
git commit -m "apps/mcp: skeleton with token check, API client and whoami"
```

---

### Task 4: Read tools

**Files:** Modify `apps/mcp/src/tools/read.ts`, `read.test.ts`.

**Interfaces:** Consumes `defineTool`, `ToolContext`. All `readOnlyHint: true`.

| Tool               | Input                                                                                         | Call                                    | Output schema                                             |
| ------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| `list_projects`    | —                                                                                             | `GET /projects`                         | the API's list schema                                     |
| `list_estimates`   | `{ projectId }`                                                                               | `GET /projects/{projectId}/estimates`   | list of `Estimate`                                        |
| `get_estimate`     | `{ estimateId }`                                                                              | `GET /estimates/{estimateId}`           | `EstimateDetail`                                          |
| `get_version`      | `{ estimateId, number }` (`number`: integer ≥ 1, or `'draft'` → resolved from `get_estimate`) | `GET /estimates/{id}/versions/{number}` | `Version`                                                 |
| `compare_versions` | `{ estimateId, a, b }`                                                                        | `GET /estimates/{id}/compare?a=&b=`     | `VersionCompare`                                          |
| `list_profiles`    | `{ projectId? }`                                                                              | `GET /profiles`                         | published profiles only (filter `status === 'PUBLISHED'`) |
| `get_profile`      | `{ profileId }`                                                                               | `GET /profiles/{id}`                    | `ProfileDetail`                                           |

- [ ] **Step 1: Failing tests** — for each tool: correct path and query sent; output parsed with the schema; plus:

```ts
it('get_version with "draft" resolves the draft number, and errors clearly when there is no draft');
it('list_profiles hides draft and retired profiles');
it('a 404 from the API becomes a NOT_FOUND tool error');
it('an expired token during a read becomes an auth challenge'); // Review Focus 2
it('rejects an id that is not an Id before calling the API');
```

- [ ] **Step 2:** `pnpm vitest run --project mcp apps/mcp/src/tools/read.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the seven tools.
- [ ] **Step 4:** Run again. Expected: PASS. `pnpm check`. Commit.

```bash
git commit -m "apps/mcp: read tools"
```

---

### Task 5: Understand tools — glossary and preview

**Files:**

- Create: `apps/mcp/scripts/build-glossary.ts`, `apps/mcp/src/generated/{messages.en.json,messages.vi.json,assumption-rows.json}`, `src/glossary.ts`, `src/merge.ts`, `src/tools/understand.ts`, tests beside each
- Modify: `apps/mcp/package.json` (script `glossary`), `src/server.ts`

**Interfaces:**

- `build-glossary.ts` (run with `node`, which strips types): copies message groups `catalogue`, `detailTab`, `evidenceTab`, `teamTab`, `assumptionsTab` from `apps/web/messages/{en,vi}.json`, and writes `assumption-rows.json` = for each of the 142 `ASSUMPTION_PATHS`: `{ path, group, labelKey, unitKey? }` taken from `apps/web/lib/assumption-meta.ts`.
- `applyChanges<T>(base: T, changes: { path: string; value: unknown }[]): T` in `merge.ts` — dot paths, array indexes allowed (`features.0.qty`); pure, returns a copy; throws `PathError(path)` when a path does not exist in `base`.
- `describeAssumptions(opts: { locale; group?; paths?; values?: Assumptions; calibration?: Record<string, CalibrationEntry> }): AssumptionRow[]` where `AssumptionRow = { path, group, label, explanation: string | null, default: unknown, value?: unknown, calibrated?: boolean, source?: string, measuredAt?: string }`. `explanation` is `assumptionsTab.help.<rowKey>` or `null` when that key is absent (texts arrive in Task 7). `calibrated` uses `isDefaultRow` from `@sit/engine`.
- `describeInputs(opts: { locale; group? }): InputField[]` where `InputField = { path, group, label, explanation: string | null, type: 'count' | 'band3' | 'percent' | 'boolean' | 'enum' | 'text', min?: number, max?: number, options?: string[] }`, groups `features | channels | detail | team | evidence | ptTypes`.
- Tools (all `readOnlyHint: true`):
  - `describe_inputs` `{ group?, locale? }` → `{ fields: InputField[] }`
  - `describe_assumptions` `{ group?, paths?, estimateId?, number?, profileId?, locale? }` → `{ rows: AssumptionRow[], uncalibrated: number }` (at most one of version or profile; with neither, defaults only)
  - `preview_estimate` `{ inputs?: EstimateInputs, assumptions?: Assumptions, base?: { estimateId, number }, changes?: { path, value }[] }` → `{ preview: true, engineVersion, rough, detailed, groups, topGap, sensitivity, uncalibrated }`. Either full `inputs` (assumptions default to `DEFAULT_ASSUMPTIONS`) or `base` plus `changes` (paths prefixed `inputs.` or `assumptions.`). Validates with `EstimateInputs`/`Assumptions` before `computeBoth`. Calls no write endpoint.
- `locale` defaults to `ctx.locale` (from `GET /me`).

- [ ] **Step 1: Failing tests:**

```ts
// build-glossary.test.ts
it('generated files equal a fresh run of the generator'); // drift guard
it('assumption-rows.json has exactly the 142 ASSUMPTION_PATHS, each with a label in EN and VI');
// merge.test.ts
it('sets a nested value and an array element without mutating the base');
it('throws PathError naming a path that does not exist');
// glossary.test.ts
it('returns 142 rows with label and default; explanation is null when no help text exists');
it('marks a changed row calibrated and adds source and measuredAt from the profile');
it('serves Vietnamese labels for locale vi');
it('filters by group and by paths; an unknown path is a validation error naming it');
it('every EstimateInputs leaf has an InputField with a label in EN and VI');
// understand.test.ts
it(
  'preview of EXAMPLE_INPUTS with DEFAULT_ASSUMPTIONS equals toStoredResult(computeBoth(...)) summary figures',
);
it('preview matches every file in packages/engine/golden'); // same inputs, same numbers
it('preview with base + changes fetches the version once and writes nothing'); // only GET calls recorded
it('refuses 501 features and a non-numeric band without calling the engine'); // Review Focus 5
it('output is flagged preview: true');
```

- [ ] **Step 2:** `pnpm vitest run --project mcp`. Expected: FAIL.
- [ ] **Step 3:** Implement the generator, run `pnpm --filter @sit/mcp glossary`, commit the generated files; implement `merge.ts`, `glossary.ts`, the three tools; register them in `server.ts`.
- [ ] **Step 4:** Run again. Expected: PASS. `pnpm check`. Commit.

```bash
git commit -m "apps/mcp: describe inputs and assumptions, preview without saving"
```

---

### Task 6: Write tools

**Files:** Create `apps/mcp/src/tools/write.ts`, `write.test.ts`; modify `src/server.ts`.

**Interfaces:**

- Consumes: `applyChanges`, `PathError` (Task 5); `summary` fields and `estimate.draft.update` (Task 2).
- Every tool: `readOnlyHint: false`, `destructiveHint: false`; input includes required `summary: ChangeSummary`; the summary is sent in the request body.
- `withDraftLock<T>(ctx, estimateId, fn: (draft: Version) => Promise<T>): Promise<T>`:
  1. `GET /estimates/{id}`. No draft (`hasDraft` false) ⇒ tool error `NO_DRAFT: call start_draft first`.
  2. `draftLock` present and `mine` and unexpired ⇒ tool error `EDITOR_OPEN: close the draft in the editor first`. Present and not mine ⇒ `LOCKED: held by <holder display name> until <expiresAt>`. No lock call is made in either case.
  3. `POST …/draft/lock` with `{ takeover: false }`; read the draft; run `fn`; **always** `DELETE …/draft/lock` afterwards, also when `fn` throws. A failed unlock is logged and does not mask `fn`'s error.

| Tool              | Input (besides `summary`)                                   | Behaviour                                                                                                                                                                                                                 | Output                    |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `create_estimate` | `{ projectId, name, description?, profileId? }`             | `POST /projects/{id}/estimates` with `template: 'blank'`                                                                                                                                                                  | `Estimate`                |
| `start_draft`     | `{ estimateId, fromVersion? }`                              | `POST /estimates/{id}/draft`                                                                                                                                                                                              | `Version`                 |
| `update_draft`    | `{ estimateId, changes: { path, value }[] (1–200), note? }` | Validate first: apply `changes` to a copy of the draft read without a lock; parse with `EstimateInputs`/`Assumptions`. Then `withDraftLock`: re-read, re-apply, `PATCH` with the `rowVersion` just read. No retry on 409. | `Version` (server result) |
| `apply_profile`   | `{ estimateId, profileId }`                                 | `withDraftLock` → `POST …/draft/profile`                                                                                                                                                                                  | `Version`                 |
| `save_version`    | `{ estimateId, note? }`                                     | `POST /estimates/{id}/versions`; note defaults to `"Prepared with the estimation assistant: " + summary`                                                                                                                  | `Version`                 |
| `submit_version`  | `{ estimateId, number, note? }`                             | `POST …/versions/{number}/submit`                                                                                                                                                                                         | `Version`                 |

- [ ] **Step 1: Failing tests** (recording fake API):

```ts
it('every write tool refuses a missing or blank summary before any API call');
it('create_estimate posts template "blank" and the summary');
it('update_draft locks, patches with the rowVersion it read, then unlocks, in that order');
it('update_draft sends only the areas that changed (inputs and/or assumptions)');
it('update_draft releases the lock when PATCH answers 409, and returns CONFLICT without retrying'); // Review Focus 1
it('update_draft releases the lock when PATCH answers 422'); // Review Focus 1
it(
  'update_draft with an unknown path or a negative count names the path and makes no lock or PATCH call',
); // Review Focus 3
it('update_draft without an open draft returns NO_DRAFT and does not create one'); // Review Focus 4
it('refuses with EDITOR_OPEN when the user already holds the lock, and does not unlock it'); // Review Focus 1
it('refuses with LOCKED naming the holder when someone else holds the lock; never sends takeover');
it('apply_profile uses the same lock sequence and passes rowVersion');
it('save_version prefixes the default note and does not call submit');
it('submit_version calls only the submit endpoint');
it('no tool exists for approve, return, delete, publish or takeover'); // tool list snapshot
it('write tools are not marked read-only');
```

- [ ] **Step 2:** `pnpm vitest run --project mcp apps/mcp/src/tools/write.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `withDraftLock` and the six tools; register in `server.ts`.
- [ ] **Step 4:** Run again. Expected: PASS. `pnpm test:coverage` (mcp ≥ 80%). `pnpm check`. Commit.

```bash
git commit -m "apps/mcp: write tools with confirmation summary and lock handling"
```

---

### Task 7: Explanations for the 142 assumption rows (content, parallel with 3–6)

**Files:**

- Create: `docs/i18n/assumption-help-draft.md` (review sheet)
- Modify (only after sign-off): `apps/web/messages/{en,vi}.json` (`assumptionsTab.help.<rowKey>`), `apps/mcp/src/generated/*` (regenerated), `docs/adr/0016-mcp-server.md` (VI review list)

- [ ] **Step 1:** Draft one EN explanation per row key in `assumption-help-draft.md`, as a table: row key | label | explanation (≤ 280 characters: what the value means, its unit, what raising it does to the result) | source (file and section in `../sit-sizing-reference/` or the solution design section 6/7). Where the sources do not say what a row means, leave the explanation empty and write "needs author" in the source column. Do not infer meaning from the formula alone.
- [ ] **Step 2:** Hand the sheet to the QE practice lead for approval of the EN text. **Stop until approved**; record the approver and date in the sheet.
- [ ] **Step 3:** Add a failing test in `apps/mcp/src/glossary.test.ts`: `it('every approved row has an explanation in EN and VI')` driven by the approved row keys in the sheet. Run. Expected: FAIL.
- [ ] **Step 4:** Add approved texts to `en.json`; add VI drafts to `vi.json` under the same keys; run `pnpm i18n:review`, get the VI review, `pnpm i18n:apply`. Run `pnpm --filter @sit/mcp glossary`.
- [ ] **Step 5:** `pnpm vitest run --project mcp --project web`. Expected: PASS (including the EN/VI key-parity test). `pnpm check`. Commit.

```bash
git commit -m "Assumption explanations (EN approved, VI reviewed) for the MCP glossary"
```

---

### Task 8: Compose service, scripted end-to-end flow, runbook

**Files:**

- Modify: `docker/Dockerfile` (target `mcp`) or create `docker/Dockerfile.mcp`, `docker/compose.yaml`, `docker/compose.dev.yaml`, root `package.json` (`dev:up` waits for `mcp`), `scripts/ensure-dev-env.mjs`, `docs/runbook.md`, `README.md`
- Test: `apps/mcp/tests/e2e/flow.test.ts`, script `test:e2e` in `apps/mcp/package.json`

**Interfaces:** Service `mcp`: image `sit-sizing-mcp:local`, port `${MCP_PORT:-3100}`, env from Task 3, `depends_on: web (healthy)`, healthcheck `GET /health`. In the dev overlay only: `APP_ENV=local`, `MCP_DEV_USER=dev-estimator`.

- [ ] **Step 1: Write the flow test** (SDK client over Streamable HTTP against `http://localhost:3100`, dev mode):

```ts
it('creates an estimate, updates the draft, previews, saves and submits', async () => {
  // whoami → dev-estimator; list_projects → pick the seeded project
  // create_estimate (blank) → start_draft is not needed if the API returns an open draft; otherwise start_draft
  // update_draft: detail.api.{low,mid,high} and one assumption row
  // preview_estimate(base: draft) figures === get_version(draft).result figures
  // save_version → status SAVED, note starts "Prepared with the estimation assistant:"
  // submit_version → status SUBMITTED
  // audit (as dev-lead, via the API): estimate.draft.update has the summary
});
```

- [ ] **Step 2:** `pnpm dev:up` (before the service exists) then `pnpm --filter @sit/mcp test:e2e`. Expected: FAIL, connection refused.
- [ ] **Step 3:** Add the image and the compose service; update `dev:up` and `ensure-dev-env.mjs`.
- [ ] **Step 4:** `pnpm dev:up && pnpm --filter @sit/mcp test:e2e`. Expected: PASS. `pnpm test:e2e` (web suite). Expected: still 11/11.
- [ ] **Step 5:** Runbook: start, stop, logs, health, env, how a QE adds the server to each supported client (from ADR-0016's table), what `NOT_PROVISIONED`, `EDITOR_OPEN` and `LOCKED` mean. README: one paragraph and the command. `pnpm check`. Commit.

```bash
git commit -m "MCP service in compose, scripted flow test, runbook"
```

---

### Task 9: Image and pipeline stage (sensitive path, own PR)

**Files:** Modify `deploy/Jenkinsfile`, `deploy/ci/*` (build, scan, licence check, smoke for the `mcp` image), `docs/release-checklist.md`, `docs/threat-model.md` (network exposure as decided by the platform team).

- [ ] **Step 1:** Extend `deploy/ci/smoke.sh` (or add `smoke-mcp.sh`) to start the `mcp` image with the stack and assert `/health` 200 and an unauthenticated MCP request → 401 with `WWW-Authenticate`. Run locally. Expected: FAIL (image not built by the script yet).
- [ ] **Step 2:** Add the build, image scan, licence check and smoke stage for `sit-sizing-mcp`, mirroring the `web` stages. No existing gate is changed or weakened.
- [ ] **Step 3:** Run the smoke script locally. Expected: PASS. `pnpm licenses:check`. Expected: PASS with `@modelcontextprotocol/sdk` listed.
- [ ] **Step 4:** Release checklist: MCP URL reachable over HTTPS from a QE laptop; Keycloak reachable from the same laptop; sign-in verified from each supported client. Commit; open the PR with the named pipeline reviewer.

```bash
git commit -m "Pipeline: build, scan and smoke the MCP image"
```

---

## Not verified by this plan

- Sign-in from each real client is verified by a person in Task 0 and again in the release checklist; no automated test drives those clients.
- The hosting platform and network exposure are open (design question Q4); Task 9 covers the image and pipeline only.
- The assistant's prompt is outside this work; server-side, the only enforcement of "explicit confirmation" is the required `summary` and the tool annotations.
