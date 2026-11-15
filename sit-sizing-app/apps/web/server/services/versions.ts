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
import { decideLock, holdsLock, lockExpiry, lockUse } from '../domain/lock';
import { hashLockToken, newLockToken } from '../domain/lock-token';
import { HttpError } from '../http/route';
import { recordAudit } from '../repositories/audit';
import { VERSION_FULL_INCLUDE } from '../repositories/includes';
import { estimateFor, notFound, type RequestMeta } from './access';
import { changeDetail } from './change-meta';

const conflict = (message: string, reason: string, extra: Record<string, unknown> = {}) =>
  new HttpError(409, 'CONFLICT', message, [{ reason, ...extra }]);

/** The draft lock is mine but held by another tab or assistant session (another token). */
export const lockedElsewhere = () =>
  conflict('This draft is open in another tab or in the assistant.', 'LOCKED_ELSEWHERE');

const presentedHash = (lockToken: string | undefined) =>
  lockToken ? hashLockToken(lockToken) : null;

function draftOf(tx: DbOrTx, estimateId: string) {
  return tx.estimateVersion.findFirst({
    where: { estimateId, status: 'DRAFT' },
    include: VERSION_FULL_INCLUDE,
  });
}

/**
 * The draft, if the caller holds its lock and presents the lock token (X-Lock-Token).
 * Not the holder → LOCK_REQUIRED; the holder with no or another token → LOCKED_ELSEWHERE.
 */
export async function requireOwnLockedDraft(
  tx: DbOrTx,
  user: CurrentUser,
  estimateId: string,
  lockToken: string | undefined,
) {
  const draft = await draftOf(tx, estimateId);
  if (!draft) throw conflict('There is no draft. Create one first.', 'NO_DRAFT');
  const use = lockUse(
    { holderId: draft.lockedById, expiresAt: draft.lockExpiresAt, tokenHash: draft.lockTokenHash },
    user.id,
    clock.now(),
    presentedHash(lockToken),
  );
  if (!use.ok) {
    if (use.reason === 'LOCKED_ELSEWHERE') throw lockedElsewhere();
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

/** Copies a saved version (default: the latest) into a new draft, locked to the caller (with a token). */
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
    const token = newLockToken();
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
        lockTokenHash: token.hash,
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
    return { ...versionDto(v, user.id, now), lockToken: token.token };
  });
}

/**
 * Take or renew the draft lock; a QE Lead may take it over (A-06). Taking a free or expired
 * lock, or taking one over, issues a new token (returned once); renewal needs the current one.
 * A holder without it may take over their own lock on purpose (`takeover: true`, any role).
 */
export async function lockDraft(
  user: CurrentUser,
  estimateId: string,
  input: z.output<typeof LockRequest>,
  meta: RequestMeta,
  lockToken?: string,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'draft.lock');
    const draft = await draftOf(tx, estimateId);
    if (!draft) throw conflict('There is no draft. Create one first.', 'NO_DRAFT');
    const now = clock.now();
    const d = decideLock(
      {
        holderId: draft.lockedById,
        expiresAt: draft.lockExpiresAt,
        tokenHash: draft.lockTokenHash,
      },
      user.id,
      now,
      {
        takeover: input.takeover,
        canTakeover: can(user, 'draft.lock.takeover', est.projectId),
        tokenHash: presentedHash(lockToken),
      },
    );
    if (!d.ok) {
      if (d.reason === 'TAKEOVER_NOT_ALLOWED')
        throw new HttpError(403, 'FORBIDDEN', 'Only a QE Lead can take over the edit lock.');
      if (d.reason === 'LOCKED_ELSEWHERE') throw lockedElsewhere();
      throw conflict('Someone else is editing this draft.', 'HELD_BY_OTHER', {
        holder: draft.lockedBy?.displayName ?? null,
      });
    }
    const token = d.newToken ? newLockToken() : null;
    // Conditional update: two callers racing for a free lock (or two tabs) cannot both win.
    const updated = await tx.estimateVersion.updateMany({
      where: {
        id: draft.id,
        rowVersion: draft.rowVersion,
        lockedById: draft.lockedById,
        lockExpiresAt: draft.lockExpiresAt,
        lockTokenHash: draft.lockTokenHash,
      },
      data: {
        lockedById: user.id,
        lockExpiresAt: d.expiresAt,
        ...(token ? { lockTokenHash: token.hash } : {}),
      },
    });
    if (updated.count === 0) throw conflict('The draft changed; try again.', 'RACE');
    if (d.takeover) {
      await recordAudit(tx, {
        actorId: user.id,
        action: 'estimate.draft.lock.takeover',
        entity: 'EstimateVersion',
        entityId: draft.id,
        projectId: est.projectId,
        detail: { previousHolderId: draft.lockedById, ...(d.own ? { own: true } : {}) },
        requestId: meta.requestId,
      });
    }
    const v = await tx.estimateVersion.findUniqueOrThrow({
      where: { id: draft.id },
      include: VERSION_FULL_INCLUDE,
    });
    return { ...versionDto(v, user.id, now), ...(token ? { lockToken: token.token } : {}) };
  });
}

/**
 * Release the lock. Only the holder, with the lock token, can release; others get 409 and
 * the lock (and its hash) stay in place.
 */
export async function unlockDraft(user: CurrentUser, estimateId: string, lockToken?: string) {
  await estimateFor(db(), user, estimateId, 'draft.lock');
  const draft = await draftOf(db(), estimateId);
  if (!draft) throw conflict('There is no draft.', 'NO_DRAFT');
  const state = {
    holderId: draft.lockedById,
    expiresAt: draft.lockExpiresAt,
    tokenHash: draft.lockTokenHash,
  };
  if (!holdsLock(state, user.id, clock.now())) {
    throw conflict('You do not hold the edit lock.', 'NOT_HOLDER');
  }
  const hash = presentedHash(lockToken);
  if (!lockUse(state, user.id, clock.now(), hash).ok) throw lockedElsewhere();
  // Conditional on the token: a takeover between the check and here keeps its lock.
  const released = await db().estimateVersion.updateMany({
    where: { id: draft.id, lockedById: user.id, lockTokenHash: hash },
    data: { lockedById: null, lockExpiresAt: null, lockTokenHash: null },
  });
  if (released.count === 0) throw lockedElsewhere();
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
  lockToken?: string,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'draft.edit');
    const draft = await requireOwnLockedDraft(tx, user, estimateId, lockToken);
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
      where: {
        id: draft.id,
        rowVersion: input.rowVersion,
        status: 'DRAFT',
        lockTokenHash: draft.lockTokenHash,
      },
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
  lockToken?: string,
) {
  return db().$transaction(async (tx) => {
    const est = await estimateFor(tx, user, estimateId, 'version.save');
    const draft = await requireOwnLockedDraft(tx, user, estimateId, lockToken);
    const now = clock.now();
    const updated = await tx.estimateVersion.updateMany({
      where: {
        id: draft.id,
        rowVersion: draft.rowVersion,
        status: 'DRAFT',
        lockTokenHash: draft.lockTokenHash,
      },
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
        lockTokenHash: null,
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
