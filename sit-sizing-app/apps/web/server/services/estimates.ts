import { blankInputs, EXAMPLE_INPUTS, versionSnapshot } from '@sit/engine';
import type { Prisma } from '@sit/db';
import {
  INPUTS_SCHEMA_VERSION,
  type EstimateCreate,
  type EstimateDetail,
  type PageQuery,
} from '@sit/schemas';
import type { z } from 'zod';
import type { CurrentUser } from '../auth/current-user';
import { clock } from '../clock';
import { db, type DbOrTx } from '../db';
import { estimateDto, lockDto, versionSummaryDto } from '../dto';
import { lockExpiry } from '../domain/lock';
import { newLockToken } from '../domain/lock-token';
import { applicable, profileAssumptions } from '../domain/profiles';
import { HttpError } from '../http/route';
import { recordAudit } from '../repositories/audit';
import { ESTIMATE_DETAIL_INCLUDE, ESTIMATE_LIST_INCLUDE } from '../repositories/includes';
import { pageArgs, toPage } from '../repositories/pagination';
import { estimateFor, projectFor, type RequestMeta } from './access';
import { changeDetail } from './change-meta';

export async function listEstimates(user: CurrentUser, projectId: string, q: PageQuery) {
  await projectFor(db(), user, projectId, 'estimate.list');
  const rows = await db().estimate.findMany({
    where: { projectId },
    include: ESTIMATE_LIST_INCLUDE,
    ...pageArgs(q),
  });
  return toPage(rows, q, estimateDto);
}

export async function getEstimate(user: CurrentUser, estimateId: string): Promise<EstimateDetail> {
  await estimateFor(db(), user, estimateId, 'estimate.read');
  const e = await db().estimate.findUniqueOrThrow({
    where: { id: estimateId },
    include: ESTIMATE_DETAIL_INCLUDE,
  });
  const draft = e.versions.find((v) => v.status === 'DRAFT');
  return {
    ...estimateDto({ ...e, versions: e.versions.slice(0, 1), _count: { versions: draft ? 1 : 0 } }),
    versions: e.versions.map(versionSummaryDto),
    draftLock: draft ? lockDto(draft, user.id, clock.now()) : null,
  };
}

/**
 * The assumption profile for a new estimate: the one asked for (global, or from the same
 * project and readable by the caller), otherwise the oldest published global profile.
 */
export async function resolveProfile(
  tx: DbOrTx,
  user: CurrentUser,
  projectId: string,
  profileId?: string,
) {
  if (profileId) {
    const p = await tx.assumptionProfile.findUnique({ where: { id: profileId } });
    // Published profiles only (P-01): a draft profile can still change under the estimate.
    if (!p || !applicable(p, projectId)) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'That assumption profile cannot be used here.',
        [{ path: ['profileId'] }],
      );
    }
    return p;
  }
  const p = await tx.assumptionProfile.findFirst({
    where: { scope: 'GLOBAL', status: 'PUBLISHED' },
    orderBy: { createdAt: 'asc' },
  });
  if (!p)
    throw new HttpError(
      409,
      'CONFLICT',
      'No published global assumption profile. Run the seed or publish one.',
    );
  return p;
}

/** Creates the estimate with draft version 1, locked to its creator (with a lock token). */
export async function createEstimate(
  user: CurrentUser,
  projectId: string,
  input: z.output<typeof EstimateCreate>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const project = await projectFor(tx, user, projectId, 'estimate.create');
    if (project.archived) throw new HttpError(409, 'CONFLICT', 'The project is archived.');
    const profile = await resolveProfile(tx, user, projectId, input.profileId);
    const assumptions = profileAssumptions(profile.values, profile.calibration);
    const inputs = input.template === 'blank' ? blankInputs() : structuredClone(EXAMPLE_INPUTS);
    const snap = versionSnapshot(inputs, assumptions);
    const now = clock.now();
    const token = newLockToken();
    const e = await tx.estimate.create({
      data: {
        projectId,
        name: input.name,
        description: input.description ?? null,
        createdById: user.id,
        versions: {
          create: {
            number: 1,
            status: 'DRAFT',
            inputs: inputs as unknown as Prisma.InputJsonValue,
            assumptions: assumptions as unknown as Prisma.InputJsonValue,
            profileId: profile.id,
            result: snap.result as unknown as Prisma.InputJsonValue,
            engineVersion: snap.engineVersion,
            schemaVersion: INPUTS_SCHEMA_VERSION,
            roughFte: snap.roughFte,
            detailedFte: snap.detailedFte,
            totalCasesDetailed: snap.totalCasesDetailed,
            uncalibrated: snap.uncalibrated,
            assumptionRows: snap.assumptionRows,
            createdById: user.id,
            lockedById: user.id,
            lockExpiresAt: lockExpiry(now),
            lockTokenHash: token.hash,
          },
        },
      },
      include: ESTIMATE_LIST_INCLUDE,
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'estimate.create',
      entity: 'Estimate',
      entityId: e.id,
      projectId,
      detail: {
        template: input.template,
        profileId: profile.id,
        ...changeDetail(user, input.summary),
      },
      requestId: meta.requestId,
    });
    return { ...estimateDto(e), lockToken: token.token };
  });
}
