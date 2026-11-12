# @sit/engine

The SIT sizing calculation engine (design section 6). A faithful TypeScript port of the HTML prototype: same formulas, same order of operations, same rounding.

## Rules

- Pure functions: no I/O, no dates, no randomness, no UI text (ESLint enforces this in `src/`).
- **Never change the numbers by accident.** Every golden file in `golden/` must stay green. A formula or default change needs an ADR, a minor version bump of `ENGINE_VERSION`, and regenerated golden files in the same PR.
- Port prototype behaviour as is; record anything suspicious in `docs/engine-findings.md`.
- Relative imports use explicit `.ts` extensions so the engine also runs directly under Node's type stripping.

## Public API (design 6.2)

| Export                                                    | Purpose                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `compute(mode, inputs, assumptions, evidenceOverride?)`   | One mode; full result with groups, totals, FTE, range and the `explain` values |
| `computeBoth(inputs, assumptions)`                        | Both modes, stamped with `ENGINE_VERSION`                                      |
| `toStoredResult(both)`                                    | The subset stored with a saved version (schemas `EstimateResult`)              |
| `sensitivity(mode, inputs, assumptions, swing)`           | Tornado rows (`SENSITIVITY_ITEMS`, 42 items)                                   |
| `shiftLeftScenarios(inputs, assumptions)`                 | All gates / current / no gates on the detailed estimate                        |
| `derivedRows(result, assumptions)`                        | Numbers behind each "how it was derived" formula row                           |
| `calendarChecks(both, inputs, assumptions)`               | Data cycles, SME labelling and performance cycles against the SIT window       |
| `gapRows(both)`, `topGap(both)`                           | Rough vs detailed by group                                                     |
| `itemHours(driver, band, result, assumptions)`            | Hours per item for the complexity rubric                                       |
| `uncalibratedCount(assumptions, defaults)`                | Rows (of 142) still at their default                                           |
| `fromPrototypeProfile(json)`                              | Import a profile exported from the HTML tool, with its tolerance rules         |
| `DEFAULT_ASSUMPTIONS`, `EXAMPLE_INPUTS`, `ENGINE_VERSION` | Constants                                                                      |

## Checks

| Command                                     | What it proves                                                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test` (root)                          | Golden parity for 33 cases, property tests, unit tests                                                                                                                           |
| `pnpm --filter @sit/engine parity`          | Bit-identical results against the prototype itself on 5,000 seeded random estimates, including sensitivity and scenarios. Needs `../sit-sizing-reference/` (or `PROTOTYPE_PATH`) |
| `pnpm --filter @sit/engine mutation`        | Stryker mutation score, break below 70%                                                                                                                                          |
| `pnpm --filter @sit/engine golden:generate` | Regenerates `golden/` from the prototype. Only with an approved ADR                                                                                                              |
