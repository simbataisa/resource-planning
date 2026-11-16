# Custom feature sizes in assumption profiles: design

Date: 2026-11-16. Status: ready for approval. Builds on ADR-0020 (ten sizes), which must merge first.

## Intent and the why

Rough mode sizes a feature by a T-shirt size. To the engine, a size is only a lookup key: it has driver counts in three tables (app `proxies`, data `dproxies`, AI `aproxies`) and a performance-scenario count (`ptRoughScen`). No formula treats one size differently from another (`counts.ts`, `performance.ts`, `sensitivity.ts`).

Today the size list is a constant in code. Every new size has meant an ADR, an engine release, goldens and a migration (ADR-0020 took a full round for six sizes). The sizes are really calibration data. They belong with the other assumptions, in profiles that QE leads already own.

## Goals

- A QE Lead (project profiles) or Admin (global profiles) can add, remove, rename and reorder sizes in a **draft** profile, and set each size's driver counts and scenario count.
- Publishing the profile makes those sizes available. Applying it copies them into an estimate, like every other assumption.
- The rough-scope size picker offers the estimate's own sizes, in the profile's order.

## Non-goals

- No size editing in the estimate editor. Estimators use the sizes their profile gives them.
- No change to any formula or to the ten default sizes' values.
- No size editing in the HTML prototype. It keeps its fixed ten sizes.
- No per-size help text written by leads.

## Anti-goals: failure even if it works

- Applying a profile must never change an estimate's numbers without the estimator choosing to.
- A published profile must never change (ADR-0008 rule 1, design 6.6 rule 6).
- An estimate's sizes must never differ from those of the profile it says it uses.
- Adding a size must not make a profile look more calibrated than it is.

## Approaches considered

1. **An ordered size list in the assumptions, and size-keyed tables (chosen).** The assumptions gain `sizes: string[]`. The four size tables are keyed by those names and must have exactly those keys. The list carries the order, because Postgres `jsonb` does not keep object key order.
2. **Derive the sizes from the keys of the `proxies` table.** This has no new field, but `jsonb` reorders keys (XXL would sort before XXS). It also has no single place where the size list is defined. Rejected.
3. **A relational `ProfileSize` table linked to profiles.** This breaks "copy, don't link" (ADR-0008 rule 5): versions hold their whole assumptions as one payload. It also needs joins in every read path. Rejected.

How sizes are edited:

- **Through draft profiles (chosen by the user).** Clone, edit and publish, like any other value.
- **Editing a published profile directly** was rejected. It breaks profile immutability.

When an estimate uses a size that the profile being applied lacks:

- **Block and explain (chosen by the user).**
- Mapping the sizes in a dialog was rejected.
- Keeping the old size was rejected.

## Decided behaviour

### What a size is

- **Name.** Trimmed, 1 to 6 characters, unique within the profile, case-sensitive. *Builder's call:* letters, digits, `+`, `-`; no `.`, because the name appears in assumption paths like `proxies.M+`.
- **Driver counts.** One row in each of `proxies`, `dproxies` and `aproxies`, with the same drivers as today.
- **Scenario count.** One entry in `ptRoughScen`.
- **Limits.** A profile has 1 to 20 sizes, and the order is set by the lead.

### Editing (draft profiles only)

- **Add size.** Asks for a name and a size to copy from. It copies that size's rows in all four tables. A size is never created blank, because a blank size would silently mean zero effort.
- **Remove.** Allowed even when estimates use the size. The block happens later, at apply time.
- **Rename** and **move up/down** are also available.
- Every change is audited as `profile.update`, as today.
- A published or retired profile shows the sizes read-only.

### Applying a profile, and creating an estimate from one

- The service collects the features whose size is not in the profile's `sizes`. If there are any, the apply is refused with 409 `SIZE_NOT_IN_PROFILE`. The response lists each missing size and how many features use it, for example "3 features use XXL, which this profile doesn't have". Nothing changes.
- The estimator resizes those features and applies again.
- Creating a new estimate from a profile has no features, so it is never blocked.

### Estimates

- The size picker lists `assumptions.sizes` in order.
- Autosave and save refuse a feature whose size is not in the estimate's `sizes` (422), so the API and MCP cannot add one.
- *Builder's call:* a draft's `sizes` and its size-table keys change only by applying a profile. Autosave refuses any other change to them (422).
- Saved versions keep their own copy and never change.

### Calibration

- For the ten built-in names, a row counts as calibrated when it differs from the engine default, as today.
- For any other name, a row counts as uncalibrated until the lead records a calibration source for that path. Adding a size must not look like calibration work that never happened.
- **In estimates (decided by the user):** applying a profile, or creating an estimate from one, copies the profile's calibration notes for custom-size paths into the estimate, alongside the values. They are stored with the assumptions in the draft and in every saved version. The count for an estimate uses those copied notes, so an estimate shows the same calibration as its profile. `uncalibratedCount` and `versionSnapshot` take the notes as an argument; when there are none, every custom-size row is uncalibrated. Rejected: always treating custom-size rows as uncalibrated in estimates, because that would make the portfolio's "on defaults" view misleading.
- Rows of a built-in size that was removed are simply absent: they are counted neither way.
- *Builder's call:* `ptRoughScen` stays one row, as today. Its status compares only the built-in names it holds against the defaults; custom names in it are ignored. A custom size's calibration shows on its three driver rows.
- The row total becomes per estimate: the 130 fixed rows plus 3 × the number of sizes. With the ten defaults this is 160 as today, so no stored count changes.
- *Builder's call:* a rename carries the size's calibration notes to the new paths. Built-in status follows the name, so renaming M to Med makes it a custom size: its rows count as calibrated only where a source is recorded.
- The portfolio and the profile list show "uncalibrated / total" using that per-row total. `EstimateVersion` stores the total next to `uncalibrated`, so the portfolio does not recompute it.

### Text and display

- Size rows on the Assumptions tab and in the export use one generic help text per table, with the size name filled in, in EN and VI, for example "Driver counts for a feature of size {size}". This replaces the per-size help texts from ADR-0020.
- Size names are shown as entered, untranslated.

### Existing data

- An upgrade on read (`INPUTS_SCHEMA_VERSION` 4) adds `sizes` to stored estimates, in the canonical order, keeping only names that are present in the tables.
- A SQL data migration adds `sizes` to stored profiles and fills the new total column on `EstimateVersion`.
- No number changes.

### Contract

- `Size` changes from an enum to a constrained string in `packages/schemas`. The OpenAPI document changes, so `OPENAPI_BREAKING_APPROVED` is needed.
- MCP `describe_inputs` and `describe_assumptions` report the sizes of the given estimate or profile, not a fixed list.

### Engine

- `ENGINE_VERSION` becomes 1.3.0.
- The engine reads sizes from `assumptions.sizes`. `sensitivity.ts` loops over them instead of `SIZES`.
- `SIZES` stays exported as the default list, used for defaults and for prototype import.
- The goldens and parity keep running on the ten defaults and must stay identical.
- New engine tests cover a profile with custom, renamed and removed sizes.

## Constraints

- Sensitive paths: engine, migrations and `rbac.ts` (no change expected) need a named human reviewer.
- Merged migrations are never edited.
- The full suite, plus parity, must pass before merge.
- Follow AGENTS.md: schema first, i18n EN and VI, accessibility for the new editor controls, synthetic data only.
- Ship in small PRs:
  1. schema and engine;
  2. upgrade, migration and services;
  3. the profile editor UI.

## Left to the builder

- Exact component layout of the size editor in `profile-editor.tsx` (reuse existing patterns and `CollapsibleSection`).
- Error message wording, within the decisions above.
- How the 409 detail is shown in the apply-profile dialog.
- Whether the name-character rule needs widening, as long as `.` stays out.
