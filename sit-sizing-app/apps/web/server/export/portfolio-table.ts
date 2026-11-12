import type { Portfolio } from '@sit/schemas';
import type { Cell, Table, Translate } from './workbook';

/**
 * The portfolio as one table for CSV (R-01): a row per estimate, a subtotal per project
 * and the total. Numbers are unrounded, as in the workbook.
 */
export function portfolioTable(p: Portfolio, t: Translate): Table {
  const rows: Cell[][] = [];
  const line = (
    project: string,
    estimate: string,
    v: {
      fte: number;
      lo: number;
      hi: number;
      cases: number;
      hours: number;
      roughFte: number;
    },
    extra: [Cell, Cell, Cell, Cell],
  ): Cell[] => [project, estimate, ...extra, v.fte, v.lo, v.hi, v.cases, v.hours, v.roughFte];
  for (const g of p.projects) {
    for (const r of g.rows)
      rows.push(
        line(g.projectName, r.estimateName, r, [
          `v${r.versionNumber}`,
          t(`status.${r.status}`),
          r.profileName ?? '',
          r.uncalibrated,
        ]),
      );
    rows.push(line(g.projectName, t('portfolio.subtotal'), g.subtotal, ['', '', '', null]));
  }
  rows.push(line(t('portfolio.total'), '', p.total, ['', '', '', null]));
  return {
    id: 'summary',
    title: t('portfolio.title'),
    columns: [
      { header: t('portfolio.cols.project') },
      { header: t('portfolio.cols.estimate') },
      { header: t('portfolio.cols.version') },
      { header: t('portfolio.cols.status') },
      { header: t('portfolio.cols.profile') },
      { header: t('portfolio.cols.uncalibrated'), format: 'int' },
      { header: t('portfolio.cols.fte'), format: 'fte' },
      { header: t('portfolio.cols.lo'), format: 'fte' },
      { header: t('portfolio.cols.hi'), format: 'fte' },
      { header: t('portfolio.cols.cases'), format: 'int' },
      { header: t('portfolio.cols.hours'), format: 'hours' },
      { header: t('portfolio.cols.roughFte'), format: 'fte' },
    ],
    rows,
  };
}
