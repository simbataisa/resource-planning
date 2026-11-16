# ADR-0021: Feature sizes are profile data

|                           |                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **Status**                | Accepted (design approved by the requester on 2026-11-16); named review pending           |
| **Date**                  | 2026-11-16                                                                                |
| **Deciders**              | Product owner, QE lead; tech lead; named reviewer for `packages/engine` and migrations    |
| **Backlog / design refs** | Design 6.4, 6.6, 7; ADR-0008 (profiles), ADR-0013 (upgrade on read), ADR-0020 (ten sizes) |
| **Design**                | `docs/superpowers/specs/2026-11-16-custom-sizes-design.md`                                |

## Context

To the engine a rough-scope size is only a lookup key: driver counts in `proxies`, `dproxies` and `aproxies`, and a scenario count in `ptRoughScen`. No formula treats one size differently from another. Yet the list of sizes was a constant in code, so each new size needed an engine release, golden files and a migration (ADR-0020). Sizes are calibration data and belong with the other assumptions, in profiles that QE leads already own.

## Decision

1. **Shape.** `Assumptions` gains `sizes`, an ordered list of 1 to 20 names, and `sizeNotes`. A name is 1 to 6 letters, digits, `+` or `-`, unique, case-sensitive; no `.`, because it appears in paths such as `proxies.M+`. The four size tables are records whose keys must equal `sizes`. The list carries the order, because Postgres `jsonb` does not keep key order.
2. **Who edits.** Sizes are edited only in draft profiles, like every other value (ADR-0008 rule 1): QE Lead for project profiles, Admin for global ones. A new size starts as a copy of an existing one, never blank.
3. **Applying a profile.** If any rough-scope feature of the draft uses a size the profile lacks, the apply is refused with 409 `SIZE_NOT_IN_PROFILE`, listing each missing size and its feature count. Nothing changes; the estimator resizes those features first. An estimate's sizes change only by applying a profile: autosave and save refuse any other change (422), and a feature whose size is not in the estimate's list (422).
4. **Rows and calibration.** There are 130 fixed rows (`ptRoughScen` is one of them) plus 3 per size, so 160 with the ten built-in sizes. Fixed rows and rows of a built-in name count as calibrated when they differ from the engine default, as before. Rows of a custom name count as uncalibrated until a calibration note exists for them: on a profile its own notes, on an estimate the notes copied into `sizeNotes` when the profile was applied. `ptRoughScen` is judged by its built-in names only. Each saved version stores its own row total next to `uncalibrated`.
5. **Built-in names stay.** `SIZES` remains the default list and the ten built-in names. Renaming a built-in size makes it custom.
6. **Engine 1.3.0.** No formula and no default value changes. The golden files are unchanged: they keep the prototype's shape, and the test adds the size list as the stored-payload upgrade does. Parity still runs on the ten defaults; custom sizes are covered by the engine's own tests.
7. **Stored data.** Schema version 4 adds the list on read to stored estimates (the built-in names present, in built-in order). A data migration adds it to stored profiles. No number changes.
8. **The HTML prototype keeps its fixed ten sizes.** Custom sizes are an app feature.

## Consequences

- The API's `Size` is a constrained string, not an enum: the OpenAPI document changes (`OPENAPI_BREAKING_APPROVED`).
- Help texts for size rows are one generic text per table with the size filled in, replacing the 18 per-size texts from ADR-0020.
- Older releases cannot read schema-4 versions (409), as with every schema bump.
