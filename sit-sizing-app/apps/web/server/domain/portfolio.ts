/**
 * Portfolio roll-up for the QBR (design 7, release 3 R-01). Pure: the service passes one
 * row per estimate (its approved version, or its newest saved one).
 *
 * Totals are plain sums of the rows, so they equal the sum of the underlying versions.
 * Ranges are summed too (low with low, high with high): this assumes the estimates move
 * together, which gives the widest honest range for a portfolio.
 */
import type { Portfolio, PortfolioRow, PortfolioTotals } from '@sit/schemas';

export function totals(rows: PortfolioRow[], assumptionRows: number): PortfolioTotals {
  const sum = (f: (r: PortfolioRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    estimates: rows.length,
    fte: sum((r) => r.fte),
    lo: sum((r) => r.lo),
    hi: sum((r) => r.hi),
    cases: sum((r) => r.cases),
    hours: sum((r) => r.hours),
    roughFte: sum((r) => r.roughFte),
    onDefaults: rows.filter((r) => r.uncalibrated >= assumptionRows).length,
  };
}

/** Groups rows by project (by name, then key), estimates by name; subtotals and a total. */
export function rollUp(
  rows: PortfolioRow[],
  status: Portfolio['status'],
  assumptionRows: number,
): Portfolio {
  const byProject = new Map<string, PortfolioRow[]>();
  for (const r of rows) {
    const list = byProject.get(r.projectId) ?? [];
    list.push(r);
    byProject.set(r.projectId, list);
  }
  const projects = [...byProject.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => a.estimateName.localeCompare(b.estimateName));
      const first = sorted[0]!;
      return {
        projectId: first.projectId,
        projectKey: first.projectKey,
        projectName: first.projectName,
        rows: sorted,
        subtotal: totals(sorted, assumptionRows),
      };
    })
    .sort(
      (a, b) =>
        a.projectName.localeCompare(b.projectName) || a.projectKey.localeCompare(b.projectKey),
    );
  return { status, projects, total: totals(rows, assumptionRows), assumptionRows };
}
