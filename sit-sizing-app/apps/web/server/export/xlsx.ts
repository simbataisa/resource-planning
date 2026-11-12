import ExcelJS from 'exceljs';
import { colorTokens } from '@sit/tokens';
import type { Cell, Format, Table } from './workbook';

const NUMBER_FORMAT: Record<Format, string | undefined> = {
  text: undefined,
  int: '#,##0',
  fte: '0.0',
  hours: '#,##0',
  pct: '0%',
  num: '#,##0.0',
  date: 'yyyy-mm-dd',
};

/** Excel sheet names: at most 31 characters, none of : \ / ? * [ ]. */
const sheetName = (s: string) => s.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;

/**
 * Renders the export tables as an .xlsx workbook (ExcelJS). Header rows use the brand
 * colour, totals rows are bold formulas with the engine totals as cached results, and the
 * header row is frozen.
 */
export async function toXlsx(tables: Table[], meta: { title: string; creator: string }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.creator;
  wb.title = meta.title;
  wb.created = new Date(0); // deterministic files; the export time is in the Summary sheet
  for (const t of tables) {
    const ws = wb.addWorksheet(sheetName(t.title), {
      views: [{ state: 'frozen', ySplit: (t.notes?.length ?? 0) + 1 }],
    });
    for (const note of t.notes ?? []) {
      const r = ws.addRow([note]);
      r.font = { italic: true, color: { argb: 'FF595959' } };
    }
    const header = ws.addRow(t.columns.map((c) => c.header));
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argb(colorTokens.light.brand) },
      };
    });
    const offset = header.number - 1; // formulas in the model assume the header is row 1
    t.rows.forEach((cells, i) => {
      const row = ws.addRow(cells.map((c) => toExcel(c, offset)));
      if (t.totalsFrom !== undefined && i >= t.totalsFrom) row.font = { bold: true };
      const fmt = t.rowFormats?.[i];
      if (fmt && NUMBER_FORMAT[fmt])
        row.eachCell((cell) => {
          if (typeof cell.value === 'number') cell.numFmt = NUMBER_FORMAT[fmt]!;
        });
    });
    t.columns.forEach((c, i) => {
      const column = ws.getColumn(i + 1);
      column.width = c.width ?? 16;
      const fmt = c.format ? NUMBER_FORMAT[c.format] : undefined;
      if (fmt) column.numFmt = fmt;
    });
  }
  // A plain Uint8Array, which Response accepts as a body.
  return Uint8Array.from(Buffer.from(await wb.xlsx.writeBuffer()));
}

/** Shifts the model's row references when notes push the table down. */
function toExcel(c: Cell, offset: number): ExcelJS.CellValue {
  if (c !== null && typeof c === 'object') {
    const formula = offset
      ? c.formula.replace(
          /([A-Z])(\d+)/g,
          (_, col: string, row: string) => `${col}${+row + offset}`,
        )
      : c.formula;
    return { formula, result: c.result };
  }
  return c;
}
