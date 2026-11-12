import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as exportRoute from '@/app/api/v1/estimates/[estimateId]/versions/[number]/export/route';
import { DEV_USER_HEADER } from '@/server/auth/current-user';
import { db } from '@/server/db';
import { seeded, type Who } from './helpers';

/** X-02 through the route handler: file headers, permissions, audit, engine totals. */
let estimateId: string;
let number: number;
let detailedFte: number;

beforeAll(async () => {
  const { example } = await seeded();
  estimateId = example.id;
  const v = await db().estimateVersion.findFirstOrThrow({
    where: { estimateId },
    orderBy: { number: 'asc' },
  });
  number = v.number;
  detailedFte = Number(v.detailedFte);
});

async function get(who: Who, query: string) {
  const headers: Record<string, string> = {};
  if (who) headers[DEV_USER_HEADER] = who;
  const res = await exportRoute.GET(
    new Request(
      `http://localhost:3000/api/v1/estimates/${estimateId}/versions/${number}/export?${query}`,
      {
        headers,
      },
    ),
    { params: Promise.resolve({ estimateId, number: String(number) }) },
  );
  return res;
}

describe('GET …/versions/{n}/export', () => {
  it('returns an Excel workbook to a Viewer, with the engine figures', async () => {
    const res = await get('dev-viewer', 'format=xlsx&lang=en');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="sit-sizing-example-estimate-v\d+\.xlsx"$/,
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()) as never);
    const ws = wb.getWorksheet('Summary')!;
    let fte: number | undefined;
    ws.eachRow((r) => {
      if (r.getCell(1).value === 'FTE') fte = r.getCell(3).value as number;
    });
    // The stored figure is rounded to 2 decimals; the workbook has the engine's full value.
    expect(fte).toBeCloseTo(detailedFte, 2);
  });

  it('returns one CSV table, in Vietnamese when asked', async () => {
    const res = await get('dev-viewer', 'format=csv&table=gap&lang=vi');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    // Read bytes: Response.text() strips a leading BOM (Fetch spec UTF-8 decode).
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    expect(text.startsWith('﻿Nhóm,')).toBe(true);
    expect(text.trimEnd().split('\r\n').at(-1)!.startsWith('Tổng,')).toBe(true);
  });

  it('audits the export', async () => {
    const before = await db().auditEvent.count({ where: { action: 'estimate.export' } });
    await get('dev-estimator', 'format=csv&table=assumptions');
    expect(await db().auditEvent.count({ where: { action: 'estimate.export' } })).toBe(before + 1);
  });

  it('hides the estimate from non-members and rejects bad queries', async () => {
    expect((await get('dev-outsider', 'format=xlsx')).status).toBe(404);
    expect((await get(null, 'format=xlsx')).status).toBe(401);
    expect((await get('dev-viewer', 'format=pdf')).status).toBe(400);
  });
});
