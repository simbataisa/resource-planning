# Sized data-platform assumptions — design

Date: 2026-11-16 · Status: approved 2026-11-16 · ADR: [ADR-0019](../../adr/0019-sized-data-platform-assumptions.md)

## Intent

The "Data platform (Data Lake, Data Warehouse, ETL)" assumption section sizes data tests with three single values. Every data test costs the same whatever its complexity. Feeds, pipelines, tables and reports are already counted as Simple, Medium and Complex, but that split is lost when minutes and hours are applied. This change gives the three assumptions Simple / Medium / Complex sizes, like the other t-shirt-sized assumptions (`minutes`, `dFeed`, `ptScript`). It also lets QE leads enter mapped columns and data quality (DQ) rules by complexity, so the largest group of data tests can carry the new sizes.

## Goals

- These three assumptions become size triples `[Simple, Medium, Complex]`:
  | Path | Label | Today | New default |
  |---|---|---|---|
  | `dataDesign` | Design minutes per data test (SQL comparison) | 10 | **[10, 15, 25]** |
  | `dataExec` | Execution and analysis minutes per data test per load cycle | 5 | **[5, 8, 12]** |
  | `dataPrepHours` | Data preparation and environment refresh hours per feed per cycle | 2 | **[2, 3, 5]** |
- Detailed-scope inputs `data.columns` and `data.dq` become `[S, M, C]` counts, like `data.feed`.
- The prototype `SIT_Sizing_Model.html` and the app agree, and `pnpm --filter @sit/engine parity` passes against the updated reference.
- Existing saved versions and profiles keep their exact numbers.

## Non-goals

- `dCol` (1.5 cases per mapped column) and `dDq` (2 cases per DQ rule) stay single values. Complexity changes how long a check takes, not how many checks a column or rule needs. Sizing these as well would count complexity twice.
- `secured` × `accessRoles` (access checks) stays a single count in the Simple bucket.
- SCD dimensions stay in the Medium bucket.
- No new rough-scope proxies.
- No other assumption or formula changes.

## Anti-goals

- An old saved version or published profile that recomputes to a different number.
- A profile row that fails `Assumptions.parse` after deploy.
- An increase in the row count. It stays at **142**, because a row is a top-level path and a triple is one row, as `minutes` already is.

## Formulas (engine and prototype)

`b` ∈ {0 Simple, 1 Medium, 2 Complex}. `arr[b]` is a data group's test count in bucket `b`.

- Data-test minutes for each data group except `dataReport` and `dataPrep`:
  `min = Σ_b arr[b] × (dataDesign[b] × (1 − aiCut) + dataExec[b] × dataExecF)`.
  `dataExecF = dataCycles × (1 + retest) × env` is unchanged.
- Preparation: `min = dOn ? Σ_b feed[b] × dataPrepHours[b] × dataCycles × 60 : 0`.
- `dataMapping = bands(b => cr(dqC, columns[b] × dCol, columns[b] × dCol × dataSample))`.
- `dataQuality` follows the same rule, with `dq` and `dDq`. Credit and sampling apply to each bucket. The previous totals equal the Simple-only special case.
- `dOn` uses `sum3(columns)` and `sum3(dq)` instead of the scalars.
- Rough scope: a data feature adds its `columns` and `dq` proxies to bucket `cx` of that feature, as feeds, pipelines, tables and reports already do. `scd` and `secured` stay scalar. This raises rough estimates for Medium and Complex data features, which is intended.
- Sensitivity bar "Data test minutes": scales all six values (`dataDesign[b]`, `dataExec[b]`).
- Derived/explanation rows (prototype `derived` text, app `derived.ts` / `derived-formulas.ts`):
  - The preparation row shows the triple: `{n} feeds × {h} h by complexity × {c} load cycles`, with `h` = `2/3/5`.
  - The mapping and DQ rows show the triple counts.
- Calendar check (`dataCycles × dataDaysPerCycle`): unchanged.

With the new defaults, Simple equals today's value. An estimate whose data tests sit only in Simple keeps its numbers; that covers every column and DQ check today. Golden cases change when they have Medium or Complex feeds, pipelines or tables, or SCD dimensions (these sit in Medium). Reports (`dataReport`) use application rates and don't change.

## Versioning and migration

- `ENGINE_VERSION` goes from `1.0.0` to **`1.1.0`**. Stored results keep the version they were stamped with. They are never recomputed silently.
- `INPUTS_SCHEMA_VERSION` goes from 1 to **2**. `UPGRADES[1]` does the following:
  - `assumptions.dataDesign | dataExec | dataPrepHours`: a number `v` becomes `[v, v, v]`. Arrays are left as they are, so the step is idempotent.
  - `inputs.detail.data.columns | dq`: a number `n` becomes `[n, 0, 0]`.
  - Old versions read through `server/stored.ts` therefore recompute to exactly their old numbers.
  - The step ships with a v1 fixture (the existing `golden/stored/v1-example.json`) and a test that compute(upgraded v1) equals the stored v1 result.
- Profiles have no schema version. A new Prisma migration `2026111X000000_sized_data_assumptions` rewrites `AssumptionProfile.values` in SQL, but only for keys that still hold a number (`jsonb_typeof = 'number'`), so it is idempotent:
  - A value still equal to the old default (`dataDesign` 10, `dataExec` 5, `dataPrepHours` 2) becomes the **new default triple**. The row stays uncalibrated, so `isDefaultRow` still matches it. This covers the seeded "Default (uncalibrated)" global profile.
  - Any other value `v` (a calibrated row) becomes `[v, v, v]`.
  - Profiles hold no inputs, so `columns` and `dq` don't apply.
  - Calibration JSON is keyed by path and doesn't change.
  - Effect: only future drafts that apply a profile with default rows get the new sizes. Existing drafts and saved versions carry their own copies.
  - Prisma migrations have no down step. The runbook gets a rollback snippet that converts `[a,b,c]` back to `a`, which is valid only while all three are equal.
- Prototype backward compatibility:
  - The prototype's `loadProfile` (localStorage and imported JSON) expands legacy shapes before `merge`. Otherwise `merge` silently drops a type-mismatched scalar and puts the new defaults in its place.
  - The app's `prototype-import.ts` does the same expansion before `mergeShape`.
  - The legacy expansion lives in one shared helper in `@sit/schemas` (`expandLegacyDataShapes`), used by `UPGRADES[1]` and `prototype-import.ts`. The prototype has its own inline copy.

## Approaches considered

1. **Triples plus read-time upgrade for versions and a SQL data migration for profiles (chosen).** This uses the existing `upgradeStored` mechanism and leaves the profile read path untouched.
2. **A schema that accepts either a scalar or a triple and normalises on parse.** Rejected. It blurs the API contract, and `dto.ts` casts profile values without parsing, so it would not help there.
3. **Read-time upgrade for profiles (a new `schemaVersion` column on profiles).** Rejected. It touches every profile read path, and the user chose a data migration.

## Surfaces to change

| Area | Change |
|---|---|
| `SIT_Sizing_Model.html` | DEFAULTS, ROWS (`cols:CX`), compute, SENS, derived text, rough `counts`, detailed-scope data inputs for columns and DQ (S/M/C), legacy expansion in `loadProfile`, VI dictionary for new or changed strings |
| `sit-sizing-reference/prototype-engine-and-ui.js` | Re-extracted from the HTML script, byte-identical. `vi-translations.json` updated if the dictionary changed. `golden-example.json` regenerated |
| `packages/schemas` | `assumptions.ts`: the three paths become `Triple`. `inputs.ts`: `columns` and `dq` become `Triple`. `upgrade.ts`: version 2 and `UPGRADES[1]` |
| `packages/engine` | `defaults.ts`, `data-platform.ts`, `effort.ts`, `counts.ts` (rough), `sensitivity.ts`, `derived.ts`, `version.ts`, `catalogue.ts` if it records shape, `tools/random-inputs.mjs`, the affected tests. Goldens regenerated with `pnpm --filter @sit/engine golden:generate` |
| `packages/db` | New data migration. Seed values come from `DEFAULT_ASSUMPTIONS` (check). `schema.prisma` comment unchanged (still 142) |
| `apps/web` | `lib/assumption-meta.ts`: the three rows get `cols` (S/M/C). Detailed-scope tab: columns and DQ as S/M/C inputs. Results and derived formulas. Export: the workbook writes the triples in the same way as other triples. EN/VI messages. `openapi.json` regenerated |
| `apps/mcp` | Regenerate `src/generated/*` (assumption rows, messages, glossary). `describe_assumptions` then shows sizes and `describe_inputs` the new input shape |
| `docs/i18n` | `assumption-help-draft.md`: new explanations for the three rows and the two inputs, marked as needing approval. Removed from `assumption-help-approved.json` until a QE lead re-approves. VI goes through `pnpm i18n:review` |
| `docs/adr/0019-…` | The decision, the numbers and the human approval |
| `SIT_Sizing_Model_Solution_Design.md` | The data-platform formula, `ENGINE_VERSION` 1.1.0 and schema version 2 notes. Revision bumped |
| `docs/engine-findings.md`, runbook | A note on the change, plus the profile-migration rollback |

## Constraints

- AGENTS.md rule 3: ADR plus human approval before any number changes. Goldens are updated in the same PR, with the ADR linked.
- Sensitive paths `packages/engine` and `packages/db/prisma/migrations` need a named human reviewer. The PR ticks the box.
- The full suite must pass before merge, plus parity.
- API break: the `EstimateInputs.detail.data.columns` and `dq` fields and the assumption field shapes change in the contract. The only clients are the web app and the MCP server, both in this repository, so the break is accepted in the ADR.
- Never touch the running `sit-sizing` compose stack. Integration tests use Testcontainers.

## Delivery batches (user decision)

1. **PR 1:** `SIT_Sizing_Model.html`, this spec and the ADR. The reference copy is not touched yet, so `parity` stays green on main.
2. **PR 2:** schemas, engine, `sit-sizing-reference/` re-extract, goldens, `UPGRADES[1]`, the profile migration, the `expandLegacyDataShapes` helper and prototype import, plus the minimum `apps/web` and `apps/mcp` changes so the type check and tests pass. EN/VI keys for any UI it adds. `openapi.json` regenerated. This batch has to be atomic: the schema shape change breaks the type check everywhere at once.
3. **PR 3:** the derived and help texts (EN/VI, help draft), MCP generated files, the export check, and updates to the solution design, the runbook and `engine-findings.md`.

## Settled in review (author's calls)

- No S ≤ M ≤ C rule on the new triples. This matches the existing triples, which only check non-negative values.
- A stale client that sends the old shape gets a 400. There's no shim on the API, because the web app and the MCP server ship together.
- `assumption-help-approved.json` approves no rows today, so no help is withdrawn. The new texts go into the draft as "needs approval".
- Tests read the expected sizes from `DEFAULT_ASSUMPTIONS` rather than hard-coding them.

## Builder's calls

- Exact EN wording for the new derived and help strings, following the prototype's existing patterns.
- The VI wording is a draft, reviewed through `pnpm i18n:review`.
- Test case layout.
- Whether to add a dedicated golden case for "sized data tests". Recommended: yes, `data-sized.json`, with non-zero Medium and Complex columns and DQ rules.
