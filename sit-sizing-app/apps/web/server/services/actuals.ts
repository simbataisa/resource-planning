import type { Prisma } from '@sit/db';
import {
  ActualsData,
  Assumptions,
  EstimateResult,
  type Actuals,
  type ActualsCreate,
} from '@sit/schemas';
import type { z } from 'zod';
import { can } from '@/lib/rbac';
import type { CurrentUser } from '../auth/current-user';
import { db, type DbOrTx } from '../db';
import { userRef } from '../dto';
import { canRecordActuals, variance } from '../domain/variance';
import { HttpError } from '../http/route';
import { recordAudit } from '../repositories/audit';
import { USER_REF } from '../repositories/includes';
import { estimateFor, notFound, type RequestMeta } from './access';

const conflict = (message: string, reason: string) =>
  new HttpError(409, 'CONFLICT', message, [{ reason }]);

async function versionOf(tx: DbOrTx, estimateId: string, number: number) {
  const v = await tx.estimateVersion.findUnique({
    where: { estimateId_number: { estimateId, number } },
    select: { id: true, number: true, status: true, result: true, assumptions: true },
  });
  if (!v) throw notFound();
  return v;
}

type Row = Prisma.ActualsGetPayload<{ include: { recordedBy: typeof USER_REF } }>;

function actualsDto(
  row: Row,
  v: { number: number; result: unknown; assumptions: unknown },
): Actuals {
  const data = ActualsData.parse(row.data);
  return {
    id: row.id,
    versionNumber: v.number,
    cycleLabel: row.cycleLabel,
    data,
    note: row.note,
    recordedBy: userRef(row.recordedBy),
    recordedAt: row.recordedAt.toISOString(),
    variance: variance(EstimateResult.parse(v.result), Assumptions.parse(v.assumptions), data),
  };
}

/** The cycles recorded against a version, with their variance (P-02). */
export async function listActuals(user: CurrentUser, estimateId: string, number: number) {
  await estimateFor(db(), user, estimateId, 'actuals.read');
  const v = await versionOf(db(), estimateId, number);
  const rows = await db().actuals.findMany({
    where: { versionId: v.id },
    orderBy: { recordedAt: 'asc' },
    include: { recordedBy: USER_REF },
  });
  return { items: rows.map((r) => actualsDto(r, v)) };
}

/** Records one SIT cycle against an approved (or since superseded) version. */
export async function recordActuals(
  user: CurrentUser,
  estimateId: string,
  number: number,
  input: z.output<typeof ActualsCreate>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'actuals.record');
    const v = await versionOf(tx, estimateId, number);
    if (!canRecordActuals(v.status))
      throw conflict('Record actuals against an approved version.', 'NOT_APPROVED');
    const clash = await tx.actuals.findUnique({
      where: { versionId_cycleLabel: { versionId: v.id, cycleLabel: input.cycleLabel } },
      select: { id: true },
    });
    if (clash) throw conflict('This cycle is already recorded for the version.', 'CYCLE_EXISTS');
    const row = await tx.actuals.create({
      data: {
        versionId: v.id,
        cycleLabel: input.cycleLabel,
        data: input.data as unknown as Prisma.InputJsonValue,
        note: input.note ?? null,
        recordedById: user.id,
      },
      include: { recordedBy: USER_REF },
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'actuals.record',
      entity: 'Actuals',
      entityId: row.id,
      projectId: est.projectId,
      detail: { number, cycleLabel: input.cycleLabel },
      requestId: meta.requestId,
    });
    return actualsDto(row, v);
  });
}

/** Removes a mistaken record: the person who recorded it, or a QE Lead of the project. */
export async function deleteActuals(
  user: CurrentUser,
  estimateId: string,
  number: number,
  actualsId: string,
  meta: RequestMeta,
) {
  await db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'actuals.record');
    const v = await versionOf(tx, estimateId, number);
    const row = await tx.actuals.findFirst({ where: { id: actualsId, versionId: v.id } });
    if (!row) throw notFound();
    if (row.recordedById !== user.id && !can(user, 'version.approve', est.projectId))
      throw new HttpError(
        403,
        'FORBIDDEN',
        'Only the person who recorded it or a QE Lead can remove it.',
      );
    await tx.actuals.delete({ where: { id: row.id } });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'actuals.delete',
      entity: 'Actuals',
      entityId: row.id,
      projectId: est.projectId,
      detail: { number, cycleLabel: row.cycleLabel },
      requestId: meta.requestId,
    });
  });
}
