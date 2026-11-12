# ADR-0014: Admin and audit screens

|                 |                                                                              |
| --------------- | ---------------------------------------------------------------------------- |
| **Status**      | Proposed for release 3 (role and identity changes: security review, rule 13) |
| **Date**        | 2026-11-13                                                                   |
| **Deciders**    | Tech lead, product owner, IdP owner                                          |
| **Design refs** | Sections 7 (Admin), 9.2 (`GET /audit`), 10.3–10.6; backlog H-01              |

## Context

The design's admin area covers users and global roles, global profiles, and the audit log viewer. Global profiles came with P-01. Security headers and rate limiting came with step 1.7a. Project members had an API (`PUT /projects/{id}/members`) but no screen.

Design 10.5 and ADR-0004 put identity in Keycloak. The global Admin role is membership of the group `sit-sizing-admins`, re-read from the ID token at every sign-in.

## Decision

1. **The Admin role is not editable in the app.**
   - The Users screen shows each person's global role read-only and explains how to change it in Keycloak.
   - A change made in the app would be overwritten at the next sign-in, and would bypass the IdP owner.
   - Role changes coming from Keycloak are already audited at sign-in (`user.role.change`).
2. **Activation is the one user change made in the app.** `PATCH /users/{id} { active }`, Admin only:
   - A deactivated user is refused on their next request (the session check reads `active`) and at sign-in.
   - An Admin cannot deactivate themselves (409 `SELF`).
   - Both directions are audited (`user.deactivate`, `user.activate`).
   - This complements, and does not replace, disabling the account in Keycloak.
3. **Users list:** `GET /users?q=` (Admin) shows everyone who has signed in, with project roles and last sign-in. It is paged.
4. **Audit log:** `GET /audit?projectId=&entity=&action=&actorId=&from=&to=`, newest first, paged.
   - **Access:** with a project, its QE Leads and Admins; non-members get 404, as elsewhere. Without a project, only Admins, which includes global events such as user and global profile changes.
   - **Filters:** `action` is exact, or a prefix when it ends with a dot. Dates are whole UTC days. The filter logic is the pure `server/domain/audit.ts`.
   - **Content:** events show the stored `detail`, which by rule holds no inputs, tokens or personal data.
5. **Members panel** on the project page, using the existing replace-all API:
   - Every member can see who is in the project; QE Leads and Admins can change roles, add people by work e-mail and remove them.
   - People who have not signed in yet are named in the error. At least one QE Lead must remain, checked in the browser and by the API.
6. **Navigation:** "Audit log" is shown to QE Leads and Admins, and "Users" to Admins.

## Consequences

- Making someone an Admin is a Keycloak change, not an app change, by design. The runbook's Keycloak section covers it.
- Audit retention is not decided yet. It goes with notification retention (ADR-0010).
