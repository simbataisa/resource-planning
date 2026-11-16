# Custom Feature Sizes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feature sizes become profile data that QE Leads and Admins edit in draft profiles. Estimates copy them on apply, and are blocked when their features use a size the profile lacks.

**Architecture:**
- `Assumptions` gains an ordered `sizes` list and `sizeNotes`. The four size tables become records whose keys must equal `sizes`.
- The engine derives assumption paths and row totals from `sizes` and counts custom-size rows with the copied notes.
- Server services enforce:
  - the apply block;
  - copying the notes;
  - the size-list guard on autosave and save.
- The profile editor gets a size section.

**Tech Stack:** TypeScript, Zod 4, Next.js 16 route handlers and services, Prisma/Postgres, next-intl, Vitest, Testcontainers, Playwright.

**Spec:** `sit-sizing-app/docs/superpowers/specs/2026-11-16-custom-sizes-design.md`

**Base:** branch `feat/custom-sizes`, which is built on `feat/more-feature-sizes` (ADR-0020). Rebase onto `main` once ADR-0020 merges.

## Global Constraints

- Size name: trimmed, 1–6 characters from `[A-Za-z0-9+-]`, unique within a profile, case-sensitive. Never `.`.
- A profile or estimate has 1 to 20 sizes. The order is the order of `sizes`.
- Built-in names are the ten in `SIZES`: `XXS, XS, S, M-, M, M+, L, XL, XXL, XXXL`. Built-in status follows the name.
- `ptRoughScen` stays one row. There are 130 fixed rows, so the row total is 130 + 3 × `sizes.length` (160 with the defaults).
- No formula changes and no default value changes. Goldens and parity must stay identical. `ENGINE_VERSION` becomes `1.3.0`.
- Merged migrations are never edited. SQL comments contain no `;`, because the integration helper splits on it.
- Every user-facing string is in `en.json` and `vi.json`. Use synthetic data only.
- Full suite before each PR, from `sit-sizing-app/`:
  - `pnpm check`
  - `pnpm test:coverage`
  - `pnpm test:int`
  - `pnpm test:e2e`
  - `pnpm --filter @sit/engine parity` (PR 1)
- Sensitive paths (engine, migrations) need a named human reviewer. Tick the box in the PR template.

## Review Focus

1. **Renaming a size to a name that already exists.** It is refused, and nothing changes. Tested in Task 6.
2. **Removing the last size.** It is refused, because at least one size must remain. Tested in Task 1 (schema) and Task 6 (helper).
3. **Applying a profile to a draft that has sizes the profile lacks, but no features use them.** It is allowed; the draft's sizes become the profile's. Tested in Task 4.
4. **Removing a size that has calibration notes.** The notes go with it, so the next profile save is not refused with 422. Tested in Task 6.
5. **Sensitivity with custom sizes.** The `proxies` factor scales every size in `sizes`, not only the ten built-in ones. Tested in Task 2.

---

## PR 1: schema, engine and stored data

### Task 1: Schemas: sizes become data

**Files:**
- Modify:
  - `packages/schemas/src/common.ts`
  - `packages/schemas/src/assumptions.ts`
  - `packages/schemas/src/inputs.ts`
  - `packages/schemas/src/api.ts` (move `CalibrationEntry` out)
  - `packages/schemas/src/upgrade.ts`
  - `packages/schemas/src/index.ts`
- Test:
  - `packages/schemas/src/assumptions.test.ts`
  - `packages/schemas/src/upgrade.test.ts`

**Interfaces:**
- Produces:
  - `SizeName: z.ZodString` (regex `/^[A-Za-z0-9+-]{1,6}$/` after trim).
  - `SIZES` stays (built-in names). `Size` is now an alias of `SizeName`.
  - `CalibrationEntry` now lives in `assumptions.ts` and is re-exported from `api.ts`.
  - `Assumptions` gains `sizes: string[]` and `sizeNotes: Record<string, CalibrationEntry>` (default `{}`).
  - `proxies`, `dproxies`, `aproxies` and `ptRoughScen` become `z.record(SizeName, …)`.
  - `INPUTS_SCHEMA_VERSION = 4`. `UPGRADES[3] = addSizeList`.
  - `addSizeList(p: StoredPayload): StoredPayload`.

- [ ] **Step 1: Write failing tests** in `assumptions.test.ts`:
  - `accepts a custom size`: defaults plus `sizes` with `'XS2'` added and matching rows parse.
  - `rejects a size table whose keys differ from sizes`: a missing key or an extra key is an error with path `['proxies']`.
  - `rejects duplicate sizes`, `rejects 0 sizes`, `rejects 21 sizes`.
  - `rejects a name with a dot or longer than 6 characters`.

  In `upgrade.test.ts`, add `addSizeList orders sizes by SIZES and adds empty sizeNotes`. A v3 payload whose `proxies` keys are in jsonb order (`L, M, S, ...`) gets `sizes` equal to `SIZES` and `sizeNotes: {}`. An already-upgraded payload is left alone.
- [ ] **Step 2: Run** `pnpm vitest run --project schemas`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - The cross-field rules (unique names; each table's keys equal `sizes`) go in one `superRefine` on `Assumptions`.
  - `addSizeList` sets `sizes` to the names in `SIZES` that are present in `proxies`, in `SIZES` order.
  - Change the comment saying 160 to "130 fixed rows plus 3 per size".
- [ ] **Step 4: Run** `pnpm vitest run --project schemas`. Expected: PASS.
- [ ] **Step 5: Commit** `Schemas: sizes are an ordered list in the assumptions (custom sizes)`.

### Task 2: Engine: paths, calibration and sensitivity follow `sizes`

**Files:**
- Modify:
  - `packages/engine/src/catalogue.ts`
  - `packages/engine/src/calibration.ts`
  - `packages/engine/src/sensitivity.ts`
  - `packages/engine/src/snapshot.ts`
  - `packages/engine/src/defaults.ts`
  - `packages/engine/src/prototype-import.ts`
  - `packages/engine/src/version.ts`
  - `packages/engine/src/index.ts`
- Modify (golden harness): `packages/engine/tools/prototype-harness.mjs` and `tools/parity-check.mts`. Add `sizes: P.SIZES` and `sizeNotes: {}` when building assumptions from the prototype.
- Create: `packages/engine/src/sizes.ts` and `packages/engine/src/sizes.test.ts`
- Create: `docs/adr/0021-custom-feature-sizes.md`
- Test:
  - `calibration.test.ts`
  - `sensitivity.test.ts`
  - `snapshot.test.ts`
  - `catalogue.test.ts`

**Interfaces:**
- Consumes: Task 1 `Assumptions`.
- Produces:
  - `FIXED_ASSUMPTION_PATHS: readonly string[]`: the 130 paths, with `ptRoughScen` included.
  - `assumptionPaths(a: Pick<Assumptions, 'sizes'>): string[]`: fixed paths, then `dproxies.<s>`, `aproxies.<s>` and `proxies.<s>` for each size in order.
  - `ASSUMPTION_PATHS` stays, as `assumptionPaths(DEFAULT_ASSUMPTIONS)`.
  - `isBuiltInSize(name: string): boolean`.
  - `customSizePaths(a: Pick<Assumptions, 'sizes'>): string[]`.
  - `uncalibratedCount(a: Assumptions, defaults: Assumptions, notes: Record<string, unknown> = a.sizeNotes): number`.
  - `unknownFeatureSizes(inputs: EstimateInputs, a: Pick<Assumptions, 'sizes'>): { size: string; features: number }[]`.
  - `sameSizeSet(a: Assumptions, b: Assumptions): boolean`. It is true when `sizes` (in order) and every table's key set are equal.
  - `versionSnapshot(...)` also returns `assumptionRows: number`.

- [ ] **Step 1: Write failing tests.**
  - `catalogue.test`: `FIXED_ASSUMPTION_PATHS.length === 130` and `assumptionPaths(DEFAULT_ASSUMPTIONS).length === 160`. A 3-size set gives 139.
  - `calibration.test`:
    - (a) Defaults → 160.
    - (b) Defaults plus custom `'XS2'`, no notes → 163.
    - (c) The same with notes on all three `XS2` paths → 160.
    - (d) `ptRoughScen` with an extra custom key and unchanged built-in values still counts as default.
    - (e) Removing `XXS` from defaults → 157.
  - `sizes.test`:
    - `unknownFeatureSizes` groups features by missing size (2 × `XXL` → `[{size:'XXL',features:2}]`).
    - `sameSizeSet` is false after a reorder and false after a key is added to one table.
  - `sensitivity.test`: with custom size `'Z'` in `sizes`, the `proxies` factor at k = 1.1 scales `proxies.Z.screen`.
  - `snapshot.test`: `assumptionRows === 160` for defaults.
- [ ] **Step 2: Run** `pnpm vitest run --project engine`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - Sensitivity loops over `A.sizes`.
  - `prototype-import` sets `sizes: [...SIZES]` and `sizeNotes: {}`.
  - Defaults add the same two fields.
  - `version.ts` becomes `'1.3.0'`, with a history line.
- [ ] **Step 4: Regenerate the goldens** with `node packages/engine/tools/generate-golden.mjs`. Check with `git diff packages/engine/golden`: only `sizes`/`sizeNotes` are added, and no `expected` value changes.
- [ ] **Step 5: Run**
  - `pnpm vitest run --project engine`
  - `pnpm --filter @sit/engine parity`

  Expected: PASS, and parity reports "bit-identical".
- [ ] **Step 6: Write ADR-0021.** It records:
  - the decisions in the spec;
  - the row-total formula;
  - the calibration rule;
  - engine 1.3.0;
  - that the golden and parity tests cover the defaults only.
- [ ] **Step 7: Fix the compile fallout.** Run `pnpm check`. `Size` is now a string, so callers that relied on the enum fail to type-check. The fix is a cast-free switch to `string`. The UI still uses `SIZES` until Task 7.
- [ ] **Step 8: Commit** `Engine: sizes come from the assumptions (ADR-0021, engine 1.3.0)`.

### Task 3: Profile data migration

**Files:**
- Create: `packages/db/prisma/migrations/20261123000000_custom_sizes_profiles/migration.sql`
- Create: `apps/web/tests/integration/profiles-custom-sizes-migration.test.ts`. Copy the helper pattern from `profiles-feature-sizes-migration.test.ts`.

- [ ] **Step 1: Write the failing integration test.**
  - A profile seeded without `sizes` gets `values.sizes` equal to the ten names in `SIZES` order, and `values.sizeNotes = {}`.
  - A profile seeded with only `S, M` in `proxies` gets `["S","M"]`.
  - Running the migration twice changes nothing.
- [ ] **Step 2: Run** `pnpm --filter @sit/web exec vitest run --config vitest.integration.config.ts tests/integration/profiles-custom-sizes-migration.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the SQL.**
  - `UPDATE "AssumptionProfile"` sets `values = values || jsonb_build_object('sizes', <array>, 'sizeNotes', '{}'::jsonb)` `WHERE NOT (values ? 'sizes')`.
  - `<array>` is built from a `VALUES` list of the ten names with an ordinal, filtered by `values->'proxies' ? name`, ordered by ordinal.
- [ ] **Step 4: Run the test again.** Expected: PASS.
- [ ] **Step 5: Run the full suite** (Global Constraints). Commit `DB: give stored profiles an ordered size list`, then open PR 1.

## PR 2: services, totals and contract

### Task 4: Apply block, note copying and the size guard

**Files:**
- Modify:
  - `apps/web/server/domain/profiles.ts`
  - `apps/web/server/services/profiles.ts`
  - `apps/web/server/services/estimates.ts`
  - `apps/web/server/services/versions.ts`
  - `apps/web/server/dto.ts`
  - `packages/schemas/src/api.ts`
- Test:
  - `apps/web/server/domain/profiles.test.ts`
  - `apps/web/tests/integration/profiles.test.ts`
  - `apps/web/tests/integration/draft-workflow.test.ts`

**Interfaces:**
- Consumes: Task 2 `unknownFeatureSizes`, `customSizePaths`, `sameSizeSet`, `assumptionPaths` and `uncalibratedCount`.
- Produces:
  - `unknownCalibrationPaths(calibration: Record<string, unknown>, values: Assumptions): string[]`. This replaces the fixed `KNOWN` set.
  - `Profile` DTO gains `assumptionRows: number`. Its `uncalibrated` uses `uncalibratedCount(values, DEFAULT_ASSUMPTIONS, calibration)`.
  - 409 `SIZE_NOT_IN_PROFILE`, with `details: { size: string; features: number }[]`.

- [ ] **Step 1: Write failing tests.**
  - Domain: `unknownCalibrationPaths` accepts `proxies.XS2` when `XS2` is in `values.sizes`, and rejects it otherwise.
  - Integration, `profiles.test.ts`:
    - (a) Applying a profile without `XXL` to a draft with 3 `XXL` features → 409 `SIZE_NOT_IN_PROFILE`, details `[{size:'XXL',features:3}]`, and the draft is unchanged.
    - (b) **Review Focus 3:** the draft has sizes the profile lacks, but no features use them → 200, and the draft's `sizes` equal the profile's.
    - (c) A profile with custom `XS2` and notes on its three paths, when applied, gives the draft `sizeNotes` with exactly those three keys. Its stored `uncalibrated` equals the profile's.
  - Integration, `draft-workflow.test.ts`:
    - (d) A PATCH that changes `sizes` → 422.
    - (e) A PATCH with a feature of size `'Q'` that is not in `sizes` → 422.
    - (f) Saving a version applies the same two checks.
- [ ] **Step 2: Run** the two integration files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - In `applyProfile` and `createEstimate` (when a profile is used): run `unknownFeatureSizes` against the draft inputs first. On apply and on create, set `values.sizeNotes` to the profile's calibration filtered to `customSizePaths(values)`.
  - In `patchDraft` and `saveVersion`: refuse with 422 when `!sameSizeSet(stored, incoming)`, and when `unknownFeatureSizes(inputs, assumptions)` is not empty.
  - Messages are synthetic and in English; the API returns codes, not UI text.
- [ ] **Step 4: Run** the integration files. Expected: PASS.
- [ ] **Step 5: Commit** `Profiles: block apply on missing sizes, copy size notes, guard draft sizes`.

### Task 5: Per-estimate row totals: DB, portfolio, export, MCP and OpenAPI

**Files:**
- Create: `packages/db/prisma/migrations/20261123010000_assumption_rows/migration.sql`. It runs `ALTER TABLE "EstimateVersion" ADD COLUMN "assumptionRows" INTEGER NOT NULL DEFAULT 160`.
- Modify:
  - `packages/db/prisma/schema.prisma`
  - `packages/db/src/seed.ts`
  - `apps/web/server/services/{estimates,versions,portfolio}.ts`
  - `apps/web/server/domain/portfolio.ts`
  - `packages/schemas/src/api.ts`: `PortfolioRow.assumptionRows`; remove `Portfolio.assumptionRows`.
  - `apps/web/server/export/workbook.ts`
  - `apps/mcp/src/tools/understand.ts`
  - `apps/mcp/src/glossary.ts`
  - `apps/web/server/openapi/operations.ts`
  - `docs/api/openapi.json`
- Test:
  - `apps/web/server/domain/portfolio.test.ts`
  - `apps/web/tests/integration/portfolio.test.ts`
  - `apps/web/server/export/workbook.test.ts`
  - `apps/mcp/src/tools/understand.test.ts`

**Interfaces:**
- Consumes: `versionSnapshot().assumptionRows` and `assumptionPaths`.
- Produces: the signature `totals(rows: PortfolioRow[]): PortfolioTotals` and `rollUp(rows, status)`. `onDefaults` uses `r.uncalibrated >= r.assumptionRows`.

- [ ] **Step 1: Write failing tests.**
  - Portfolio domain: a row with 163/163 counts as on defaults, and a row with 160/163 does not.
  - Workbook: an estimate with sizes `S, M` lists 136 assumption rows, and its summary shows `x / 136`.
  - MCP: `describe_assumptions` for a profile with `XS2` lists `XS2` among the size options.
  - Integration portfolio: a version saved with 3 sizes stores `assumptionRows = 139`.
- [ ] **Step 2: Run** each file. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Every `versionSnapshot` write stores `assumptionRows`.
  - The workbook iterates `assumptionPaths(src.assumptions)`.
  - The MCP glossary's size options come from the given assumptions. With none given, they are the defaults.
  - Register the 409 `SIZE_NOT_IN_PROFILE` response on the apply and create operations, with a synthetic example.
  - Run `pnpm openapi:generate`.
- [ ] **Step 4: Run** each file, then `pnpm --filter @sit/mcp glossary`. Expected: PASS, and the regenerated rows still number 160.
- [ ] **Step 5: Run the full suite.** Commit `Portfolio, export, MCP: assumption rows per estimate`, then open PR 2. The PR notes that `OPENAPI_BREAKING_APPROVED` is needed (the `Size` enum becomes a string, and `Portfolio.assumptionRows` moves to the rows).

## PR 3: the size editor and the screens

### Task 6: Pure size-editing helpers

**Files:**
- Create: `apps/web/lib/profile-sizes.ts`, `apps/web/lib/profile-sizes.test.ts`

**Interfaces:**
- Produces, each returning a new `{ values, calibration }` or `{ error: 'NAME_TAKEN' | 'BAD_NAME' | 'LAST_SIZE' | 'TOO_MANY' }`:
  - `addSize(values, calibration, name: string, copyFrom: string)`
  - `removeSize(values, calibration, name: string)`
  - `renameSize(values, calibration, from: string, to: string)`
  - `moveSize(values, calibration, name: string, dir: -1 | 1)`

- [ ] **Step 1: Write failing tests.**
  - `addSize` copies all four table entries from `copyFrom`. A 21st size → `TOO_MANY`.
  - `renameSize` moves the entries in all four tables and the notes on `proxies|dproxies|aproxies.<from>` to `<to>`.
  - **Review Focus 1:** renaming to an existing name → `NAME_TAKEN`, and the input is unchanged.
  - **Review Focus 2:** removing the only size → `LAST_SIZE`.
  - **Review Focus 4:** `removeSize` drops that size's notes, and the result has no unknown calibration paths.
  - `moveSize` at either end is a no-op.
- [ ] **Step 2: Run** `pnpm vitest run --project web apps/web/lib/profile-sizes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Validate names with `SizeName.safeParse`.
- [ ] **Step 4: Run it again.** Expected: PASS.
- [ ] **Step 5: Commit** `Profiles: size add, remove, rename and move helpers`.

### Task 7: Screens

**Files:**
- Modify:
  - `apps/web/components/features/profiles/profile-editor.tsx` (size section, drafts only)
  - `profile-list.tsx` (`{p.uncalibrated} / {p.assumptionRows}`)
  - the apply-profile dialog under `components/features/estimate-editor/` (show the 409 details)
  - `rough-scope-tab.tsx` (options from `assumptions.sizes`)
  - `summary-cards.tsx` and `export-panel.tsx` (total from `assumptionPaths(assumptions).length`)
  - `apps/web/lib/assumption-meta.ts`: `ASSUMPTION_META` becomes `assumptionMeta(sizes: readonly string[]): MetaGroup[]`
  - `apps/web/messages/en.json`, `vi.json`, `docs/i18n/assumption-help-draft.md`
- Test:
  - `apps/web/components/features/profiles/profiles.test.tsx`
  - `assumption-meta.test.ts`
  - the rough-scope tab test
  - `tests/unit/prototype-ui-parity.test.tsx` (must stay green unchanged)

**Interfaces:**
- Consumes:
  - Task 6 helpers;
  - Task 4 `Profile.assumptionRows` and the 409 details;
  - Task 2 `assumptionPaths`.
- Produces:
  - Message keys `assumptionsTab.help.sizeRow.proxies|dproxies|aproxies`, with `{size}`.
  - `profiles.sizes.{title,add,remove,rename,moveUp,moveDown,copyFrom,name,errors.*}`.
  - `profiles.apply.sizeMissing`, with `{size}` and `{count}`.
  - The 18 per-size help keys from ADR-0020 are removed.

- [ ] **Step 1: Write failing component tests.**
  - The editor on a draft shows "Add size". Adding `XS2` copied from `S` puts a row in the list.
  - A published profile shows the sizes without edit buttons.
  - The rough-scope picker lists a custom size.
  - `assumptionMeta(['S','Z'])` has 136 rows, and `Z` uses the generic help.
  - The apply dialog renders "3 features use XXL…" from a 409.
- [ ] **Step 2: Run** `pnpm vitest run --project web`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Reuse the existing patterns and `CollapsibleSection`.
  - Every button has a label; the move buttons are keyboard reachable.
  - Write the EN and VI text, then run `pnpm i18n:review`.
- [ ] **Step 4: Run** `pnpm vitest run --project web`, including `prototype-ui-parity`. Expected: PASS.
- [ ] **Step 5: Commit** `Profiles: edit sizes in draft profiles; screens follow the estimate's sizes`.

### Task 8: End-to-end

**Files:**
- Create: `apps/web/tests/e2e/custom-sizes.spec.ts`. Reuse `helpers.ts` and `openAssumptionGroup`.

- [ ] **Step 1: Write the spec.** As a synthetic QE Lead:
  1. Clone the published profile into a draft.
  2. Add size `XS2` copied from `XS`, then publish.
  3. Apply the profile to a draft estimate.
  4. Check that the rough-scope picker offers `XS2`.

  Then remove `XXL` in a new draft, publish, and apply it to an estimate that has an `XXL` feature. The block message appears and the estimate is unchanged.
- [ ] **Step 2: Run the spec** against the stack:
  - `pnpm dev:up`, in the worktree's own compose project, never the user's `sit-sizing` stack;
  - then `pnpm --filter @sit/web exec playwright test tests/e2e/custom-sizes.spec.ts`.

  Expected: PASS.
- [ ] **Step 3: Run the full suite.** Commit `E2E: custom sizes in a profile`, then open PR 3.
