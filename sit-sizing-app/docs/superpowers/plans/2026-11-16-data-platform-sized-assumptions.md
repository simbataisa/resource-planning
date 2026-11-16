# Sized data-platform assumptions: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `dataDesign`, `dataExec` and `dataPrepHours` Simple, Medium and Complex sizes, and make mapped columns and DQ rules S/M/C inputs, in both the prototype and the app.

**Architecture:** Triples follow the existing `cols: CX` pattern. Stored versions upgrade on read (`UPGRADES[1]`). Profiles are rewritten by one SQL data migration. The goldens are regenerated from the updated prototype.

**Tech Stack:** Vanilla JS prototype. TypeScript engine. Zod 4. Prisma/Postgres. Next.js and next-intl. MCP generator scripts.

**Spec:** `docs/superpowers/specs/2026-11-16-data-platform-sized-assumptions-design.md`. ADR: `docs/adr/0019-sized-data-platform-assumptions.md`.

## Global Constraints

- New defaults:
  - `dataDesign` = `[10, 15, 25]`
  - `dataExec` = `[5, 8, 12]`
  - `dataPrepHours` = `[2, 3, 5]`
- Old defaults (used by the migration): 10, 5, 2.
- `dCol`, `dDq`, `secured` and `accessRoles` stay scalar. SCD stays in Medium. Reports are unchanged.
- The assumption row count stays at **142**.
- `ENGINE_VERSION` = `'1.1.0'`; `INPUTS_SCHEMA_VERSION` = `2`.
- The worktree is `/Users/dennis.dao/Documents/TCB-data-sized`, on branch `feat/data-sized-assumptions` (PR 1). PR 2 and PR 3 use branches stacked on it.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Don't touch the running `sit-sizing` compose stack.

## Review Focus

1. A prototype localStorage save or exported JSON with the old scalar shape loads with its values expanded, not replaced by defaults. Covered by a test in Task 1 and Task 3.
2. A v1 stored version (`golden/stored/v1-example.json`) recomputes to exactly its stored result after upgrade. Covered in Task 2/3.
3. A profile row equal to the old default becomes the new default triple and stays uncalibrated. A calibrated row becomes `[v,v,v]`. Running the migration twice changes nothing. Covered in Task 4.
4. An estimate with only Simple data tests has identical hours before and after. Covered in Task 3, with a golden case built from `example.json` inputs where columns and DQ are in Simple.
5. A rough data feature at cx = Complex puts its column and DQ proxies in bucket 2. Covered in Task 3 counts tests.

---

## PR 1: prototype, spec and ADR

### Task 1: Prototype `SIT_Sizing_Model.html`

**Files:** Modify `SIT_Sizing_Model.html` (repo root) only. `sit-sizing-reference/` stays untouched until Task 3.

- [ ] **Step 1: Defaults and rows.**
  - DEFAULTS gets the three triples.
  - The three ROWS entries get `cols:CX`.
  - The sample scope `detail.data` gets `columns:[140,0,0]` and `dq:[24,0,0]`.
  - The empty scope gets `columns:[0,0,0]` and `dq:[0,0,0]`.
- [ ] **Step 2: Inputs.**
  - Add `{k:'columns',label:'Mapped columns (source-to-target spec)'}` and `{k:'dq',label:'Data quality rules'}` to `DDRV`, after `table`.
  - Remove the `dd-columns` and `dd-dq` labels and their `DAI_NUM` entries.
  - In rough `counts`, move `columns` and `dq` from the scalar list to the bucket list (`c.data[k][b]`).
- [ ] **Step 3: Compute.**
  - `dOn` uses `sum3(dd.columns)` and `sum3(dd.dq)`.
  - `dataMapping` and `dataQuality` are worked out per bucket with `bands`/`map`, using `cr(dqC, n[b]*dCol, n[b]*dCol*dataSample)`.
  - The data-test minutes are `arr.reduce((t,n,b)=>t+n*(A.dataDesign[b]*(1-aiCut)+A.dataExec[b]*dataExecF),0)`.
  - `dataPrep` is `Σ_b dd.feed[b]*A.dataPrepHours[b]*A.dataCycles*60`.
- [ ] **Step 4: SENS and text.**
  - The "Data test minutes" bar uses `scaleArr` (or a map) on both triples.
  - The derived rows (`dataSource`/`dataPrep` text near line 549) print `A.dataPrepHours.join('/')` with "h by complexity".
  - Summary line 1321 and the explanation text use `sum3(c.data.columns)`.
  - The method text on lines 695–699 says "design min[size] + exec min[size]".
- [ ] **Step 5: Legacy load.**
  - `loadProfile(obj)` calls an inline `expandLegacy(obj)` before `merge`.
  - It turns a numeric `assumptions.dataDesign|dataExec|dataPrepHours` value `v` into `[v,v,v]`.
  - It turns a numeric `scope.detail.data.columns|dq` value `n` into `[n,0,0]`.
- [ ] **Step 6: VI dictionary.** Add VI entries in `#i18n-vi` for every new or changed EN string (the derived template, the method text). Reuse the existing VI wording for "Mapped columns…" and "Data quality rules".
- [ ] **Step 7: Verify.**
  - Extract the script into the scratchpad, then run `PROTOTYPE_PATH=<extract> node -e` with `loadPrototype()`.
  - Expected: `compute(SAMPLE_SCOPE)` with all data counts in Simple gives the same hours as `golden/example.json`.
  - Expected: a scope with `columns:[0,0,100]` gives hours greater than with `[100,0,0]`.
  - Expected: `expandLegacy` on a v1 object gives triples.
  - Open the HTML in the browser pane: the data table shows the Columns and DQ rows, the assumptions table shows three size columns for the three rows, and the console has no errors in EN or VI.
- [ ] **Step 8: Commit.** Commit the HTML, spec, ADR and this plan. Push, and open the compare URL for PR 1.

---

## PR 2: schemas, engine, reference, goldens, migration, minimum app (one atomic batch)

### Task 2: Schemas and the upgrade step

**Files:**

- `packages/schemas/src/assumptions.ts`: the three fields become `Band3`/`Triple`, as `dFeed` is.
- `packages/schemas/src/inputs.ts`: `columns` and `dq` become `Triple`.
- `packages/schemas/src/upgrade.ts`.
- Tests: `upgrade.test.ts`.

**Produces:** `expandLegacyDataShapes(p: StoredPayload): StoredPayload`, which is idempotent; `UPGRADES[1] = expandLegacyDataShapes`; `INPUTS_SCHEMA_VERSION = 2`.

- [ ] Write the failing tests:
  - `upgradeStored(1, v1Payload)` gives `assumptions.dataDesign` = `[10,10,10]` and `inputs.detail.data.columns` = `[140,0,0]`.
  - `expandLegacyDataShapes` applied twice equals applying it once.
  - Payloads that already hold arrays pass through unchanged.
  - Update the "starts at schema version 1" test to version 2.
- [ ] Implement it, run `pnpm vitest run --project schemas` and confirm PASS. Commit.

### Task 3: Engine, reference and goldens

**Files:**

- Engine: `packages/engine/src/{defaults,data-platform,effort,counts,sensitivity,derived,version,prototype-import}.ts`, `tools/random-inputs.mjs` (triples for the three assumptions and the two inputs), `tools/golden-cases.mjs` (add a `data-sized` case).
- Reference: `sit-sizing-reference/prototype-engine-and-ui.js`, re-extracted byte-for-byte from the HTML `<script>` (the IIFE). Also `vi-translations.json` if the dictionary changed, and `golden-example.json`.
- Goldens: regenerated with `pnpm --filter @sit/engine golden:generate`.

- [ ] Write the failing tests:
  - `counts.test.ts`: a rough data feature at cx 2 puts its columns proxy in `data.columns[2]`.
  - `stored-payloads.test.ts`: v1 upgraded and recomputed equals the stored v1 result.
  - `prototype-import.test.ts`: a legacy scalar import is expanded.
  - `version` = `'1.1.0'`.
- [ ] Port the formulas exactly as in Task 1, Step 3. `prototype-import.ts` calls `expandLegacyDataShapes` before `mergeShape`.
- [ ] Re-extract the reference and regenerate the goldens. Review the diff: only data-heavy cases change, `example.json` changes only where it has Medium or Complex data tests, and the report groups don't change.
- [ ] Run `pnpm vitest run --project engine` and `pnpm --filter @sit/engine parity`. Both must pass, with 0 mismatches out of 5000.
- [ ] Commit.

### Task 4: Profile data migration

**Files:**

- Create `packages/db/prisma/migrations/20261120000000_sized_data_assumptions/migration.sql`.
- Test: `apps/web/tests/integration/profiles-migration.test.ts` (Testcontainers).

- [ ] Write the SQL. For each key `k` in (`dataDesign`, 10, `[10,15,25]`), (`dataExec`, 5, `[5,8,12]`), (`dataPrepHours`, 2, `[2,3,5]`), run:
  ```sql
  UPDATE "AssumptionProfile" SET "values" = jsonb_set("values", '{k}',
    CASE WHEN ("values"->>'k')::numeric = <old> THEN '<new>'::jsonb
         ELSE jsonb_build_array("values"->'k', "values"->'k', "values"->'k') END)
  WHERE jsonb_typeof("values"->'k') = 'number';
  ```
- [ ] Write the test:
  - Insert a profile with the old defaults and a calibrated `dataExec: 7`, then run the SQL.
  - Expected: `[10,15,25]`, `[7,7,7]`, `[2,3,5]`.
  - Expected: a second run is a no-op.
  - Expected: `uncalibratedCount` still counts `dataDesign` and `dataPrepHours`.
- [ ] Run it with `pnpm --filter @sit/web exec vitest run --config vitest.integration.config.ts tests/integration/profiles-migration.test.ts` and confirm PASS. Commit.

### Task 5: The minimum app changes to keep the type check green

**Files:**

- `apps/web/lib/assumption-meta.ts`: the three rows get `cols` like `dFeed`.
- `components/features/estimate-editor/detail-scope-tab.tsx`: columns and DQ move into the S/M/C data table, and the scalar fields for them are dropped. The summary uses `sum3`.
- `derived-formulas.ts`, `components/features/results/results-panels.tsx`.
- The export files only if they read the scalars.
- `messages/en.json` and `vi.json`: keys for the new table rows. The VI text comes from the prototype dictionary.
- `docs/api/openapi.json`, through `pnpm openapi:generate`.
- Fixtures or tests that use scalar `columns` or `dq`.

- [ ] Run `pnpm check`. Expected: the type check, lint and unit tests pass, including `tests/unit/prototype-ui-parity.test.tsx`.
- [ ] Commit. Push and open the compare URL for PR 2:
  - Tick the sensitive-path box (engine and migrations).
  - Link ADR-0019.
  - Note that the OpenAPI break needs `OPENAPI_BREAKING_APPROVED`.

---

## PR 3: texts, MCP, export and docs

### Task 6: Texts, MCP and docs

- [ ] EN/VI derived and help strings for the three rows and the two inputs.
  - `docs/i18n/assumption-help-draft.md` entries are marked "needs approval".
  - Run `pnpm i18n:review`.
- [ ] Regenerate the MCP files (`apps/mcp` build-glossary script) and check that `describe_assumptions` shows three sizes for each row. The test fails if the generated files are stale.
- [ ] Export: check that the assumptions sheet writes the triples in the same way as `dFeed` (workbook test).
- [ ] Update `SIT_Sizing_Model_Solution_Design.md` (data-platform formula, engine 1.1.0, schema v2, a revision note), the runbook (profile migration rollback SQL) and `docs/engine-findings.md`.
- [ ] Commit, push, and open the compare URL for PR 3.

### Task 7: Full suite before each merge

- [ ] On each PR's tree, run `pnpm check`, `pnpm test:coverage`, `pnpm test:int`, `pnpm test:e2e` and `pnpm --filter @sit/engine parity`. Report each result in the PR.
