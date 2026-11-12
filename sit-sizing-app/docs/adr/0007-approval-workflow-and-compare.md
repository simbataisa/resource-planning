# ADR-0007: Approval workflow, version compare and restore

|                 |                                                         |
| --------------- | ------------------------------------------------------- |
| **Status**      | Proposed for release 2 (needs security review, rule 13) |
| **Date**        | 2026-11-12                                              |
| **Deciders**    | Tech lead, product owner, QE Lead representative        |
| **Design refs** | Sections 5.2, 10.5, threat model T-05; backlog V-01     |

## Context

Release 1 lets an Estimator save immutable versions. Release 2 adds a review step, so a QE Lead can sign off one version of an estimate as the figure the team commits to. Reviewers also need to see what changed between two versions, and to restart from an older version.

## Decision

1. **States.** `SAVED → SUBMITTED → APPROVED`. A QE Lead can return a submitted version to `SAVED` with a note. Approving a version marks the previously approved one `SUPERSEDED`. Only one version of an estimate can be `SUBMITTED` at a time.
2. **Who can do what** (`lib/rbac.ts`): `version.submit` needs Estimator; `version.approve` and `version.return` need QE Lead. Admins pass every role check.
3. **Segregation of duties.** The person who wrote a version, or submitted it, cannot approve it, whatever their role, Admins included. The rule lives in the pure `server/domain/review.ts` and returns 403 `SEGREGATION_OF_DUTIES`. The UI disables Approve and says why.
4. **One transaction per step.** `server/services/review.ts` checks the rule, changes the status with a guarded `updateMany` (a race returns 409 `RACE`), stores the optional note as a `ReviewComment`, and writes the audit event `estimate.version.{submit,approve,return}` (threat model T-05).
5. **Schema.** `EstimateVersion` gains `submittedById` (migration `20261114000000_version_submitter`). The DTOs add `submittedBy`, `submittedAt`, `approvedBy`, `approvedAt` and the version's `reviews`.
6. **Compare.** `GET /api/v1/estimates/{id}/compare?a=&b=` returns both summaries, the rough and detailed figures, per-group cases and hours, and a flat list of changed input and assumption paths. Leaf arrays count as one value. The list is capped at 500 entries with a `truncated` flag. Results come from the stored `result`, so compare never recomputes.
7. **Restore.** "Restore as new draft" calls the existing `POST /draft` with `fromVersion`. The old version is never changed.

## Consequences

- An approved figure is traceable to one version, one approver and one audit event.
- A project with a single QE Lead cannot approve that lead's own work. An Admin or a second QE Lead has to approve it. Open question for the product owner: is that acceptable for small teams?
- Notifications for these events come in N-01.
