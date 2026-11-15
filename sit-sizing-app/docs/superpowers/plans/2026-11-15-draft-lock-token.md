# Draft Lock Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only the tab or assistant session that took a draft's edit lock can use or release it.

**Architecture:** Taking a free or expired lock mints a random token; the API stores its SHA-256 and returns the token once. Lock-using calls send it in `X-Lock-Token`; a mismatch on a lock the user holds is a 409 conflict with reason `LOCKED_ELSEWHERE`. The web editor keeps the token per tab; the MCP write tools keep theirs per call.

**Tech Stack:** Next.js 16 route handlers, Prisma/Postgres, Zod 4, TanStack Query, next-intl, `apps/mcp`, Vitest, Testcontainers, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-15-draft-lock-token-design.md` (approved).

## Global Constraints

- Token: `randomBytes(32).toString('base64url')` from `node:crypto`; store only `sha256(token)` hex in `EstimateVersion.lockTokenHash`; clear it whenever the lock is cleared.
- Header name: `X-Lock-Token`, on `PATCH …/draft`, `POST …/draft/profile`, `POST …/versions`, `DELETE …/draft/lock`, and on `POST …/draft/lock` for a renewal.
- Refusal: HTTP 409, error code `CONFLICT`, `details` reason `LOCKED_ELSEWHERE` (same pattern as the existing `HELD_BY_OTHER` and `LOCK_REQUIRED`; this realises the spec's "LOCKED_ELSEWHERE" without a new top-level code). Message: "This draft is open in another tab or in the assistant."
- Own-lock takeover (`takeover: true` on a lock I hold with no or another token) is allowed for any role and is audited as `estimate.draft.lock.takeover` with `detail.own: true`.
- `lockToken` is returned only in the response to the call that took or took over the lock (`POST …/draft/lock`, `POST /projects/{id}/estimates`, `POST …/draft`); never in reads or in other users' responses. Never logged.
- Lock length (15 min), the QE Lead rule for others' locks, and `rowVersion` are unchanged.
- Migration additive, after `20261117000000_user_tours` (e.g. `20261118000000_draft_lock_token`); `packages/db` needs a named reviewer.
- API change order: schema → service → route → `operations.ts` → `pnpm openapi:generate`; `deploy/ci/openapi-diff.sh` must pass.
- EN and VI for every new string. Never use bare `git stash`. Do not touch the user's running dev stack (compose project `sit-sizing`).

## Review Focus

1. **Expired lock with an old token:** after expiry, a tab sending its stale token takes a new lock (new token), and the old token no longer works → test in Task 1.
2. **Heartbeat from a tab that lost the lock** (another tab took over): gets `LOCKED_ELSEWHERE` and the editor shows recovery with its unsaved values kept → test in Task 2.
3. **Two tabs racing for a free lock:** only one wins (existing conditional update) and only the winner's token works → test in Task 1.
4. **Release with a wrong token** never clears the lock or the hash → test in Task 1.
5. **Assistant vs editor race** (ADR-0016 residual): editor locks between the assistant's check and lock → the assistant is refused and the editor's lock stays → test in Task 3.

---

### Task 1: Token in the lock rules, schema, migration and API

**Files:**

- Modify: `apps/web/server/domain/lock.ts` (+ `lock.test.ts`), `packages/db/prisma/schema.prisma` (`EstimateVersion.lockTokenHash String?`), `packages/schemas/src/api.ts` (`Version.lockToken` optional), `apps/web/server/services/versions.ts` (`lockDraft`, `unlockDraft`, `requireOwnLockedDraft`, `createDraft`, `patchDraft`, `saveVersion`), `apps/web/server/services/estimates.ts` (`createEstimate`), `apps/web/server/services/profiles.ts` (`applyProfile`), the four lock-using routes and the lock route under `apps/web/app/api/v1/estimates/[estimateId]/…`, `apps/web/server/openapi/operations.ts`, `docs/api/openapi.json` (generated)
- Create: `packages/db/prisma/migrations/20261118000000_draft_lock_token/migration.sql`, `apps/web/server/domain/lock-token.ts` (+ test)
- Test: `apps/web/tests/integration/lock-token.test.ts`

**Interfaces:**

- Produces: `newLockToken(): { token: string; hash: string }` and `hashLockToken(token: string): string` in `lock-token.ts`. `decideLock(state, userId, now, opts)` gains `state.tokenHash: string | null` and `opts.tokenHash: string | null`, and returns `{ ok: true; expiresAt; takeover; newToken: boolean; own: boolean }` or `{ ok: false; reason: 'HELD_BY_OTHER' | 'TAKEOVER_NOT_ALLOWED' | 'LOCKED_ELSEWHERE' }`. `requireOwnLockedDraft(tx, user, estimateId, lockToken: string | undefined)`. Services take `lockToken?: string` read by routes from the `X-Lock-Token` header. `Version.lockToken?: string`.

- [ ] **Step 1: Failing domain tests** (`lock.test.ts`, `lock-token.test.ts`): the spec's decision table row by row — free or expired → `newToken: true`; mine + matching hash → renewal, `newToken: false`; mine + no/other hash, no takeover → `LOCKED_ELSEWHERE`; mine + takeover → `newToken: true, own: true` for a non-QE-Lead; someone else's → unchanged results. `hashLockToken(t)` is 64 hex chars and stable; two `newLockToken()` calls differ.
- [ ] **Step 2:** `pnpm vitest run --project web apps/web/server/domain` → FAIL.
- [ ] **Step 3:** Implement the domain changes.
- [ ] **Step 4: Failing integration tests** (`lock-token.test.ts`): taking a free lock returns `lockToken` and the DB holds its hash, not the token; renewal with the token keeps it; a second lock call without the token → 409 `LOCKED_ELSEWHERE`; own takeover → new token, old token now refused, audit `own: true`; PATCH, apply profile, save version and DELETE lock each refuse a missing or wrong token (409 `LOCKED_ELSEWHERE`) and write nothing; a wrong-token DELETE leaves lock and hash in place (Review Focus 4); expired lock + stale token → new token, stale one refused (Review Focus 1); two concurrent lock calls on a free lock → one 200, one 409, only the winner's token works (Review Focus 3); `createEstimate` and `createDraft` responses carry `lockToken`; reads (`GET …/versions/{n}`, `GET /estimates/{id}`) never do.
- [ ] **Step 5:** `pnpm --filter @sit/web exec vitest run --config vitest.integration.config.ts tests/integration/lock-token.test.ts` → FAIL.
- [ ] **Step 6:** Implement schema, migration SQL (`ALTER TABLE "EstimateVersion" ADD COLUMN "lockTokenHash" TEXT;`), services and routes; clear `lockTokenHash` everywhere `lockedById` is cleared; register the header and `lockToken` in `operations.ts` with synthetic examples; `pnpm openapi:generate`.
- [ ] **Step 7:** Step 5's command → PASS; `pnpm test:int` (existing tests that lock and then write must now send the token — update helpers, not assertions); `pnpm openapi:check`; `deploy/ci/openapi-diff.sh` → no breaking changes (adding an optional response field and an optional request header). If it reports breaking, stop and report.
- [ ] **Step 8:** `pnpm check`. Commit `API: draft lock token (only the session that took the lock can use it)`.

### Task 2: Web editor keeps and sends its token

**Files:** `apps/web/lib/api/index.ts` (lock, unlock, patchDraft, saveVersion, applyProfile accept a token and send `X-Lock-Token`), `apps/web/lib/query/hooks.ts`, `apps/web/components/features/estimate-editor/store.tsx` (token in the editor state, memory only), `draft-toolbar.tsx` (heartbeat, autosave, save), `apply-profile.tsx`, the editor's recovery view and the new-estimate / start-draft flows that receive `lockToken`; `apps/web/messages/{en,vi}.json`; tests beside the components.

**Interfaces:** Consumes `Version.lockToken`, the header and the `LOCKED_ELSEWHERE` reason from Task 1.

- [ ] **Step 1: Failing component tests:** the editor stores the token from the lock response and sends it on autosave, heartbeat, apply profile, save version and unlock; a `409 LOCKED_ELSEWHERE` on autosave or heartbeat switches to the recovery view with unsaved values kept and an "Open here instead" button (Review Focus 2); that button calls lock with `takeover: true` and continues editing with the new token; the token is not written to `localStorage`/`sessionStorage`.
- [ ] **Step 2:** `pnpm vitest run --project web apps/web/components/features/estimate-editor` → FAIL.
- [ ] **Step 3:** Implement. EN "Open here instead" / message from Global Constraints; VI drafts, then `pnpm i18n:review`.
- [ ] **Step 4:** Tests → PASS; `pnpm --filter @sit/web exec vitest run tests/unit/prototype-ui-parity.test.tsx tests/unit/messages.test.ts` → PASS; `pnpm check`. Commit `Editor: keep the draft lock token per tab; recover when it is open elsewhere`.

### Task 3: MCP write tools use their own token

**Files:** `apps/mcp/src/api-client.ts` (per-call headers), `apps/mcp/src/tools/write.ts` (+ `write.test.ts`), `apps/mcp/src/errors.ts` (map `LOCKED_ELSEWHERE` → `EDITOR_OPEN: close the draft in the editor first`).

**Interfaces:** Consumes Task 1's `lockToken` and header.

- [ ] **Step 1: Failing tests:** `withDraftLock` sends the token it got from its lock call on the write and on release; `create_estimate` and `start_draft` release with the token from their own POST; an API `409 LOCKED_ELSEWHERE` becomes `EDITOR_OPEN`; the ADR-0016 race — editor takes the lock after the tool's check, the tool's lock call gets `LOCKED_ELSEWHERE`, the tool returns `EDITOR_OPEN` and makes no write or release call (Review Focus 5); remove the "residual race" comment from `withDraftLock`.
- [ ] **Step 2:** `pnpm vitest run --project mcp apps/mcp/src/tools/write.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm vitest run --project mcp` → PASS; `pnpm --filter @sit/mcp test:e2e:stack` → PASS. Commit `apps/mcp: send the draft lock token on writes and release`.

### Task 4: Docs, E2E and the full suite

**Files:** `apps/web/tests/e2e/` (one new spec or case), `docs/adr/0016-mcp-server.md` (residual race closed), `docs/threat-model.md` (lock token row), `docs/runbook.md` (`LOCKED_ELSEWHERE` meaning).

- [ ] **Step 1:** E2E case: open the same draft in two browser contexts as one user; the second shows "open elsewhere"; "Open here instead" moves editing to it and the first tab shows recovery.
- [ ] **Step 2:** Docs updates.
- [ ] **Step 3:** Full suite (AGENTS.md "Before any merge"): `pnpm check`, `pnpm test:coverage`, `pnpm test:int`, `pnpm test:e2e`, `pnpm openapi:check`, `deploy/ci/openapi-diff.sh`, `pnpm --filter @sit/mcp test:e2e:stack`. All pass. Commit `Docs and E2E for the draft lock token`.
