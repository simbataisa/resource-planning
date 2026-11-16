# ADR-0020: Ten T-shirt sizes for rough-scope features

|                           |                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| **Status**                | Accepted (sizes and defaults chosen by the requester on 2026-11-16); named review pending         |
| **Date**                  | 2026-11-16                                                                                        |
| **Deciders**              | Product owner, QE lead (defaults); tech lead; named reviewer for `packages/engine` and migrations |
| **Backlog / design refs** | Design 6.4, 6.6; ADR-0008 (profiles), ADR-0013 (upgrade on read), ADR-0019 (schema version 2)     |

## Context

Rough scope sizes each feature S, M, L or XL. Each size has default proxy counts (application, data platform and AI product features) and a number of performance scenarios. Teams asked for smaller and larger features, and for finer steps around M.

## Decision

1. **Sizes:** `XXS · XS · S · M- · M · M+ · L · XL · XXL · XXXL` (in this order). S, M, L and XL keep their values.
2. **Defaults for the new sizes** (requester-approved):
   - XS ≈ half of S, XXS ≈ a quarter of S, XXL ≈ 1.8 × XL, XXXL ≈ 1.8 × XXL, rounded (0.5–1 rounds to 1, below 0.5 to 0).
   - M- and M+ are the midpoints of S/M and M/L, rounded half up.
   - Performance scenarios per feature: XXS 1 · XS 1 · S 1 · M- 2 · M 2 · M+ 3 · L 3 · XL 5 · XXL 8 · XXXL 13.
   - The values are in `packages/engine/src/defaults.ts` and the prototype's `DEFAULTS`.
3. **Assumption rows:** each size is one row in each of the three proxy groups, so 18 new rows: **142 → 160**. `ptRoughScen` stays one row with ten keys.
4. **Engine 1.2.0.** No formula changes. Existing estimates with S–XL features give the same numbers; goldens differ only in the assumptions they list.
5. **Stored data:**
   - `INPUTS_SCHEMA_VERSION` 3. `UPGRADES[2]` adds the new size keys at their defaults to `proxies`, `dproxies`, `aproxies` and `ptRoughScen`, keeping every existing value. Upgraded versions show the new rows as uncalibrated.
   - Data migration `20261122000000_more_feature_sizes` does the same for `AssumptionProfile.values` (existing keys win). It only adds; nothing existing changes.
   - Prototype files and imports need no step: the prototype's `merge` keeps defaults for missing keys.

## Consequences

- Rough estimates can now use smaller and larger features; existing estimates are unchanged.
- API: the feature `size` enum and the proxy objects gain keys. Old clients sending S–XL keep working, but a response may contain the new sizes; `OPENAPI_BREAKING_APPROVED` is needed if the gate flags the enum change.
- Rollback: an older release still reads migrated profiles, because Zod objects drop unknown keys, so the profile migration needs no reverse SQL. Versions saved at schema version 3 return 409 `NEWER_SCHEMA` there, as for ADR-0019.
- Help texts: 18 new draft rows in `docs/i18n/assumption-help-draft.md`, marked "needs approval".

## Approval

- [x] Sizes, names and defaults approved by the requester (Dennis), 2026-11-16
- [ ] QE lead sign-off: ____________
- [ ] Engine and migration reviewed by: ____________ (named reviewer)
