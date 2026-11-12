/**
 * Export model (release 2, X-02): the tables of the Excel workbook and the CSV files.
 * Pure: built from one version and the engine's output, rendered by xlsx.ts and csv.ts.
 *
 * Figures are the engine's own numbers (computeBoth on the version's inputs and
 * assumptions), so the workbook matches the editor. Totals rows are formulas whose cached
 * results are the engine totals; tests check the two agree.
 */
import {
  ASSUMPTION_PATHS,
  DEFAULT_ASSUMPTIONS,
  DRIVERS,
  GROUP_KEYS,
  isDefaultRow,
  type BothResults,
} from '@sit/engine';
import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { ASSUMPTION_META, type MetaLabel } from '@/lib/assumption-meta';
import { getPath } from '@/lib/path';

export type Format = 'text' | 'int' | 'fte' | 'hours' | 'pct' | 'num' | 'date';
export type Cell = string | number | boolean | null | { formula: string; result: number };

export interface Column {
  header: string;
  format?: Format;
  width?: number;
}

export interface Table {
  /** Sheet name (Excel limit 31 characters) and CSV file suffix. */
  id: 'summary' | 'drivers' | 'gap' | 'assumptions' | 'inputs';
  title: string;
  columns: Column[];
  rows: Cell[][];
  /** Number format per row, overriding the column's (Summary mixes counts and FTE). */
  rowFormats?: (Format | undefined)[];
  /** Index of the first totals row, if any; rendered bold. */
  totalsFrom?: number;
  /** Lines shown above the table in Excel (not in CSV). */
  notes?: string[];
}

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface ExportSource {
  estimateName: string;
  projectName: string;
  versionNumber: number;
  status: string;
  engineVersion: string;
  profileName: string | null;
  exportedAt: Date;
  inputs: EstimateInputs;
  assumptions: Assumptions;
  result: BothResults;
}

const DEFAULTS = DEFAULT_ASSUMPTIONS as Assumptions;
/** Excel column letter for a 0-based index (A–Z is enough here). */
const col = (i: number) => String.fromCharCode(65 + i);

export function buildTables(src: ExportSource, t: Translate): Table[] {
  return [summary(src, t), drivers(src, t), gap(src, t), assumptions(src, t), inputs(src, t)];
}

function summary(src: ExportSource, t: Translate): Table {
  const { rough: R, detailed: D } = src.result;
  const uncal = ASSUMPTION_PATHS.filter((p) => isDefaultRow(src.assumptions, DEFAULTS, p)).length;
  const row = (label: string, ...v: Cell[]): Cell[] => [label, ...v];
  return {
    id: 'summary',
    title: t('export.sheets.summary'),
    notes: [t('export.disclaimer')],
    columns: [
      { header: t('export.cols.item'), width: 34 },
      { header: t('export.cols.rough'), width: 18 },
      { header: t('export.cols.detailed'), width: 18 },
    ],
    rowFormats: [
      ...Array<undefined>(6).fill(undefined),
      'int',
      'fte',
      'fte',
      'fte',
      'int',
      'hours',
      'int',
    ],
    rows: [
      row(t('export.summary.estimate'), src.estimateName, null),
      row(t('export.summary.project'), src.projectName, null),
      row(t('export.summary.version'), `v${src.versionNumber} · ${src.status}`, null),
      row(t('export.summary.profile'), src.profileName ?? '—', null),
      row(t('export.summary.engine'), src.engineVersion, null),
      row(t('export.summary.exportedAt'), src.exportedAt.toISOString(), null),
      row(t('export.summary.uncalibrated'), uncal, ASSUMPTION_PATHS.length),
      row(t('export.summary.fte'), R.fte, D.fte),
      row(t('export.summary.fteLow'), R.lo, D.lo),
      row(t('export.summary.fteHigh'), R.hi, D.hi),
      row(t('export.summary.cases'), R.cases, D.cases),
      row(t('export.summary.hours'), R.hours, D.hours),
      row(t('export.summary.weeks'), src.inputs.team.weeks, src.inputs.team.weeks),
    ],
  };
}

function drivers(src: ExportSource, t: Translate): Table {
  const { rough: R, detailed: D } = src.result;
  const cx = [0, 1, 2].map((i) => t(`catalogue.complexity.${i}`));
  const rows: Cell[][] = [];
  const triple = (label: string, r: readonly number[], d: readonly number[]) =>
    rows.push([label, ...r, ...d]);
  for (const k of DRIVERS) triple(t(`catalogue.drivers.${k}`), R.counts[k], D.counts[k]);
  for (const k of ['feed', 'pipe', 'table', 'report'] as const)
    triple(t(`catalogue.dataDrivers.${k}`), R.counts.data[k], D.counts.data[k]);
  for (const k of ['intent', 'ocr'] as const)
    triple(t(`catalogue.aiDrivers.${k}`), R.counts.ai[k], D.counts.ai[k]);
  return {
    id: 'drivers',
    title: t('export.sheets.drivers'),
    columns: [
      { header: t('export.cols.driver'), width: 36 },
      ...cx.map((c) => ({ header: `${t('export.cols.rough')} · ${c}`, format: 'int' as const })),
      ...cx.map((c) => ({ header: `${t('export.cols.detailed')} · ${c}`, format: 'int' as const })),
    ],
    rows,
  };
}

function gap(src: ExportSource, t: Translate): Table {
  const { rough: R, detailed: D } = src.result;
  const totH = D.hours - R.hours;
  // Every group with any cases or hours, so the totals add up exactly to the engine totals.
  // Share of the hours gap is rounded as in the editor's gap table (engine gapRows).
  const rows: Cell[][] = GROUP_KEYS.filter(
    (g) => R.groups[g].cases || D.groups[g].cases || R.groups[g].hours || D.groups[g].hours,
  ).map((g) => {
    const r = R.groups[g];
    const d = D.groups[g];
    const dh = d.hours - r.hours;
    const share = Math.abs(totH) > 1e-6 ? Math.round((dh / totH) * 100) / 100 : 0;
    return [
      t(`catalogue.groups.${g}`),
      r.cases,
      d.cases,
      d.cases - r.cases,
      r.hours,
      d.hours,
      dh,
      share,
    ];
  });
  const first = 2; // header is row 1
  const last = rows.length + 1;
  const sum = (c: number, result: number): Cell =>
    rows.length ? { formula: `SUM(${col(c)}${first}:${col(c)}${last})`, result } : result;
  const totalsFrom = rows.length;
  rows.push([
    t('export.cols.total'),
    sum(1, R.cases),
    sum(2, D.cases),
    sum(3, D.cases - R.cases),
    sum(4, R.hours),
    sum(5, D.hours),
    sum(6, D.hours - R.hours),
    null,
  ]);
  return {
    id: 'gap',
    title: t('export.sheets.gap'),
    columns: [
      { header: t('export.cols.group'), width: 40 },
      { header: t('export.cols.roughCases'), format: 'int' },
      { header: t('export.cols.detailedCases'), format: 'int' },
      { header: t('export.cols.deltaCases'), format: 'int' },
      { header: t('export.cols.roughHours'), format: 'hours' },
      { header: t('export.cols.detailedHours'), format: 'hours' },
      { header: t('export.cols.deltaHours'), format: 'hours' },
      { header: t('export.cols.share'), format: 'pct' },
    ],
    rows,
    totalsFrom,
  };
}

function assumptions(src: ExportSource, t: Translate): Table {
  const label = (l: MetaLabel) => t(l.key, l.values);
  const keyLabel = (ref: string) => (ref.startsWith('=') ? ref.slice(1) : t(ref));
  const rows: Cell[][] = [];
  for (const g of ASSUMPTION_META) {
    for (const r of g.rows) {
      const v = getPath(src.assumptions, r.path);
      const d = getPath(DEFAULTS, r.path);
      const parts = (x: unknown): string => {
        if (r.kind === 'pct') return `${+((x as number) * 100).toFixed(2)}%`;
        if (r.kind === 'scalar') return String(x);
        if (r.kind === 'cols')
          return (x as number[]).map((n, i) => `${t(r.cols[i]!)} ${n}`).join(' · ');
        const o = x as Record<string, number>;
        return r.keys.map(([k, ref]) => `${keyLabel(ref)} ${o[k]}`).join(' · ');
      };
      const isDefault = isDefaultRow(src.assumptions, DEFAULTS, r.path);
      rows.push([
        t(`assumptionsTab.groups.${g.group}`),
        label(r.label),
        r.path,
        parts(v),
        parts(d),
        isDefault ? t('assumptionsTab.uncalibrated') : t('assumptionsTab.teamValue'),
      ]);
    }
  }
  return {
    id: 'assumptions',
    title: t('export.sheets.assumptions'),
    columns: [
      { header: t('export.cols.group'), width: 26 },
      { header: t('export.cols.assumption'), width: 52 },
      { header: t('export.cols.path'), width: 26 },
      { header: t('export.cols.value'), width: 40 },
      { header: t('export.cols.default'), width: 40 },
      { header: t('export.cols.status'), width: 16 },
    ],
    rows,
  };
}

/** Every input as a dotted path and value, so the scope can be checked or re-keyed. */
function inputs(src: ExportSource, t: Translate): Table {
  const rows: Cell[][] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v) && v.some((x) => x !== null && typeof x === 'object')) {
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
    } else if (Array.isArray(v)) {
      rows.push([path, v.join(', ')]);
    } else if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
    } else {
      rows.push([path, v as Cell]);
    }
  };
  walk(src.inputs, '');
  return {
    id: 'inputs',
    title: t('export.sheets.inputs'),
    notes: [t('export.inputsNote')],
    columns: [
      { header: t('export.cols.path'), width: 44 },
      { header: t('export.cols.value'), width: 40 },
    ],
    rows,
  };
}

/** The plain value of a cell (the cached result for formulas). */
export const cellValue = (c: Cell): string | number | boolean | null =>
  c !== null && typeof c === 'object' ? c.result : c;
