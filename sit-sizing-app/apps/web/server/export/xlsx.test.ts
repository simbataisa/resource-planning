import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { computeBoth, DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from '@sit/engine';
import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { createTranslator } from 'next-intl';
import en from '@/messages/en.json';
import { buildTables, type Translate } from './workbook';
import { toXlsx } from './xlsx';

const t = createTranslator({ locale: 'en', messages: en });
const tr: Translate = (key, values) => t(key as never, values as never);

async function workbook() {
  const inputs = structuredClone(EXAMPLE_INPUTS) as EstimateInputs;
  const assumptions = structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
  const result = computeBoth(inputs, assumptions);
  const tables = buildTables(
    {
      estimateName: 'Synthetic · Onboarding',
      projectName: 'Synthetic',
      versionNumber: 1,
      status: 'Saved',
      engineVersion: result.engineVersion,
      profileName: null,
      exportedAt: new Date('2026-11-12T07:00:00Z'),
      inputs,
      assumptions,
      result,
    },
    tr,
  );
  const bytes = await toXlsx(tables, { title: 'Synthetic', creator: 'SIT Sizing' });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as never);
  return { wb, result };
}

describe('Excel workbook (X-02 acceptance: totals equal the engine output)', () => {
  it('writes five sheets with frozen headers', async () => {
    const { wb } = await workbook();
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Summary',
      'Drivers',
      'Gap by group',
      'Assumptions',
      'Inputs',
    ]);
    expect(wb.getWorksheet('Gap by group')!.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });

  it('gap totals are SUM formulas whose results are the engine totals', async () => {
    const { wb, result } = await workbook();
    const ws = wb.getWorksheet('Gap by group')!;
    const last = ws.getRow(ws.rowCount);
    expect(last.getCell(1).value).toBe('Total');
    const cell = (c: number) => last.getCell(c).value as { formula: string; result: number };
    expect(cell(2).formula).toBe(`SUM(B2:B${ws.rowCount - 1})`);
    expect(cell(2).result).toBe(result.rough.cases);
    expect(cell(3).result).toBe(result.detailed.cases);
    expect(cell(6).result).toBeCloseTo(result.detailed.hours, 9);
    // The rows above add up to the same totals.
    let cases = 0;
    for (let r = 2; r < ws.rowCount; r++) cases += ws.getRow(r).getCell(3).value as number;
    expect(cases).toBe(result.detailed.cases);
  });

  it('shifts formulas below the notes and formats numbers', async () => {
    const { wb, result } = await workbook();
    const ws = wb.getWorksheet('Summary')!;
    expect(String(ws.getRow(1).getCell(1).value)).toMatch(/^Planning range/);
    const fte = [...Array(ws.rowCount).keys()]
      .map((i) => ws.getRow(i + 1))
      .find((r) => r.getCell(1).value === 'FTE')!;
    expect(fte.getCell(3).value).toBe(result.detailed.fte);
    expect(fte.getCell(3).numFmt).toBe('0.0');
  });
});
