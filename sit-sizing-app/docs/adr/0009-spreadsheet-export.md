# ADR-0009: Excel and CSV export

|                 |                                                           |
| --------------- | --------------------------------------------------------- |
| **Status**      | Proposed for release 2                                    |
| **Date**        | 2026-11-12                                                |
| **Deciders**    | Tech lead, product owner                                  |
| **Design refs** | Sections 2 (ExcelJS), 7 (Export), 9.2; backlog X-02; T-05 |

## Context

Biz Case and QBR work happens in spreadsheets. Release 1 exports the prototype JSON and the QBR text in the browser. Release 2 adds an Excel workbook (inputs, drivers, gap table, assumptions) and CSV. X-02's acceptance test: workbook totals equal the engine output.

## Decision

1. **Server-side export.** `GET /estimates/{id}/versions/{n}/export?format=xlsx|csv&table=…&lang=en|vi`, with the `estimate.export` permission (Viewer and up). Each download is audited (`estimate.export`, threat model T-05). The editor links to it; the links wait for autosave so the file matches the screen.
2. **One model, two renderers.** `server/export/workbook.ts` builds plain tables from the engine's `computeBoth` on the stored inputs and assumptions. `xlsx.ts` renders them with ExcelJS 4.4; `csv.ts` renders one table.
3. **Sheets.**
   - Summary: estimate, version, profile, engine version, FTE with its low–high range, cases, hours, uncalibrated count.
   - Drivers: counts by complexity for both modes.
   - Gap by group: every group with cases or hours, plus a totals row.
   - Assumptions: all 142 rows with value, default and calibration status.
   - Inputs: every input as a path and value.
4. **Totals are formulas with cached results.** The totals row is `SUM(...)` over the group rows, and its cached result is the engine total, so the file opens with the right numbers and stays live if a user edits a cell. Tests check that the group rows add up to the engine totals.
5. **Numbers are unrounded, formatted by Excel** (`#,##0`, `0.0`, `0%`), so a recalculation never compounds rounding.
6. **CSV safety.** UTF-8 with BOM, CRLF line ends, RFC 4180 quoting. Text starting with `= + - @`, tab or CR gets an apostrophe prefix (OWASP CSV injection).
7. **Language.** Labels follow `lang`, else the user's language. Paths and numbers are the same in both.

## Consequences

- One new runtime dependency, ExcelJS (Node only, listed in `serverExternalPackages`). Its licence and supply-chain check go on the release checklist.
- A print-friendly view (design section 7) is not part of X-02; it can follow if the pilot asks for it.
