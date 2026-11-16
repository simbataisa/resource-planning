# ADR-0019: Simple / Medium / Complex sizes for data-test minutes and preparation hours

|                           |                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| **Status**                | Accepted (numbers chosen by the requester on 2026-11-16); named review pending                     |
| **Date**                  | 2026-11-16                                                                                         |
| **Deciders**              | Product owner, QE lead (numbers); tech lead; named reviewer for `packages/engine` and migrations   |
| **Backlog / design refs** | Design 6.4 (golden files), 6.6 (engine change policy); ADR-0008 (profiles), ADR-0013 (upgrade on read) |
| **Spec**                  | [`docs/superpowers/specs/2026-11-16-data-platform-sized-assumptions-design.md`](../superpowers/specs/2026-11-16-data-platform-sized-assumptions-design.md) |

## Context

The data-platform section prices each data test with three single values:

- `dataDesign`: 10 design minutes per data test.
- `dataExec`: 5 execution minutes per test per load cycle.
- `dataPrepHours`: 2 preparation hours per feed per cycle.

Feeds, pipelines, tables and reports are counted as Simple, Medium and Complex. The engine sums the three buckets before it applies the minutes, so a Complex pipeline test costs the same as a Simple one. Mapped columns and DQ rules can't be split at all: they're single counts and land in the Simple bucket.

QE leads asked for these three assumptions to be t-shirt sized, like `minutes`, `dFeed` and `ptScript`.

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| A. Triples for the three assumptions; columns and DQ as S/M/C inputs; old data copied to equal sizes (this ADR) | Complexity reaches the largest group of data tests. Old versions and profiles keep their numbers | API shape change. One profile data migration |
| B. Triples only; columns and DQ stay in Simple | Smaller change | Most data tests (columns, DQ) can never use Medium or Complex sizes |
| C. One size multiplier on the existing single values | No shape change | Not how the other sized assumptions work. Profiles can't calibrate each size |

## Decision

Option A.

1. **New defaults** (the values the QE lead chose; Simple equals today's value):

   | Path | Old | New `[S, M, C]` |
   | --- | --- | --- |
   | `dataDesign` (min) | 10 | [10, 15, 25] |
   | `dataExec` (min per load cycle) | 5 | [5, 8, 12] |
   | `dataPrepHours` (h per feed per cycle) | 2 | [2, 3, 5] |

2. **Formulas.**
   - Data-test minutes: `Σ_b tests[b] × (dataDesign[b] × (1 − aiCut) + dataExec[b] × dataCycles × (1 + retest) × env)`.
   - Preparation: `Σ_b feeds[b] × dataPrepHours[b] × dataCycles`.
   - Mapping and DQ cases are worked out per bucket from `columns[b]` and `dq[b]`. `dCol`, `dDq`, the credits and the sampling are unchanged.
   - Rough scope puts a data feature's column and DQ proxies in that feature's complexity bucket.
   - The "Data test minutes" sensitivity bar scales all six values.
3. **Inputs.** `detail.data.columns` and `detail.data.dq` become `[S, M, C]`.
4. **Versions.**
   - `ENGINE_VERSION` becomes 1.1.0.
   - `INPUTS_SCHEMA_VERSION` becomes 2.
   - `UPGRADES[1]` turns each old single assumption `v` into `[v, v, v]`, and `columns` and `dq` from `n` into `[n, 0, 0]`. A version saved with engine 1.0.0 therefore recomputes to exactly its stored result. It still shows the "Computed with engine 1.0" flag (ADR-0013).
5. **Profiles.**
   - A Prisma data migration rewrites `AssumptionProfile.values` in place:
     - A value still equal to the old default becomes the new default triple, and stays uncalibrated.
     - A changed (calibrated) value `v` becomes `[v, v, v]`.
   - This is an exception to "never rewritten in place" (ADR-0013), which covers versions. Profiles have no schema version and are read with a cast, not through `upgradeStored`.
   - Calibrated rows keep their numbers. Uncalibrated default rows adopt the new defaults, which affects only future drafts that apply the profile. Existing drafts and versions keep their own copies.
6. **Prototype files.** Prototype localStorage and exported JSON files are expanded the same way on load, in the prototype and in the app's prototype import.

## Consequences

- **The numbers change** for any estimate with Medium or Complex data tests: feeds, pipelines, tables, and from now on columns and DQ rules. Golden files are regenerated from the updated prototype in the same PR. Estimates with only Simple data tests keep their numbers.
- **Rough estimates for Medium and Complex data features rise.** Their column and DQ proxies now carry Medium and Complex minutes.
- **API break.**
  - `Assumptions.dataDesign`, `dataExec` and `dataPrepHours`, and `EstimateInputs.detail.data.columns` and `dq`, change from number to a three-number array.
  - The only clients are the web app and the MCP server in this repository, and both ship in the same release.
  - The OpenAPI breaking-change gate needs one code-owner approval (`OPENAPI_BREAKING_APPROVED`).
- **Rollback.**
  - An older release can't read migrated profiles or v2 versions. Versions return 409 `NEWER_SCHEMA`.
  - The runbook has a reverse SQL snippet for profiles. It is valid only while each triple's three values are equal.
- **Help texts.** The explanations for the three rows and the two inputs are redrafted. They need QE lead re-approval in `docs/i18n/assumption-help-approved.json`.
- **Unchanged.** The assumption row count stays at 142, because a triple is one row.

## Approval

- [x] Numbers, formulas and migration approved by the requester (Dennis), 2026-11-16
- [ ] QE lead sign-off: ____________
- [ ] Engine and migration reviewed by: ____________ (named reviewer)
