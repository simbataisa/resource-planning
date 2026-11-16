import { assumptionPaths, DEFAULT_ASSUMPTIONS, uncalibratedCount } from '@sit/engine';
import type {
  Assumptions,
  EditLock,
  Estimate,
  EstimateResult,
  Profile,
  ProfileDetail,
  Project,
  ProjectRole,
  UserRef,
  Version,
  VersionSummary,
} from '@sit/schemas';
import { activeHolder } from './domain/lock';
import { readStored } from './stored';

/** Row shapes as returned by the includes in repositories/includes.ts. */
interface UserRow {
  id: string;
  displayName: string;
  email: string;
}
interface Num {
  toString(): string;
}
interface VersionRow {
  id: string;
  number: number;
  status: VersionSummary['status'];
  engineVersion: string;
  roughFte: Num;
  detailedFte: Num;
  totalCasesDetailed: number;
  uncalibrated: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: UserRow;
  submittedAt: Date | null;
  submittedBy: UserRow | null;
  approvedAt: Date | null;
  approvedBy: UserRow | null;
}
interface ReviewRow {
  id: string;
  kind: 'COMMENT' | 'RETURN' | 'APPROVE';
  body: string;
  createdAt: Date;
  author: UserRow;
}
interface FullVersionRow extends VersionRow {
  inputs: unknown;
  assumptions: unknown;
  result: unknown;
  profileId: string | null;
  schemaVersion: number;
  rowVersion: number;
  lockedById: string | null;
  lockExpiresAt: Date | null;
  lockedBy: UserRow | null;
  comments: ReviewRow[];
}

const iso = (d: Date) => d.toISOString();

export const userRef = (u: UserRow): UserRef => ({
  id: u.id,
  displayName: u.displayName,
  email: u.email,
});

export function projectDto(
  p: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    archived: boolean;
    createdAt: Date;
  },
  myRole: ProjectRole | null,
): Project {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    archived: p.archived,
    createdAt: iso(p.createdAt),
    myRole,
  };
}

export function versionSummaryDto(v: VersionRow): VersionSummary {
  return {
    id: v.id,
    number: v.number,
    status: v.status,
    engineVersion: v.engineVersion,
    roughFte: Number(v.roughFte.toString()),
    detailedFte: Number(v.detailedFte.toString()),
    totalCasesDetailed: v.totalCasesDetailed,
    uncalibrated: v.uncalibrated,
    note: v.note,
    createdBy: userRef(v.createdBy),
    createdAt: iso(v.createdAt),
    updatedAt: iso(v.updatedAt),
    submittedBy: v.submittedBy ? userRef(v.submittedBy) : null,
    submittedAt: v.submittedAt ? iso(v.submittedAt) : null,
    approvedBy: v.approvedBy ? userRef(v.approvedBy) : null,
    approvedAt: v.approvedAt ? iso(v.approvedAt) : null,
  };
}

export function lockDto(
  v: Pick<FullVersionRow, 'lockedById' | 'lockExpiresAt' | 'lockedBy'>,
  userId: string,
  now: Date,
): EditLock | null {
  const holder = activeHolder({ holderId: v.lockedById, expiresAt: v.lockExpiresAt }, now);
  if (!holder || !v.lockedBy || !v.lockExpiresAt) return null;
  return { holder: userRef(v.lockedBy), expiresAt: iso(v.lockExpiresAt), mine: holder === userId };
}

/**
 * Inputs and assumptions are upgraded from their stored schema version on read (E-08);
 * the stored result is what was computed at save time, with its engine version.
 */
export function versionDto(v: FullVersionRow, userId: string, now: Date): Version {
  const stored = readStored(v);
  return {
    ...versionSummaryDto(v),
    inputs: stored.inputs,
    assumptions: stored.assumptions,
    result: v.result as EstimateResult,
    profileId: v.profileId,
    schemaVersion: v.schemaVersion,
    rowVersion: v.rowVersion,
    lock: v.status === 'DRAFT' ? lockDto(v, userId, now) : null,
    reviews: v.comments.map((c) => ({
      id: c.id,
      kind: c.kind,
      body: c.body,
      author: userRef(c.author),
      createdAt: iso(c.createdAt),
    })),
  };
}

export function estimateDto(e: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  archived: boolean;
  createdAt: Date;
  createdBy: UserRow;
  versions: VersionRow[];
  _count: { versions: number };
}): Estimate {
  const latest = e.versions[0];
  return {
    id: e.id,
    projectId: e.projectId,
    name: e.name,
    description: e.description,
    archived: e.archived,
    createdBy: userRef(e.createdBy),
    createdAt: iso(e.createdAt),
    latest: latest ? versionSummaryDto(latest) : null,
    hasDraft: e._count.versions > 0,
  };
}

interface ProfileRow {
  id: string;
  scope: Profile['scope'];
  projectId: string | null;
  name: string;
  status: Profile['status'];
  values: unknown;
  calibration: unknown;
  basedOnId: string | null;
  createdAt: Date;
  publishedAt: Date | null;
}

export function profileDto(p: ProfileRow): Profile {
  return {
    id: p.id,
    scope: p.scope,
    projectId: p.projectId,
    name: p.name,
    status: p.status,
    // Custom-size rows count with the profile's own notes (ADR-0021).
    uncalibrated: uncalibratedCount(
      p.values as Assumptions,
      DEFAULT_ASSUMPTIONS,
      (p.calibration ?? {}) as Record<string, unknown>,
    ),
    assumptionRows: assumptionPaths(p.values as Assumptions).length,
    basedOnId: p.basedOnId,
    createdAt: iso(p.createdAt),
    publishedAt: p.publishedAt ? iso(p.publishedAt) : null,
  };
}

export function profileDetailDto(p: ProfileRow): ProfileDetail {
  return {
    ...profileDto(p),
    values: p.values as Assumptions,
    calibration: (p.calibration ?? {}) as ProfileDetail['calibration'],
  };
}
