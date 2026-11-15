import { versionSnapshot } from '@sit/engine';
import type { Prisma } from '@sit/db';
import {
  INPUTS_SCHEMA_VERSION,
  type DraftCreate,
  type DraftPatch,
  type LockRequest,
  type Version,
  type VersionSave,
} from '@sit/schemas';
import type { Assumptions, EstimateInputs } from '@sit/schemas';
import type { z } from 'zod';
import { can } from '@/lib/rbac';
import type { CurrentUser } from '../auth/current-user';
import { clock } from '../clock';
import { db, type DbOrTx } from '../db';
import { versionDto } from '../dto';
import { readStored } from '../stored';
import { decideLock, holdsLock, lockExpiry } from '../domain/lock';
import { HttpError } from '../http/route';
import { recordAudit } from '../repositories/audit';
import { VERSION_FULL_INCLUDE } from '../repositories/includes';
import { estimateFor, notFound, type RequestMeta } from './access';
import { changeDetail } from './change-meta';

const conflict = (message: string, reason: string, extra: Record<string, unknown> = {}) =>
  new HttpError(409, 'CONFLICT', message, [{ reason, ...extra }]);

function draftOf(tx: DbOrTx, estimateId: string) {
  return tx.estimateVersion.findFirst({
    where: { estimateId, status: 'DRAFT' },
    include: VERSION_FULL_INCLUDE,
  });
}

export async function requireOwnLockedDraft(tx: DbOrTx, user: CurrentUser, estimateId: string) {
  const draft = await draftOf(tx, estimateId);
  if (!draft) throw conflict('There is no draft. Create one first.', 'NO_DRAFT');
  if (
    !holdsLock({ holderId: draft.lockedById, expiresAt: draft.lockExpiresAt }, user.id, clock.now())
  ) {
    throw conflict('Take the edit lock before changing the draft.', 'LOCK_REQUIRED');
  }
  return draft;
}

export function snapshotData(inputs: EstimateInputs, assumptions: Assumptions) {
  const snap = versionSnapshot(inputs, assumptions);
  return {
    inputs: inputs as unknown as Prisma.InputJsonValue,
    assumptions: assumptions as unknown as Prisma.InputJsonValue,
    result: snap.result as unknown as Prisma.InputJsonValue,
    engineVersion: snap.engineVersion,
    schemaVersion: INPUTS_SCHEMA_VERSION,
    roughFte: snap.roughFte,
    detailedFte: snap.detailedFte,
    totalCasesDetailed: snap.totalCasesDetailed,
    uncalibrated: snap.uncalibrated,
  };
}

export async function getVersion(
  user: CurrentUser,
  estimateId: string,
  number: number,
): Promise<Version> {
  await estimateFor(db(), user, estimateId, 'estimate.read');
  const v = await db().estimateVersion.findUnique({
    where: { estimateId_number: { estimateId, number } },
    include: VERSION_FULL_INCLUDE,
  });
  if (!v) throw notFound();
  return versionDto(v, user.id, clock.now());
}

/** Copies a saved version (default: the latest) into a new draft, locked to the caller. */
export async function createDraft(
  user: CurrentUser,
  estimateId: string,
  input: z.output<typeof DraftCreate>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'draft.create');
    if (est.archived) throw conflict('The estimate is archived.', 'ARCHIVED');
    if (await draftOf(tx, estimateId)) throw conflict('A draft already exists.', 'DRAFT_EXISTS');
    const source = input.fromVersion
      ? await tx.estimateVersion.findUnique({
          where: { estimateId_number: { estimateId, number: input.fromVersion } },
        })
      : await tx.estimateVersion.findFirst({ where: { estimateId }, orderBy: { number: 'desc' } });
    if (!source) throw notFound();
    const last = await tx.estimateVersion.findFirst({
      where: { estimateId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const now = clock.now();
    const v = await tx.estimateVersion.create({
      data: {
        estimateId,
        number: (last?.number ?? 0) + 1,
        status: 'DRAFT',
        // Recompute: the source may have been saved by an older engine (design 6.6).
        ...(() => {
          const stored = readStored(source);
          return snapshotData(stored.inputs, stored.assumptions);
        })(),
        profileId: source.profileId,
        createdById: user.id,
        lockedById: user.id,
        lockExpiresAt: lockExpiry(now),
      },
      include: VERSION_FULL_INCLUDE,
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'estimate.draft.create',
      entity: 'EstimateVersion',
      entityId: v.id,
      projectId: est.projectId,
      detail: {
        number: v.number,
        fromVersion: source.number,
        ...changeDetail(user, input.summary),
      },
      requestId: meta.requestId,
    });
    return versionDto(v, user.id, now);
  });
}

/** Take or renew the draft lock; a QE Lead may take it over (A-06). */
export async function lockDraft(
  user: CurrentUser,
  estimateId: string,
  input: z.output<typeof LockRequest>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'draft.lock');
    const draft = await draftOf(tx, estimateId);
    if (!draft) throw conflict('There is no draft. Create one first.', 'NO_DRAFT');
    const now = clock.now();
    const d = decideLock(
      { holderId: draft.lockedById, expiresAt: draft.lockExpiresAt },
      user.id,
      now,
      {
        takeover: input.takeover,
        canTakeover: can(user, 'draft.lock.takeover', est.projectId),
      },
    );
    if (!d.ok) {
      if (d.reason === 'TAKEOVER_NOT_ALLOWED')
        throw new HttpError(403, 'FORBIDDEN', 'Only a QE Lead can take over the edit lock.');
      throw conflict('Someone else is editing this draft.', 'HELD_BY_OTHER', {
        holder: draft.lockedBy?.displayName ?? null,
      });
    }
    // Conditional update: two people racing for a free lock cannot both win.
    const updated = await tx.estimateVersion.updateMany({
      where: {
        id: draft.id,
        rowVersion: draft.rowVersion,
        lockedById: draft.lockedById,
        lockExpiresAt: draft.lockExpiresAt,
      },
      data: { lockedById: user.id, lockExpiresAt: d.expiresAt },
    });
    if (updated.count === 0) throw conflict('The draft changed; try again.', 'RACE');
    if (d.takeover) {
      await recordAudit(tx, {
        actorId: user.id,
        action: 'estimate.draft.lock.takeover',
        entity: 'EstimateVersion',
        entityId: draft.id,
        projectId: est.projectId,
        detail: { previousHolderId: draft.lockedById },
        requestId: meta.requestId,
      });
    }
    const v = await tx.estimateVersion.findUniqueOrThrow({
      where: { id: draft.id },
      include: VERSION_FULL_INCLUDE,
    });
    return versionDto(v, user.id, now);
  });
}

/** Release the lock. Only the holder can release; others get 409. */
export async function unlockDraft(user: CurrentUser, estimateId: string) {
  await estimateFor(db(), user, estimateId, 'draft.lock');
  const draft = await draftOf(db(), estimateId);
  if (!draft) throw conflict('There is no draft.', 'NO_DRAFT');
  if (
    !holdsLock({ holderId: draft.lockedById, expiresAt: draft.lockExpiresAt }, user.id, clock.now())
  ) {
    throw conflict('You do not hold the edit lock.', 'NOT_HOLDER');
  }
  await db().estimateVersion.updateMany({
    where: { id: draft.id, lockedById: user.id },
    data: { lockedById: null, lockExpiresAt: null },
  });
}

/**
 * Autosave (PATCH /draft): the server recomputes with the engine and never trusts client
 * totals (design 4.1). Optimistic locking on rowVersion; the save also renews the lock.
 * Autosaves are not audited individually; saving a version is. A request that carries a
 * `summary` (a confirmed change, e.g. from the MCP client) writes one `estimate.draft.update`
 * event; its detail names the areas changed, never their values.
 */
export async function patchDraft(
  user: CurrentUser,
  estimateId: string,
  input: z.output<typeof DraftPatch>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'draft.edit');
    const draft = await requireOwnLockedDraft(tx, user, estimateId);
    if (draft.rowVersion !== input.rowVersion) {
      throw conflict('The draft changed since you loaded it.', 'STALE', {
        rowVersion: draft.rowVersion,
      });
    }
    const stored = input.inputs && input.assumptions ? null : readStored(draft);
    const inputs = input.inputs ?? stored!.inputs;
    const assumptions = input.assumptions ?? stored!.assumptions;
    const now = clock.now();
    const updated = await tx.estimateVersion.updateMany({
      where: { id: draft.id, rowVersion: input.rowVersion, status: 'DRAFT' },
      data: {
        ...snapshotData(inputs, assumptions),
        ...(input.note !== undefined ? { note: input.note } : {}),
        rowVersion: { increment: 1 },
        lockExpiresAt: lockExpiry(now),
      },
    });
    if (updated.count === 0) throw conflict('The draft changed since you loaded it.', 'STALE');
    if (input.summary !== undefined) {
      await recordAudit(tx, {
        actorId: user.id,
        action: 'estimate.draft.update',
        entity: 'EstimateVersion',
        entityId: draft.id,
        projectId: est.projectId,
        detail: {
          number: draft.number,
          changed: [
            ...(input.inputs !== undefined ? ['inputs'] : []),
            ...(input.assumptions !== undefined ? ['assumptions'] : []),
            ...(input.note !== undefined ? ['note'] : []),
          ],
          ...changeDetail(user, input.summary),
        },
        requestId: meta.requestId,
      });
    }
    const v = await tx.estimateVersion.findUniqueOrThrow({
      where: { id: draft.id },
      include: VERSION_FULL_INCLUDE,
    });
    return versionDto(v, user.id, now);
  });
}

/** Freezes the draft as a saved, immutable version (release 1 "save version"). */
export async function saveVersion(
  user: CurrentUser,
  estimateId: string,
  input: z.output<typeof VersionSave>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'version.save');
    const draft = await requireOwnLockedDraft(tx, user, estimateId);
    const now = clock.now();
    const updated = await tx.estimateVersion.updateMany({
      where: { id: draft.id, rowVersion: draft.rowVersion, status: 'DRAFT' },
      data: {
        // Recompute at freeze time so the stored result matches the current engine.
        ...(() => {
          const stored = readStored(draft);
          return snapshotData(stored.inputs, stored.assumptions);
        })(),
        status: 'SAVED',
        // A confirmed change summary doubles as the version note when none is given.
        note: input.note ?? input.summary ?? draft.note,
        rowVersion: { increment: 1 },
        lockedById: null,
        lockExpiresAt: null,
      },
    });
    if (updated.count === 0) throw conflict('The draft changed since you loaded it.', 'STALE');
    await recordAudit(tx, {
      actorId: user.id,
      action: 'estimate.version.save',
      entity: 'EstimateVersion',
      entityId: draft.id,
      projectId: est.projectId,
      detail: { number: draft.number, ...changeDetail(user, input.summary) },
      requestId: meta.requestId,
    });
    const v = await tx.estimateVersion.findUniqueOrThrow({
      where: { id: draft.id },
      include: VERSION_FULL_INCLUDE,
    });
    return versionDto(v, user.id, now);
  });
}
