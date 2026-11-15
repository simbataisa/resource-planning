import { DEFAULT_ASSUMPTIONS } from '@sit/engine';
import type { Prisma } from '@sit/db';
import {
  Assumptions,
  type ProfileApply,
  type ProfileCreate,
  type ProfileListQuery,
  type ProfileUpdate,
} from '@sit/schemas';
import type { z } from 'zod';
import { can } from '@/lib/rbac';
import type { CurrentUser } from '../auth/current-user';
import { clock } from '../clock';
import { db, type DbOrTx } from '../db';
import { lockExpiry } from '../domain/lock';
import {
  applicable,
  decideProfile,
  managePermission,
  unknownCalibrationPaths,
} from '../domain/profiles';
import { profileDetailDto, profileDto, versionDto } from '../dto';
import { HttpError } from '../http/route';
import { enqueue } from '../notifications/outbox';
import { recordAudit } from '../repositories/audit';
import { VERSION_FULL_INCLUDE } from '../repositories/includes';
import { ensure, estimateFor, notFound, projectFor, type RequestMeta } from './access';
import { changeDetail } from './change-meta';
import { readStored } from '../stored';
import { requireOwnLockedDraft, snapshotData } from './versions';

/**
 * Global profiles (published, plus drafts for Admin) and, when a project is given,
 * that project's profiles.
 */
export async function listProfiles(user: CurrentUser, q: z.output<typeof ProfileListQuery>) {
  ensure(user, 'profile.global.read');
  const isAdmin = user.globalRole === 'ADMIN';
  const or: Prisma.AssumptionProfileWhereInput[] = [
    { scope: 'GLOBAL', ...(isAdmin ? {} : { status: 'PUBLISHED' as const }) },
  ];
  if (q.projectId) {
    ensure(user, 'profile.project.read', q.projectId);
    or.push({ scope: 'PROJECT', projectId: q.projectId });
  }
  const rows = await db().assumptionProfile.findMany({
    where: { OR: or },
    orderBy: [{ scope: 'asc' }, { name: 'asc' }],
  });
  return { items: rows.map(profileDto) };
}

export async function getProfile(user: CurrentUser, id: string) {
  const p = await db().assumptionProfile.findUnique({ where: { id } });
  if (!p || !readable(user, p)) throw notFound();
  return profileDetailDto(p);
}

// ---------- release 2, P-01: create, edit, publish, retire, apply ----------

const conflict = (message: string, reason: string) =>
  new HttpError(409, 'CONFLICT', message, [{ reason }]);

/** Loads a profile the caller can see (404 otherwise) and checks they may manage it (403). */
async function managedProfile(tx: DbOrTx, user: CurrentUser, id: string) {
  const p = await tx.assumptionProfile.findUnique({ where: { id } });
  if (!p || !readable(user, p)) throw notFound();
  ensure(user, managePermission(p.scope), p.projectId ?? undefined);
  return p;
}

function readable(
  user: CurrentUser,
  p: { scope: 'GLOBAL' | 'PROJECT'; status: string; projectId: string | null },
) {
  if (p.scope === 'GLOBAL') return p.status === 'PUBLISHED' || user.globalRole === 'ADMIN';
  return Boolean(p.projectId && can(user, 'profile.project.read', p.projectId));
}

async function ensureNameFree(
  tx: DbOrTx,
  scope: 'GLOBAL' | 'PROJECT',
  projectId: string | null,
  name: string,
  exceptId?: string,
) {
  // Checked here as well as by the unique index: Postgres treats NULL project ids as distinct.
  const clash = await tx.assumptionProfile.findFirst({
    where: { scope, projectId, name, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw conflict('A profile with that name already exists here.', 'NAME_TAKEN');
}

function checkCalibration(calibration: Record<string, unknown>) {
  const bad = unknownCalibrationPaths(calibration);
  if (bad.length)
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Calibration notes must refer to assumption rows.',
      bad.map((k) => ({ path: ['calibration', k] })),
    );
}

export async function createProfile(
  user: CurrentUser,
  input: z.output<typeof ProfileCreate>,
  meta: RequestMeta,
) {
  const projectId = input.scope === 'PROJECT' ? (input.projectId ?? null) : null;
  return db().$transaction(async (tx) => {
    if (projectId) await projectFor(tx, user, projectId, 'profile.project.manage');
    else ensure(user, 'profile.global.manage');
    let values: unknown = DEFAULT_ASSUMPTIONS;
    let calibration: unknown = {};
    if (input.basedOnId) {
      const src = await tx.assumptionProfile.findUnique({ where: { id: input.basedOnId } });
      // A project profile may start from a global one, never from another project's.
      if (!src || !readable(user, src) || (src.scope === 'PROJECT' && src.projectId !== projectId))
        throw new HttpError(422, 'VALIDATION_FAILED', 'That profile cannot be cloned here.', [
          { path: ['basedOnId'] },
        ]);
      values = src.values;
      calibration = src.calibration;
    }
    await ensureNameFree(tx, input.scope, projectId, input.name);
    const p = await tx.assumptionProfile.create({
      data: {
        scope: input.scope,
        projectId,
        name: input.name,
        status: 'DRAFT',
        values: values as Prisma.InputJsonValue,
        calibration: calibration as Prisma.InputJsonValue,
        basedOnId: input.basedOnId ?? null,
        createdById: user.id,
      },
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'profile.create',
      entity: 'AssumptionProfile',
      entityId: p.id,
      projectId,
      detail: { scope: p.scope, basedOnId: p.basedOnId },
      requestId: meta.requestId,
    });
    return profileDetailDto(p);
  });
}

export async function updateProfile(
  user: CurrentUser,
  id: string,
  input: z.output<typeof ProfileUpdate>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const p = await managedProfile(tx, user, id);
    const d = decideProfile('update', p);
    if (!d.ok) throw conflict(d.message, d.reason);
    if (input.calibration) checkCalibration(input.calibration);
    if (input.name && input.name !== p.name)
      await ensureNameFree(tx, p.scope, p.projectId, input.name, p.id);
    const updated = await tx.assumptionProfile.update({
      where: { id: p.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.values ? { values: input.values as unknown as Prisma.InputJsonValue } : {}),
        ...(input.calibration
          ? { calibration: input.calibration as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'profile.update',
      entity: 'AssumptionProfile',
      entityId: p.id,
      projectId: p.projectId,
      detail: { fields: Object.keys(input) },
      requestId: meta.requestId,
    });
    return profileDetailDto(updated);
  });
}

/** Publish (DRAFT → PUBLISHED) or retire (PUBLISHED → RETIRED). */
export async function changeProfileStatus(
  user: CurrentUser,
  id: string,
  action: 'publish' | 'retire',
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const p = await managedProfile(tx, user, id);
    const otherPublishedGlobal =
      action === 'retire' && p.scope === 'GLOBAL'
        ? await tx.assumptionProfile.count({
            where: { scope: 'GLOBAL', status: 'PUBLISHED', NOT: { id: p.id } },
          })
        : 1;
    const d = decideProfile(action, p, { otherPublishedGlobal });
    if (!d.ok) throw conflict(d.message, d.reason);
    const now = clock.now();
    const updated = await tx.assumptionProfile.updateMany({
      where: { id: p.id, status: p.status },
      data: { status: d.to, ...(action === 'publish' ? { publishedAt: now } : {}) },
    });
    if (updated.count === 0) throw conflict('The profile changed; reload and try again.', 'RACE');
    if (action === 'publish') {
      const project = p.projectId
        ? await tx.project.findUnique({ where: { id: p.projectId }, select: { name: true } })
        : null;
      await enqueue(tx, {
        audience: { kind: 'PROFILE_PUBLISHED', actorId: user.id, scope: p.scope },
        projectId: p.projectId,
        payload: {
          actorName: user.displayName,
          projectName: project?.name ?? null,
          profileId: p.id,
          profileName: p.name,
        },
        now,
      });
    }
    await recordAudit(tx, {
      actorId: user.id,
      action: `profile.${action}`,
      entity: 'AssumptionProfile',
      entityId: p.id,
      projectId: p.projectId,
      detail: { to: d.to },
      requestId: meta.requestId,
    });
    return profileDetailDto(await tx.assumptionProfile.findUniqueOrThrow({ where: { id: p.id } }));
  });
}

/**
 * Apply a published profile to the open draft (P-01): its values replace the draft's
 * assumptions and the server recomputes. Lock holder only, with optimistic locking.
 */
export async function applyProfile(
  user: CurrentUser,
  estimateId: string,
  input: z.output<typeof ProfileApply>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'draft.edit');
    const draft = await requireOwnLockedDraft(tx, user, estimateId);
    if (draft.rowVersion !== input.rowVersion)
      throw new HttpError(409, 'CONFLICT', 'The draft changed since you loaded it.', [
        { reason: 'STALE', rowVersion: draft.rowVersion },
      ]);
    const p = await tx.assumptionProfile.findUnique({ where: { id: input.profileId } });
    if (!p || !applicable(p, est.projectId))
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'That assumption profile cannot be used here.',
        [{ path: ['profileId'] }],
      );
    const assumptions = Assumptions.parse(p.values);
    const now = clock.now();
    const updated = await tx.estimateVersion.updateMany({
      where: { id: draft.id, rowVersion: input.rowVersion, status: 'DRAFT' },
      data: {
        ...snapshotData(readStored(draft).inputs, assumptions),
        profileId: p.id,
        rowVersion: { increment: 1 },
        lockExpiresAt: lockExpiry(now),
      },
    });
    if (updated.count === 0)
      throw new HttpError(409, 'CONFLICT', 'The draft changed since you loaded it.', [
        { reason: 'STALE' },
      ]);
    await recordAudit(tx, {
      actorId: user.id,
      action: 'estimate.draft.profile.apply',
      entity: 'EstimateVersion',
      entityId: draft.id,
      projectId: est.projectId,
      detail: {
        number: draft.number,
        profileId: p.id,
        previousProfileId: draft.profileId,
        ...changeDetail(user, input.summary),
      },
      requestId: meta.requestId,
    });
    const v = await tx.estimateVersion.findUniqueOrThrow({
      where: { id: draft.id },
      include: VERSION_FULL_INCLUDE,
    });
    return versionDto(v, user.id, now);
  });
}
