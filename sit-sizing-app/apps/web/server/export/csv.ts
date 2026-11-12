import { cellValue, type Cell, type Table } from './workbook';

/**
 * One table as CSV (RFC 4180, CRLF, UTF-8 with BOM so Excel reads Vietnamese correctly).
 * Text that a spreadsheet would run as a formula (= + - @, tab, CR) is prefixed with an
 * apostrophe (OWASP CSV injection). Numbers are written unrounded.
 */
export function toCsv(table: Table): string {
  const lines = [table.columns.map((c) => field(c.header)), ...table.rows.map((r) => r.map(field))];
  return `﻿${lines.map((l) => l.join(',')).join('\r\n')}\r\n`;
}

function field(c: Cell): string {
  const v = cellValue(c);
  if (v === null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
