# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is here

- `sit-sizing-app/` — the only code: a pnpm monorepo (Next.js 16 + Prisma/Postgres + Keycloak) that turns the SIT Sizing Model prototype into a full-stack, versioned, auditable app. Run all commands from this folder.
- `SIT_Sizing_Model_Solution_Design.md` — the solution design and **source of truth**. If code, `AGENTS.md` and the design disagree, stop and ask.
- `SIT_Sizing_Model.html` — the original single-file prototype. `sit-sizing-reference/` holds its extracted engine/UI JS, a golden example and the VI dictionary; the engine parity check reads from here.
- `tcb-ds/` — Techcombank design-system source (untracked); tokens are ported into `packages/tokens` (ADR-0005).
- Other `.html`/`.docx`/`.jpeg` files at the root are unrelated reference material.

The app's rules, layer boundaries, command list, definition of done and human controls live in `sit-sizing-app/AGENTS.md` — follow it for every task:

@sit-sizing-app/AGENTS.md

## Running a single test

```bash
pnpm vitest run --project engine packages/engine/src/compute.test.ts   # projects: engine, schemas, tokens, web
pnpm vitest run -t "name of the test"
pnpm --filter @sit/web exec vitest run --config vitest.integration.config.ts tests/integration/export.test.ts   # needs Docker
pnpm --filter @sit/web exec playwright test tests/e2e/<file>.spec.ts   # needs pnpm dev:up
```

Coverage gates (root `vitest.config.ts`): engine 95%, schemas 90%, `components/{patterns,features}` 80% lines and branches.

## Architecture (big picture)

**One engine, two places.** `@sit/engine` is a pure-TS port of the prototype's maths. The editor calls it in the browser on every keystroke for live results; the server calls it again on autosave (`PATCH …/draft`) and when a version is saved, and stores `toStoredResult(computeBoth(...))` stamped with `ENGINE_VERSION`. Server-side numbers are authoritative. Parity with the prototype is enforced by `packages/engine/golden/*.json` (root `pnpm test`) and by `pnpm --filter @sit/engine parity` (5,000 random cases against `sit-sizing-reference/`).

**Schema first.** `packages/schemas` (Zod 4) defines inputs, assumptions, results and the whole API contract (`src/api.ts`). Route handlers parse with these schemas, the client infers types from them, and `apps/web/server/openapi/operations.ts` registers them to generate `docs/api/openapi.json` (served via Scalar at `/api/v1/docs`). Any API change: schema → service → route → `operations.ts` → `pnpm openapi:generate`.

**Request path** (`apps/web`):
1. `app/api/v1/**/route.ts` — thin: wrap in `api()` from `server/http/authed.ts` (session user, per-user rate limit, request ID, error → JSON mapping via `HttpError` in `server/http/route.ts`), parse params/body (`server/http/params.ts`, `parse.ts`), call one service.
2. `server/services/*` — business operations inside Prisma transactions: access checks (`access.ts`), audit (`repositories/audit.ts`), DTO mapping (`server/dto.ts`). Time comes from `server/clock.ts`, not `new Date()`.
3. `server/domain/*` — pure rules unit-tested without a DB: edit lock (`lock.ts`), approval workflow (`review.ts`), version compare, profiles.
4. `packages/db` — Prisma schema/migrations/seed; client imported only via `server/db.ts`.

**Estimates model.** Project → Estimate → numbered Versions. One mutable draft per estimate, guarded by a time-limited edit lock (a QE Lead can take it over) and optimistic `rowVersion`. Saved versions are immutable and go through submit → return/approve (ADR-0007). Assumption profiles (ADR-0008) are published/retired sets of the 142 assumption rows, applied to drafts, with calibration status computed by the engine. Spreadsheet export lives in `server/export/` (ADR-0009).

**Client.** Pages under `app/[locale]/(app)/` (next-intl, EN/VI). Data access is TanStack Query hooks in `lib/query/` over typed, Zod-parsed calls in `lib/api/` on the one Axios instance in `lib/http.ts`; components never fetch directly. Components are layered `ui` (shadcn/Radix primitives) → `patterns` → `features`. `lib/rbac.ts` is the single permission matrix (`authorize()`/`can()`): services enforce it via `server/services/access.ts`, and components use it only to hide actions. Cross-project access returns 404, not 403.

**Auth.** Keycloak realm is code (`docker/keycloak`); OIDC via `openid-client` only in `server/auth` and `app/api/auth` (sign-in, callback, sign-out, back-channel logout, session revocation). `proxy.ts` sets the per-request CSP nonce.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **TCB** (3343 symbols, 8874 relationships, 234 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/TCB/context` | Codebase overview, check index freshness |
| `gitnexus://repo/TCB/clusters` | All functional areas |
| `gitnexus://repo/TCB/processes` | All execution flows |
| `gitnexus://repo/TCB/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
