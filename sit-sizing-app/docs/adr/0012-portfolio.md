# ADR-0012: Portfolio view

|                 |                                                                        |
| --------------- | ---------------------------------------------------------------------- |
| **Status**      | Proposed for release 3 (`lib/rbac.ts` change: named reviewer, rule 13) |
| **Date**        | 2026-11-13                                                             |
| **Deciders**    | Tech lead, product owner, QE practice lead                             |
| **Design refs** | Sections 7 (Portfolio view), 9.2, 10.5; backlog R-01                   |

## Context

The QBR needs one view of the effort across projects: totals and ranges, and how much of it rests on calibrated values. The design gives `GET /portfolio?projectIds=&status=` for QE Leads and Admins. R-01's acceptance test is that the totals equal the sum of the versions underneath.

## Decision

1. **One row per estimate.**
   - `status=approved` (the default, for the QBR) takes each estimate's approved version.
   - `status=latest` takes the newest saved version, to show work in progress.
   - Drafts are never included, and archived projects and estimates are left out.
2. **Figures come from each version's stored result** (detailed mode for FTE, range, cases and hours; rough FTE alongside). Nothing is recomputed, so the portfolio shows what was approved.
3. **Totals are plain sums**, in the pure `server/domain/portfolio.ts`, with subtotals per project. Ranges sum low with low and high with high. That assumes the estimates move together, which gives the widest honest range. The page says so.
4. **Calibration status:** each row shows its uncalibrated count (of 142). The total counts estimates still entirely on defaults, and the page shows how many use calibrated values.
5. **Access:** a new permission, `portfolio.read`, at QE Lead level, per project.
   - QE Leads see the projects they lead. Asking for another project returns 404, as everywhere else.
   - Admins see all projects.
   - Anyone else gets 403.
   - The header link is shown only to people who may see the portfolio.
6. **CSV for the QBR pack:** `GET /portfolio/export` returns the same rows, subtotals and total, in English or Vietnamese.

## Consequences

- With many estimates, the endpoint reads each estimate's newest matching version in one query. Pagination can follow if a portfolio grows past a few hundred estimates.
- "Releases" in the design's wording are covered by estimates and projects. There is no release field yet; one can be added if QBRs need grouping by release.
