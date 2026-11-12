import { computeBoth } from '@sit/engine';
import type { ExportQuery } from '@sit/schemas';
import { createTranslator } from 'next-intl';
import type { z } from 'zod';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';
import type { CurrentUser } from '../auth/current-user';
import { clock } from '../clock';
import { db } from '../db';
import { toCsv } from '../export/csv';
import { buildTables, type Translate } from '../export/workbook';
import { toXlsx } from '../export/xlsx';
import { recordAudit } from '../repositories/audit';
import { readStored } from '../stored';
import { estimateFor, notFound, type RequestMeta } from './access';

const MESSAGES = { en, vi } as const;
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** File name safe slug: "Synthetic · R3" → "synthetic-r3". */
export const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .slice(0, 60) || 'estimate';

/**
 * Excel workbook or one CSV table for a version (design 9.2, X-02). Figures are recomputed
 * by the engine from the stored inputs and assumptions, exactly as the editor does.
 */
export async function exportVersion(
  user: CurrentUser,
  estimateId: string,
  number: number,
  q: z.output<typeof ExportQuery>,
  meta: RequestMeta,
): Promise<{ body: Uint8Array<ArrayBuffer> | string; contentType: string; filename: string }> {
  const est = await estimateFor(db(), user, estimateId, 'estimate.export');
  const v = await db().estimateVersion.findUnique({
    where: { estimateId_number: { estimateId, number } },
    include: {
      estimate: { select: { name: true, project: { select: { name: true } } } },
      profile: { select: { name: true } },
    },
  });
  if (!v) throw notFound();
  const locale = q.lang ?? user.locale;
  const translator = createTranslator({ locale, messages: MESSAGES[locale] });
  const t: Translate = (key, values) => translator(key as never, values as never);
  const { inputs, assumptions } = readStored(v);
  const result = computeBoth(inputs, assumptions);
  const tables = buildTables(
    {
      estimateName: v.estimate.name,
      projectName: v.estimate.project.name,
      versionNumber: v.number,
      status: t(`status.${v.status}`),
      engineVersion: result.engineVersion,
      profileName: v.profile?.name ?? null,
      exportedAt: clock.now(),
      inputs,
      assumptions,
      result,
    },
    t,
  );
  await recordAudit(db(), {
    actorId: user.id,
    action: 'estimate.export',
    entity: 'EstimateVersion',
    entityId: v.id,
    projectId: est.projectId,
    detail: { number, format: q.format, ...(q.format === 'csv' ? { table: q.table } : {}) },
    requestId: meta.requestId,
  });
  const base = `sit-sizing-${slug(v.estimate.name)}-v${v.number}`;
  if (q.format === 'csv') {
    const table = tables.find((x) => x.id === q.table)!;
    return {
      body: toCsv(table),
      contentType: 'text/csv; charset=utf-8',
      filename: `${base}-${q.table}.csv`,
    };
  }
  return {
    body: await toXlsx(tables, { title: `${v.estimate.name} v${v.number}`, creator: 'SIT Sizing' }),
    contentType: XLSX,
    filename: `${base}.xlsx`,
  };
}
