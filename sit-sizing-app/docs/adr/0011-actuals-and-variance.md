# ADR-0011: Actuals and variance

|                 |                                                             |
| --------------- | ----------------------------------------------------------- |
| **Status**      | Proposed for release 3 (migration: named reviewer, rule 13) |
| **Date**        | 2026-11-13                                                  |
| **Deciders**    | Tech lead, product owner, QE practice lead                  |
| **Design refs** | Sections 3 (non-goals), 5.2, 7 (Actuals), 9.2; backlog P-02 |

## Context

Release 3 closes the loop: after an SIT cycle, the team records what it measured, sees the variance against the approved estimate, and uses it to calibrate an assumption profile. The design rules out automatic calibration: "a person updates the profile".

## Decision

1. **What is recorded per cycle** (`ActualsData`):
   - Required: test cases executed and total SIT hours.
   - Optional: execution hours, cases designed with their design hours, cases retested after fixes, productive hours per day, and a split by group.
   - A cycle name and a note. One record per cycle name and version (unique index).
2. **Against approved versions only.** `APPROVED`, or `SUPERSEDED` when a newer version was approved after the cycle ran (409 `NOT_APPROVED` otherwise). Recording needs Estimator. Removing a mistaken record needs its recorder or a QE Lead. Both are audited (`actuals.record`, `actuals.delete`).
3. **Variance is computed, never stored.** `server/domain/variance.ts` compares each cycle with the version's stored detailed result: variance = actual − estimate, and the percentage is relative to the estimate (null when the estimate is zero). The detailed mode is used because actuals come after the FSD.
4. **Rates inform; people decide.** Four measured rates sit next to the assumption they inform, with its path:
   - Execution minutes per case → `minutes`
   - Design minutes per case → `designFSD`
   - Retest rate → `retest`
   - Productive hours per day → `hoursPerDay`

   The page links to the profiles. A QE Lead puts the agreed values into a profile, with the cycle as the calibration source, and publishes it. That is the release 3 exit criterion, done by a person.

5. **API:** `GET` and `POST /estimates/{id}/versions/{n}/actuals`, and `DELETE …/actuals/{actualsId}`.

## Consequences

- `minutes` is a simple/medium/complex triple, while a cycle gives one average. The page shows both, and the person splits it. Measuring by complexity can come later if teams track it.
- The rates and the group split are optional, so teams can start with the two totals.
- "Calibration suggestions from actuals" stays a later candidate (design 14).
