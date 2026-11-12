import { z } from 'zod';
import { Assumptions } from './assumptions';
import { EstimateInputs } from './inputs';
import { EstimateResult } from './result';

/**
 * REST API request and response shapes (design 9). These schemas are the API
 * contract: route handlers parse with them, the Axios client parses responses
 * with them, and the OpenAPI document is generated from them (design 9.4).
 * Examples use synthetic data only.
 */

/** Version of the EstimateInputs payload shape stored in EstimateVersion.schemaVersion. */
export const INPUTS_SCHEMA_VERSION = 1;

export const Id = z
  .string()
  .min(1)
  .max(40)
  .meta({ description: 'Opaque identifier (cuid)', example: 'clx0synthetic0001' });
export const IsoDateTime = z.iso.datetime();

export const GLOBAL_ROLES = ['USER', 'ADMIN'] as const;
export const GlobalRole = z.enum(GLOBAL_ROLES);
export type GlobalRole = z.infer<typeof GlobalRole>;

export const PROJECT_ROLES = ['VIEWER', 'ESTIMATOR', 'QE_LEAD'] as const;
export const ProjectRole = z.enum(PROJECT_ROLES);
export type ProjectRole = z.infer<typeof ProjectRole>;

export const VersionStatus = z.enum(['DRAFT', 'SAVED', 'SUBMITTED', 'APPROVED', 'SUPERSEDED']);
export type VersionStatus = z.infer<typeof VersionStatus>;
export const ProfileScope = z.enum(['GLOBAL', 'PROJECT']);
export const ProfileStatus = z.enum(['DRAFT', 'PUBLISHED', 'RETIRED']);

// ---------- paging ----------
export const PageQuery = z.object({
  cursor: Id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type PageQuery = z.infer<typeof PageQuery>;
export const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: Id.nullable() });

// ---------- users ----------
export const UserRef = z.object({ id: Id, displayName: z.string(), email: z.email() });
export type UserRef = z.infer<typeof UserRef>;

export const Me = UserRef.extend({
  globalRole: GlobalRole,
  locale: z.enum(['en', 'vi']),
  memberships: z.array(
    z.object({ projectId: Id, projectKey: z.string(), projectName: z.string(), role: ProjectRole }),
  ),
}).meta({ id: 'Me' });
export type Me = z.infer<typeof Me>;

/** The user's own preferences (design 8.5: the language is saved to the profile). */
export const MeUpdate = z
  .object({ locale: z.enum(['en', 'vi']) })
  .meta({ id: 'MeUpdate', example: { locale: 'vi' } });

// ---------- projects ----------
export const ProjectKey = z
  .string()
  .regex(/^[A-Z][A-Z0-9]{1,15}$/, 'Upper-case letters and digits, 2–16 characters');

export const Project = z
  .object({
    id: Id,
    key: ProjectKey,
    name: z.string(),
    description: z.string().nullable(),
    archived: z.boolean(),
    createdAt: IsoDateTime,
    /** The caller's role; null for an Admin who is not a member. */
    myRole: ProjectRole.nullable(),
  })
  .meta({ id: 'Project' });
export type Project = z.infer<typeof Project>;

export const ProjectMember = z.object({ user: UserRef, role: ProjectRole, addedAt: IsoDateTime });
export const ProjectDetail = Project.extend({ members: z.array(ProjectMember) }).meta({
  id: 'ProjectDetail',
});
export type ProjectDetail = z.infer<typeof ProjectDetail>;

export const ProjectCreate = z
  .object({
    key: ProjectKey,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
  })
  .meta({
    id: 'ProjectCreate',
    example: { key: 'LEND', name: 'Synthetic · Retail lending', description: 'Example project' },
  });

export const ProjectUpdate = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' })
  .meta({ id: 'ProjectUpdate' });

export const MembersPut = z
  .object({
    members: z
      .array(z.object({ email: z.email(), role: ProjectRole }))
      .min(1)
      .max(200),
  })
  .refine((v) => new Set(v.members.map((m) => m.email.toLowerCase())).size === v.members.length, {
    message: 'Each person can appear only once',
    path: ['members'],
  })
  .refine((v) => v.members.some((m) => m.role === 'QE_LEAD'), {
    message: 'A project needs at least one QE Lead',
    path: ['members'],
  })
  .meta({
    id: 'MembersPut',
    example: { members: [{ email: 'lead@example.invalid', role: 'QE_LEAD' }] },
  });

// ---------- estimates and versions ----------
export const VersionSummary = z
  .object({
    id: Id,
    number: z.number().int().min(1),
    status: VersionStatus,
    engineVersion: z.string(),
    roughFte: z.number(),
    detailedFte: z.number(),
    totalCasesDetailed: z.number().int(),
    uncalibrated: z.number().int(),
    note: z.string().nullable(),
    createdBy: UserRef,
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .meta({ id: 'VersionSummary' });
export type VersionSummary = z.infer<typeof VersionSummary>;

export const EditLock = z
  .object({ holder: UserRef, expiresAt: IsoDateTime, mine: z.boolean() })
  .meta({ id: 'EditLock' });
export type EditLock = z.infer<typeof EditLock>;

export const Version = VersionSummary.extend({
  inputs: EstimateInputs,
  assumptions: Assumptions,
  result: EstimateResult,
  profileId: Id.nullable(),
  schemaVersion: z.number().int(),
  rowVersion: z.number().int(),
  lock: EditLock.nullable(),
}).meta({ id: 'Version' });
export type Version = z.infer<typeof Version>;

export const Estimate = z
  .object({
    id: Id,
    projectId: Id,
    name: z.string(),
    description: z.string().nullable(),
    archived: z.boolean(),
    createdBy: UserRef,
    createdAt: IsoDateTime,
    latest: VersionSummary.nullable(),
    hasDraft: z.boolean(),
  })
  .meta({ id: 'Estimate' });
export type Estimate = z.infer<typeof Estimate>;

export const EstimateDetail = Estimate.extend({
  versions: z.array(VersionSummary),
  draftLock: EditLock.nullable(),
}).meta({ id: 'EstimateDetail' });
export type EstimateDetail = z.infer<typeof EstimateDetail>;

export const EstimateCreate = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional(),
    /** Start from the example scope or an empty one. */
    template: z.enum(['example', 'blank']).default('example'),
    /** Assumption profile to copy; defaults to the published global default. */
    profileId: Id.optional(),
  })
  .meta({
    id: 'EstimateCreate',
    example: { name: 'Synthetic · Mobile onboarding R3', template: 'example' },
  });

export const DraftCreate = z
  .object({
    /** Version to copy into the new draft; defaults to the latest version. */
    fromVersion: z.number().int().min(1).optional(),
  })
  .meta({ id: 'DraftCreate' });

export const DraftPatch = z
  .object({
    /** Optimistic lock: the rowVersion the client last saw. */
    rowVersion: z.number().int().min(1),
    inputs: EstimateInputs.optional(),
    assumptions: Assumptions.optional(),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.inputs !== undefined || v.assumptions !== undefined || v.note !== undefined, {
    message: 'Nothing to update',
  })
  .meta({ id: 'DraftPatch' });

export const LockRequest = z
  .object({
    /** QE Lead only: take the lock from someone else before it expires. */
    takeover: z.boolean().default(false),
  })
  .meta({ id: 'LockRequest' });

export const VersionSave = z
  .object({ note: z.string().trim().max(2000).optional() })
  .meta({ id: 'VersionSave' });

// ---------- assumption profiles ----------
export const Profile = z
  .object({
    id: Id,
    scope: ProfileScope,
    projectId: Id.nullable(),
    name: z.string(),
    status: ProfileStatus,
    uncalibrated: z.number().int(),
    createdAt: IsoDateTime,
    publishedAt: IsoDateTime.nullable(),
  })
  .meta({ id: 'Profile' });
export type Profile = z.infer<typeof Profile>;

export const CalibrationEntry = z.object({
  source: z.string().max(200),
  measuredAt: z.iso.date().optional(),
  note: z.string().max(1000).optional(),
});
export const ProfileDetail = Profile.extend({
  values: Assumptions,
  calibration: z.record(z.string(), CalibrationEntry),
}).meta({ id: 'ProfileDetail' });
export type ProfileDetail = z.infer<typeof ProfileDetail>;

export const ProfileListQuery = z.object({ projectId: Id.optional() });

// ---------- misc ----------
export const Health = z
  .object({ status: z.literal('ok'), version: z.string(), uptimeSeconds: z.number() })
  .meta({ id: 'Health' });
export const Ready = z
  .object({
    status: z.literal('ready'),
    checks: z.record(
      z.string(),
      z.object({ ok: z.boolean(), latencyMs: z.number(), reason: z.string().optional() }),
    ),
  })
  .meta({ id: 'Ready' });
