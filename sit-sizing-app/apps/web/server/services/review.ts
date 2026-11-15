import { GROUP_KEYS } from '@sit/engine';
import type { EstimateResult, ReturnRequest, ReviewNote, VersionCompare } from '@sit/schemas';
import type { z } from 'zod';
import type { CurrentUser } from '../auth/current-user';
import { clock } from '../clock';
import { db } from '../db';
import { diffJson } from '../domain/compare';
import { decideReview, type ReviewAction } from '../domain/review';
import { versionDto, versionSummaryDto } from '../dto';
import { HttpError } from '../http/route';
import { enqueue } from '../notifications/outbox';
import { recordAudit } from '../repositories/audit';
import { readStored } from '../stored';
import { VERSION_FULL_INCLUDE, VERSION_SUMMARY_INCLUDE } from '../repositories/includes';
import { estimateFor, notFound, type RequestMeta } from './access';
import { changeDetail } from './change-meta';

const ACTION_PERMISSION = {
  submit: 'version.submit',
  approve: 'version.approve',
  return: 'version.return',
} as const;
const COMMENT_KIND = { submit: 'COMMENT', approve: 'APPROVE', return: 'RETURN' } as const;
const NOTIFICATION_KIND = {
  submit: 'SUBMITTED',
  approve: 'APPROVED',
  return: 'RETURNED',
} as const;

/**
 * Submit, approve or return a saved version (design 5.2, release 2 V-01). Rules live in
 * domain/review.ts; this applies them in one transaction with the audit event.
 */
export async function reviewVersion(
  user: CurrentUser,
  estimateId: string,
  number: number,
  action: ReviewAction,
  input: z.output<typeof ReviewNote> | z.output<typeof ReturnRequest>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, ACTION_PERMISSION[action]);
    const v = await tx.estimateVersion.findUnique({
      where: { estimateId_number: { estimateId, number } },
    });
    if (!v) throw notFound();
    const otherSubmitted =
      action === 'submit' &&
      (await tx.estimateVersion.count({
        where: { estimateId, status: 'SUBMITTED', NOT: { id: v.id } },
      })) > 0;
    const d = decideReview(action, v, user.id, { otherSubmitted });
    if (!d.ok) {
      throw d.reason === 'SEGREGATION_OF_DUTIES'
        ? new HttpError(403, 'FORBIDDEN', d.message, [{ reason: d.reason }])
        : new HttpError(409, 'CONFLICT', d.message, [{ reason: d.reason }]);
    }
    const now = clock.now();
    if (action === 'approve') {
      await tx.estimateVersion.updateMany({
        where: { estimateId, status: 'APPROVED' },
        data: { status: 'SUPERSEDED' },
      });
    }
    const updated = await tx.estimateVersion.updateMany({
      where: { id: v.id, status: v.status },
      data:
        action === 'submit'
          ? { status: d.to, submittedAt: now, submittedById: user.id }
          : action === 'approve'
            ? { status: d.to, approvedAt: now, approvedById: user.id }
            : { status: d.to, submittedAt: null, submittedById: null },
    });
    if (updated.count === 0)
      throw new HttpError(409, 'CONFLICT', 'The version changed; reload and try again.', [
        { reason: 'RACE' },
      ]);
    const note = input.note?.trim();
    if (note) {
      await tx.reviewComment.create({
        data: { versionId: v.id, authorId: user.id, kind: COMMENT_KIND[action], body: note },
      });
    }
    const names = await tx.estimate.findUniqueOrThrow({
      where: { id: estimateId },
      select: { name: true, project: { select: { name: true } } },
    });
    const kind = NOTIFICATION_KIND[action];
    await enqueue(tx, {
      audience:
        kind === 'SUBMITTED'
          ? { kind, actorId: user.id }
          : { kind, actorId: user.id, authorId: v.createdById, submitterId: v.submittedById },
      projectId: est.projectId,
      versionId: v.id,
      payload: {
        actorName: user.displayName,
        projectName: names.project.name,
        estimateId,
        estimateName: names.name,
        versionNumber: number,
        ...(note ? { note } : {}),
      },
      now,
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: `estimate.version.${action}`,
      entity: 'EstimateVersion',
      entityId: v.id,
      projectId: est.projectId,
      detail: {
        number,
        to: d.to,
        ...changeDetail(user, 'summary' in input ? input.summary : undefined),
      },
      requestId: meta.requestId,
    });
    const full = await tx.estimateVersion.findUniqueOrThrow({
      where: { id: v.id },
      include: VERSION_FULL_INCLUDE,
    });
    return versionDto(full, user.id, now);
  });
}

const MAX_CHANGES = 500;
const figures = (r: EstimateResult['rough']) => ({ fte: r.fte, cases: r.cases, hours: r.hours });

/** Two versions side by side: results, groups and every changed input or assumption. */
export async function compareVersions(
  user: CurrentUser,
  estimateId: string,
  a: number,
  b: number,
): Promise<VersionCompare> {
  await estimateFor(db(), user, estimateId, 'estimate.read');
  const rows = await db().estimateVersion.findMany({
    where: { estimateId, number: { in: [a, b] } },
    include: VERSION_SUMMARY_INCLUDE,
  });
  const va = rows.find((r) => r.number === a);
  const vb = rows.find((r) => r.number === b);
  if (!va || !vb) throw notFound();
  const ra = va.result as unknown as EstimateResult;
  const rb = vb.result as unknown as EstimateResult;
  // Compare in the current shape, whatever schema version each was stored with (E-08).
  const sa = readStored(va);
  const sb = readStored(vb);
  const changes = [
    ...diffJson(sa.inputs, sb.inputs).map((c) => ({ area: 'inputs' as const, ...c })),
    ...diffJson(sa.assumptions, sb.assumptions).map((c) => ({
      area: 'assumptions' as const,
      ...c,
    })),
  ];
  return {
    a: versionSummaryDto(va),
    b: versionSummaryDto(vb),
    results: {
      rough: { a: figures(ra.rough), b: figures(rb.rough) },
      detailed: { a: figures(ra.detailed), b: figures(rb.detailed) },
    },
    groups: GROUP_KEYS.map((g) => ({
      group: g,
      aCases: ra.detailed.groups[g].cases,
      bCases: rb.detailed.groups[g].cases,
      aHours: ra.detailed.groups[g].hours,
      bHours: rb.detailed.groups[g].hours,
    })).filter((g) => g.aCases || g.bCases || g.aHours > 0.01 || g.bHours > 0.01),
    changes: changes.slice(0, MAX_CHANGES),
    truncated: changes.length > MAX_CHANGES,
  };
}
