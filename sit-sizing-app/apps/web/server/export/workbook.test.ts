import { describe, expect, it } from 'vitest';
import { computeBoth, DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from '@sit/engine';
import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { createTranslator } from 'next-intl';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';
import { toCsv } from './csv';
import { buildTables, cellValue, type ExportSource, type Table, type Translate } from './workbook';

const tr = (locale: 'en' | 'vi'): Translate => {
  const t = createTranslator({ locale, messages: locale === 'en' ? en : vi });
  return (key, values) => t(key as never, values as never);
};

function source(over: Partial<Pick<ExportSource, 'assumptions' | 'inputs'>> = {}): ExportSource {
  const inputs = structuredClone(over.inputs ?? EXAMPLE_INPUTS) as EstimateInputs;
  const assumptions = structuredClone(over.assumptions ?? DEFAULT_ASSUMPTIONS) as Assumptions;
  return {
    estimateName: 'Synthetic · Onboarding',
    projectName: 'Synthetic · Retail lending',
    versionNumber: 2,
    status: 'Saved',
    engineVersion: '1.0.0',
    profileName: 'Default (uncalibrated)',
    exportedAt: new Date('2026-11-12T07:00:00Z'),
    inputs,
    assumptions,
    result: computeBoth(inputs, assumptions),
  };
}

const byId = (tables: Table[], id: Table['id']) => tables.find((t) => t.id === id)!;
const num = (c: unknown) => cellValue(c as never) as number;

describe('export workbook model (X-02)', () => {
  const src = source();
  const tables = buildTables(src, tr('en'));
  const { rough: R, detailed: D } = src.result;

  it('has the five sheets in order', () => {
    expect(tables.map((t) => t.id)).toEqual(['summary', 'drivers', 'gap', 'assumptions', 'inputs']);
    for (const t of tables) {
      expect(t.title.length).toBeLessThanOrEqual(31);
      for (const r of t.rows) expect(r).toHaveLength(t.columns.length);
    }
  });

  it('summary figures are the engine output', () => {
    const rows = byId(tables, 'summary').rows;
    const find = (label: string) => rows.find((r) => r[0] === label)!;
    expect(find('FTE').slice(1)).toEqual([R.fte, D.fte]);
    expect(find('FTE, low').slice(1)).toEqual([R.lo, D.lo]);
    expect(find('FTE, high').slice(1)).toEqual([R.hi, D.hi]);
    expect(find('Test cases').slice(1)).toEqual([R.cases, D.cases]);
    expect(find('Hours').slice(1)).toEqual([R.hours, D.hours]);
    expect(find('Uncalibrated assumptions').slice(1)).toEqual([142, 142]);
  });

  it('gap totals equal the engine totals, and the group rows add up to them', () => {
    const gap = byId(tables, 'gap');
    const groups = gap.rows.slice(0, gap.totalsFrom);
    const total = gap.rows[gap.totalsFrom!]!;
    const expected = [R.cases, D.cases, D.cases - R.cases, R.hours, D.hours, D.hours - R.hours];
    expected.forEach((v, i) => {
      expect(num(total[i + 1])).toBeCloseTo(v, 9);
      const sum = groups.reduce((s, r) => s + num(r[i + 1]), 0);
      expect(sum).toBeCloseTo(v, 6);
    });
    // Formulas cover exactly the group rows (header is row 1).
    expect(total[1]).toMatchObject({ formula: `SUM(B2:B${groups.length + 1})` });
    expect(groups.length).toBeGreaterThan(0);
  });

  it('drivers show both modes per complexity', () => {
    const d = byId(tables, 'drivers');
    expect(d.columns).toHaveLength(7);
    const api = d.rows.find((r) => r[0] === 'API endpoints')!;
    expect(api.slice(1)).toEqual([...R.counts.api, ...D.counts.api]);
    // ADR-0019: mapped columns and DQ rules are counted by complexity too.
    const cols = d.rows.find((r) => r[0] === 'Mapped columns (source-to-target spec)')!;
    expect(cols.slice(1)).toEqual([...R.counts.data.columns, ...D.counts.data.columns]);
    const dq = d.rows.find((r) => r[0] === 'Data quality rules')!;
    expect(dq.slice(1)).toEqual([...R.counts.data.dq, ...D.counts.data.dq]);
  });

  it('shows the sized data rows as Simple, Medium and Complex (ADR-0019)', () => {
    const row = byId(tables, 'assumptions').rows.find((r) => r[2] === 'dataPrepHours')!;
    expect(row[3]).toBe('Simple 2 · Medium 3 · Complex 5');
  });

  it('lists all 142 assumptions with their calibration status', () => {
    const a = byId(tables, 'assumptions');
    expect(a.rows).toHaveLength(142);
    expect(a.rows.every((r) => r[5] === 'Uncalibrated')).toBe(true);
    const changed = structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
    changed.criticalShare = 0.35;
    const rows = byId(buildTables(source({ assumptions: changed }), tr('en')), 'assumptions').rows;
    const row = rows.find((r) => r[2] === 'criticalShare')!;
    expect(row.slice(3)).toEqual(['35%', '30%', 'Team value']);
  });

  it('flattens inputs to scalar path/value rows', () => {
    const rows = byId(tables, 'inputs').rows;
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.find((r) => r[0] === 'team.weeks')?.[1]).toBe(src.inputs.team.weeks);
    for (const [, v] of rows) expect(v === null || typeof v !== 'object').toBe(true);
  });

  it('is translated', () => {
    const vt = buildTables(src, tr('vi'));
    expect(byId(vt, 'gap').title).toBe('Chênh lệch theo nhóm');
    expect(byId(vt, 'gap').columns[0]!.header).toBe('Nhóm');
  });
});

describe('CSV', () => {
  it('writes a BOM, CRLF, quotes and unrounded numbers', () => {
    const csv = toCsv({
      id: 'gap',
      title: 'x',
      columns: [{ header: 'Name' }, { header: 'Value' }],
      rows: [
        ['a, "b"', 1.23456],
        ['line\nbreak', { formula: 'SUM(B2:B2)', result: 7 }],
        [null, true],
      ],
    });
    expect(csv.startsWith('﻿Name,Value\r\n')).toBe(true);
    expect(csv).toContain('"a, ""b""",1.23456\r\n');
    expect(csv).toContain('"line\nbreak",7\r\n');
    expect(csv).toContain(',true\r\n');
  });

  it('neutralises text a spreadsheet would run as a formula', () => {
    const csv = toCsv({
      id: 'inputs',
      title: 'x',
      columns: [{ header: 'v' }],
      rows: [['=HYPERLINK("http://x")'], ['+1'], ['-2'], ['@cmd'], [-3]],
    });
    const lines = csv.slice(1).split('\r\n');
    expect(lines.slice(1, 6)).toEqual([`"'=HYPERLINK(""http://x"")"`, "'+1", "'-2", "'@cmd", '-3']);
  });

  it('exports the example gap table with engine totals', () => {
    const gap = buildTables(source(), tr('en')).find((t) => t.id === 'gap')!;
    const last = toCsv(gap).trimEnd().split('\r\n').at(-1)!;
    const D = source().result.detailed;
    expect(last.split(',')[2]).toBe(String(D.cases));
  });
});
