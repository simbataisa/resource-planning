# ADR-0008: Assumption profiles

|                 |                                                             |
| --------------- | ----------------------------------------------------------- |
| **Status**      | Proposed for release 2 (needs security review, rule 13)     |
| **Date**        | 2026-11-12                                                  |
| **Deciders**    | Tech lead, product owner, QE practice lead (Q7)             |
| **Design refs** | Sections 5.2, 6.6, 7, 9.1, 10.5; backlog P-01; open item Q7 |

## Context

Release 1 copies the seeded global "Default (uncalibrated)" profile into every new estimate. Release 2 lets teams start from measured values: a QE Lead keeps project profiles, and the QE practice lead (Admin) keeps global ones. The exit criterion is that a published profile is applied to a new estimate.

## Decision

1. **States.** `DRAFT → PUBLISHED → RETIRED`. Only a draft can be edited. A published profile never changes, so an estimate that copied it can always explain its numbers. To change one, clone it into a new draft (design 6.6 rule 6).
2. **Who can do what.** Project profiles: QE Lead of that project (`profile.project.manage`). Global profiles: Admin (`profile.global.manage`). Everyone can read published global profiles. Project members can read their project's profiles, drafts included.
3. **Calibration status per value.** As in the prototype, a row is calibrated when its value differs from the engine default. The profile also stores a source and a measured date per calibrated row (`calibration`, keyed by the 142 assumption paths). Keys that are not assumption paths are refused (422). Notes for rows that are back at the default are dropped on save.
4. **Using a profile.**
   - New estimate: the dialog lists published global and project profiles. Leaving it empty keeps the release 1 fallback, the oldest published global profile. Draft and retired profiles are refused (422).
   - Open draft: `POST /estimates/{id}/draft/profile` replaces every assumption with the profile's values, recomputes and records `profileId`. It needs the edit lock and the current `rowVersion`, like autosave. The UI asks for confirmation and waits for autosave to finish first.
5. **Copy, don't link.** Values are copied into the version. Retiring a profile only stops new use.
6. **The last published global profile cannot be retired** (409 `LAST_GLOBAL`), because new estimates fall back to it.
7. **Names** are unique per scope and project. The service checks this as well as the unique index, because Postgres treats the null `projectId` of global profiles as distinct.
8. **Audit.** `profile.create`, `profile.update`, `profile.publish`, `profile.retire` and `estimate.draft.profile.apply`.

## Consequences

- Draft profile edits are last-write-wins; there is no optimistic lock on profiles. Drafts are edited by one or two leads, so this is accepted for now.
- Notifications on publish come with N-01.
- Recording actuals and publishing a calibrated profile from them is release 3.
