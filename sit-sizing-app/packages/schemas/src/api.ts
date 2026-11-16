import { z } from 'zod';
import { Assumptions, CalibrationEntry } from './assumptions';

export { CalibrationEntry };
import { EstimateInputs } from './inputs';
import { EstimateResult, GroupKey } from './result';

/**
 * REST API request and response shapes (design 9). These schemas are the API
 * contract: route handlers parse with them, the Axios client parses responses
 * with them, and the OpenAPI document is generated from them (design 9.4).
 * Examples use synthetic data only.
 */

export { INPUTS_SCHEMA_VERSION } from './upgrade';

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

/** Guided-tour id: lower-case slug plus a 1-3 digit version, e.g. `first-estimate@1`; at most 64 characters. */
export const TourKey = z
  .string()
  .max(64)
  .regex(/^[a-z0-9-]+@\d{1,3}$/, 'Lower-case slug, "@", then a 1-3 digit version')
  .meta({ id: 'TourKey', example: 'first-estimate@1' });
export type TourKey = z.infer<typeof TourKey>;

export const TOUR_STATUSES = ['completed', 'skipped', 'dismissed'] as const;
export const TourStatus = z.enum(TOUR_STATUSES).meta({ id: 'TourStatus' });
export type TourStatus = z.infer<typeof TourStatus>;

/** Stored tour state: how the user last closed each tour, and when. */
export const TourState = z.record(TourKey, z.object({ status: TourStatus, at: IsoDateTime })).meta({
  id: 'TourState',
  example: { 'first-estimate@1': { status: 'completed', at: '2026-01-01T00:00:00.000Z' } },
});
export type TourState = z.infer<typeof TourState>;

/** Most keys one tour update may carry (the server keeps at most this many). */
export const MAX_TOUR_KEYS = 100;

/** A null value removes the key; the server stamps `at`. At most 100 keys per update. */
export const TourUpdate = z
  .record(TourKey, z.object({ status: TourStatus }).nullable())
  .refine((o) => Object.keys(o).length <= MAX_TOUR_KEYS, {
    message: `At most ${MAX_TOUR_KEYS} tour keys`,
  })
  .meta({
    id: 'TourUpdate',
    maxProperties: MAX_TOUR_KEYS,
    example: { 'first-estimate@1': { status: 'completed' } },
  });
export type TourUpdate = z.infer<typeof TourUpdate>;

export const Me = UserRef.extend({
  globalRole: GlobalRole,
  locale: z.enum(['en', 'vi']),
  memberships: z.array(
    z.object({ projectId: Id, projectKey: z.string(), projectName: z.string(), role: ProjectRole }),
  ),
  tours: TourState,
  createdAt: IsoDateTime,
  lastLoginAt: IsoDateTime.nullable(),
}).meta({ id: 'Me' });
export type Me = z.infer<typeof Me>;

/** The user's own preferences (design 8.5: the language is saved to the profile). */
export const MeUpdate = z
  .object({ locale: z.enum(['en', 'vi']).optional(), tours: TourUpdate.optional() })
  .refine((v) => v.locale !== undefined || v.tours !== undefined, {
    message: 'Provide locale or tours',
  })
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
    /** Approval workflow (release 2). */
    submittedBy: UserRef.nullable(),
    submittedAt: IsoDateTime.nullable(),
    approvedBy: UserRef.nullable(),
    approvedAt: IsoDateTime.nullable(),
  })
  .meta({ id: 'VersionSummary' });
export type VersionSummary = z.infer<typeof VersionSummary>;

export const EditLock = z
  .object({ holder: UserRef, expiresAt: IsoDateTime, mine: z.boolean() })
  .meta({ id: 'EditLock' });
export type EditLock = z.infer<typeof EditLock>;

export const ReviewKind = z.enum(['COMMENT', 'RETURN', 'APPROVE']);
export const ReviewEntry = z
  .object({ id: Id, kind: ReviewKind, body: z.string(), author: UserRef, createdAt: IsoDateTime })
  .meta({ id: 'ReviewEntry' });
export type ReviewEntry = z.infer<typeof ReviewEntry>;

/**
 * Draft lock token: returned once, only to the call that took (or took over) the lock.
 * Send it back as the X-Lock-Token header to renew, autosave, apply a profile, save or release.
 */
export const LockToken = z.string().min(1).max(200).meta({
  id: 'LockToken',
  description:
    'Proof that a request comes from the tab or assistant session that took the edit lock. Returned only by the call that took the lock; send it as X-Lock-Token.',
  example: 'c3ludGhldGljLWxvY2stdG9rZW4tZXhhbXBsZS0wMDAwMDAw',
});

export const Version = VersionSummary.extend({
  inputs: EstimateInputs,
  assumptions: Assumptions,
  result: EstimateResult,
  profileId: Id.nullable(),
  schemaVersion: z.number().int(),
  rowVersion: z.number().int(),
  lock: EditLock.nullable(),
  /** Only in the response to the call that took the lock (lock, create draft). */
  lockToken: LockToken.optional(),
  /** Review notes on submit, approve and return, oldest first. */
  reviews: z.array(ReviewEntry),
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

/** Response to creating an estimate: draft 1 is locked to the caller, with its token. */
export const EstimateCreated = Estimate.extend({ lockToken: LockToken }).meta({
  id: 'EstimateCreated',
});
export type EstimateCreated = z.infer<typeof EstimateCreated>;

export const EstimateDetail = Estimate.extend({
  versions: z.array(VersionSummary),
  draftLock: EditLock.nullable(),
}).meta({ id: 'EstimateDetail' });
export type EstimateDetail = z.infer<typeof EstimateDetail>;

/** One line the caller confirmed before a change was made; stored in the audit trail. */
export const ChangeSummary = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .meta({ id: 'ChangeSummary', example: 'Synthetic: set team weeks to 12' });

export const EstimateCreate = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional(),
    /** Start from the example scope or an empty one. */
    template: z.enum(['example', 'blank']).default('example'),
    /** Assumption profile to copy; defaults to the published global default. */
    profileId: Id.optional(),
    summary: ChangeSummary.optional(),
  })
  .meta({
    id: 'EstimateCreate',
    example: { name: 'Synthetic · Mobile onboarding R3', template: 'example' },
  });

export const DraftCreate = z
  .object({
    /** Version to copy into the new draft; defaults to the latest version. */
    fromVersion: z.number().int().min(1).optional(),
    summary: ChangeSummary.optional(),
  })
  .meta({ id: 'DraftCreate' });

export const DraftPatch = z
  .object({
    /** Optimistic lock: the rowVersion the client last saw. */
    rowVersion: z.number().int().min(1),
    inputs: EstimateInputs.optional(),
    assumptions: Assumptions.optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    /** Audited when present; autosaves without it are not. Does not count as a change. */
    summary: ChangeSummary.optional(),
  })
  .refine((v) => v.inputs !== undefined || v.assumptions !== undefined || v.note !== undefined, {
    message: 'Nothing to update',
  })
  .meta({ id: 'DraftPatch' });

export const LockRequest = z
  .object({
    /**
     * Take the lock before it expires: from someone else (QE Lead only), or from another tab
     * or assistant session of mine (any role; that session loses it).
     */
    takeover: z.boolean().default(false),
  })
  .meta({ id: 'LockRequest' });

/** Optional note when submitting or approving (release 2, V-01). */
export const ReviewNote = z
  .object({ note: z.string().trim().max(2000).optional(), summary: ChangeSummary.optional() })
  .meta({ id: 'ReviewNote', example: { note: 'Synthetic: scope agreed with the delivery lead' } });

/** Returning a version for changes always says why. */
export const ReturnRequest = z.object({ note: z.string().trim().min(1).max(2000) }).meta({
  id: 'ReturnRequest',
  example: { note: 'Synthetic: add the batch interfaces from FSD v2' },
});

const ModeFigures = z.object({ fte: z.number(), cases: z.number(), hours: z.number() });
/** Two versions side by side (release 2, V-01): headline results, groups and changed values. */
export const VersionCompare = z
  .object({
    a: VersionSummary,
    b: VersionSummary,
    results: z.object({
      rough: z.object({ a: ModeFigures, b: ModeFigures }),
      detailed: z.object({ a: ModeFigures, b: ModeFigures }),
    }),
    groups: z.array(
      z.object({
        group: z.string(),
        aCases: z.number(),
        bCases: z.number(),
        aHours: z.number(),
        bHours: z.number(),
      }),
    ),
    changes: z.array(
      z.object({
        area: z.enum(['inputs', 'assumptions']),
        path: z.string(),
        a: z.unknown(),
        b: z.unknown(),
      }),
    ),
    /** True when more changes exist than are listed. */
    truncated: z.boolean(),
  })
  .meta({ id: 'VersionCompare' });
export type VersionCompare = z.infer<typeof VersionCompare>;
export const CompareQuery = z.object({
  a: z.coerce.number().int().min(1),
  b: z.coerce.number().int().min(1),
});

export const VersionSave = z
  .object({ note: z.string().trim().max(2000).optional(), summary: ChangeSummary.optional() })
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
    /** The profile this one was cloned from. */
    basedOnId: Id.nullable(),
    createdAt: IsoDateTime,
    publishedAt: IsoDateTime.nullable(),
  })
  .meta({ id: 'Profile' });
export type Profile = z.infer<typeof Profile>;

export const ProfileDetail = Profile.extend({
  values: Assumptions,
  calibration: z.record(z.string(), CalibrationEntry),
}).meta({ id: 'ProfileDetail' });
export type ProfileDetail = z.infer<typeof ProfileDetail>;

export const ProfileListQuery = z.object({ projectId: Id.optional() });

/** Calibration notes per assumption path (P-01). Keys are checked against the engine's 160 rows. */
export const CalibrationMap = z.record(z.string().max(80), CalibrationEntry);

export const ProfileCreate = z
  .object({
    name: z.string().trim().min(1).max(120),
    scope: ProfileScope,
    /** Required for a project profile; not allowed for a global one. */
    projectId: Id.optional(),
    /** Copy values and calibration notes from this profile; defaults to the engine defaults. */
    basedOnId: Id.optional(),
  })
  .refine((v) => (v.scope === 'PROJECT') === Boolean(v.projectId), {
    path: ['projectId'],
    message: 'A project profile needs projectId; a global profile must not have one.',
  })
  .meta({
    id: 'ProfileCreate',
    example: {
      name: 'Synthetic · Retail lending 2026',
      scope: 'PROJECT',
      projectId: 'cm0project0000000000000',
    },
  });

/** Changes to a DRAFT profile. Published and retired profiles are read-only. */
export const ProfileUpdate = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    values: Assumptions.optional(),
    calibration: CalibrationMap.optional(),
  })
  .meta({ id: 'ProfileUpdate' });

/** Replaces the open draft's assumptions with a published profile's values. */
export const ProfileApply = z
  .object({
    profileId: Id,
    /** Optimistic lock: the draft's rowVersion the client last saw. */
    rowVersion: z.number().int().min(1),
    summary: ChangeSummary.optional(),
  })
  .meta({ id: 'ProfileApply' });

// ---------- export (release 2, X-02) ----------
export const ExportTable = z.enum(['summary', 'drivers', 'gap', 'assumptions', 'inputs']);
export const ExportQuery = z
  .object({
    format: z.enum(['xlsx', 'csv']).default('xlsx'),
    /** CSV holds one table; the workbook has all of them. */
    table: ExportTable.default('gap'),
    /** Language of labels and headers; defaults to the user's language. */
    lang: z.enum(['en', 'vi']).optional(),
  })
  .meta({ id: 'ExportQuery' });

// ---------- notifications (release 2, N-01) ----------
export const NotificationKind = z.enum(['SUBMITTED', 'APPROVED', 'RETURNED', 'PROFILE_PUBLISHED']);
/** What a notice is about; names are copied at the time of the event. */
export const NotificationPayload = z
  .object({
    actorName: z.string(),
    projectName: z.string().nullable(),
    estimateId: Id.optional(),
    estimateName: z.string().optional(),
    versionNumber: z.number().int().optional(),
    profileId: Id.optional(),
    profileName: z.string().optional(),
    note: z.string().max(2000).optional(),
  })
  .meta({ id: 'NotificationPayload' });
export type NotificationPayload = z.infer<typeof NotificationPayload>;

export const NotificationItem = z
  .object({
    id: Id,
    kind: NotificationKind,
    payload: NotificationPayload,
    createdAt: IsoDateTime,
    readAt: IsoDateTime.nullable(),
  })
  .meta({ id: 'NotificationItem' });
export type NotificationItem = z.infer<typeof NotificationItem>;

export const NotificationList = z
  .object({ items: z.array(NotificationItem), unread: z.number().int() })
  .meta({ id: 'NotificationList' });

// ---------- actuals (release 3, P-02) ----------
const count = z.number().int().min(0).max(1_000_000);
const hours = z.number().min(0).max(1_000_000);

/** What one SIT cycle measured (design 7: cases, hours, minutes per case, retest rate, productive hours). */
export const ActualsData = z
  .object({
    /** Distinct test cases executed in the cycle (first pass). */
    executedCases: count,
    /** All SIT effort in the cycle, in hours: design, execution, retest, coordination. */
    totalHours: hours,
    /** Execution time only, including data set-up. Gives minutes per case. */
    executionHours: hours.optional(),
    /** Cases designed in the cycle, with the hours spent designing them. */
    designedCases: count.optional(),
    designHours: hours.optional(),
    /** Cases run again to confirm defect fixes. Gives the retest rate. */
    retestedCases: count.optional(),
    /** Measured productive hours per person per day. */
    productiveHoursPerDay: z.number().min(0.5).max(24).optional(),
    /** Optional split by group, for the groups the team tracked. */
    groups: z
      .array(z.object({ group: GroupKey, cases: count, hours }))
      .max(60)
      .refine((g) => new Set(g.map((x) => x.group)).size === g.length, {
        message: 'Each group can appear only once.',
      })
      .default([]),
  })
  .refine((d) => (d.designHours === undefined) === (d.designedCases === undefined), {
    path: ['designHours'],
    message: 'Give design hours and designed cases together.',
  })
  .meta({ id: 'ActualsData' });
export type ActualsData = z.infer<typeof ActualsData>;

export const ActualsCreate = z
  .object({
    cycleLabel: z.string().trim().min(1).max(80),
    data: ActualsData,
    note: z.string().trim().max(2000).optional(),
  })
  .meta({
    id: 'ActualsCreate',
    example: {
      cycleLabel: 'SIT cycle 1 · synthetic',
      data: { executedCases: 3900, totalHours: 3800, executionHours: 1400, retestedCases: 700 },
    },
  });

/** One compared figure. `pct` is null when the estimate is zero. */
export const VarianceRow = z.object({
  key: z.string(),
  estimate: z.number().nullable(),
  actual: z.number().nullable(),
  delta: z.number().nullable(),
  pct: z.number().nullable(),
});
/** A measured rate next to the assumption it informs (a person decides whether to change it). */
export const RateRow = z.object({
  key: z.enum(['minutesPerCase', 'designMinutesPerCase', 'retestRate', 'productiveHoursPerDay']),
  /** The assumption's dotted path, as in profiles. */
  path: z.string(),
  /** The version's value; cases-by-complexity triples are shown as they are. */
  assumption: z.union([z.number(), z.array(z.number())]),
  actual: z.number().nullable(),
});
export const Variance = z
  .object({
    totals: z.array(VarianceRow),
    groups: z.array(VarianceRow),
    rates: z.array(RateRow),
  })
  .meta({ id: 'Variance' });
export type Variance = z.infer<typeof Variance>;

export const Actuals = z
  .object({
    id: Id,
    versionNumber: z.number().int(),
    cycleLabel: z.string(),
    data: ActualsData,
    note: z.string().nullable(),
    recordedBy: UserRef,
    recordedAt: IsoDateTime,
    variance: Variance,
  })
  .meta({ id: 'Actuals' });
export type Actuals = z.infer<typeof Actuals>;

export const ActualsList = z.object({ items: z.array(Actuals) }).meta({ id: 'ActualsList' });

// ---------- portfolio (release 3, R-01) ----------
export const PortfolioQuery = z
  .object({
    /** Comma-separated project ids; default: every project the caller leads (Admin: all). */
    projectIds: z
      .string()
      .optional()
      .transform((s) => (s ? [...new Set(s.split(',').filter(Boolean))] : undefined))
      .pipe(z.array(Id).max(100).optional()),
    /** approved: the approved version of each estimate (QBR). latest: the newest saved version. */
    status: z.enum(['approved', 'latest']).default('approved'),
  })
  .meta({ id: 'PortfolioQuery' });

export const PortfolioRow = z.object({
  projectId: Id,
  projectKey: z.string(),
  projectName: z.string(),
  estimateId: Id,
  estimateName: z.string(),
  versionNumber: z.number().int(),
  status: VersionStatus,
  approvedAt: IsoDateTime.nullable(),
  profileName: z.string().nullable(),
  engineVersion: z.string(),
  /** Detailed mode, from the version's stored result. */
  fte: z.number(),
  lo: z.number(),
  hi: z.number(),
  cases: z.number().int(),
  hours: z.number(),
  roughFte: z.number(),
  uncalibrated: z.number().int(),
});
export type PortfolioRow = z.infer<typeof PortfolioRow>;

export const PortfolioTotals = z.object({
  estimates: z.number().int(),
  fte: z.number(),
  lo: z.number(),
  hi: z.number(),
  cases: z.number().int(),
  hours: z.number(),
  roughFte: z.number(),
  /** Estimates whose assumptions are all still defaults. */
  onDefaults: z.number().int(),
});
export type PortfolioTotals = z.infer<typeof PortfolioTotals>;

export const Portfolio = z
  .object({
    status: z.enum(['approved', 'latest']),
    projects: z.array(
      z.object({
        projectId: Id,
        projectKey: z.string(),
        projectName: z.string(),
        rows: z.array(PortfolioRow),
        subtotal: PortfolioTotals,
      }),
    ),
    total: PortfolioTotals,
    /** Assumption rows per estimate, for the calibration share. */
    assumptionRows: z.number().int(),
  })
  .meta({ id: 'Portfolio' });
export type Portfolio = z.infer<typeof Portfolio>;

// ---------- admin and audit (release 3, H-01) ----------
export const AuditQuery = PageQuery.extend({
  /** Required for QE Leads (a project they lead); Admins may leave it out for all projects. */
  projectId: Id.optional(),
  entity: z.string().max(40).optional(),
  /** Exact action, or a prefix ending in a dot, e.g. "estimate.version." */
  action: z.string().max(80).optional(),
  actorId: Id.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
}).meta({ id: 'AuditQuery' });

export const AuditEventItem = z
  .object({
    id: Id,
    at: IsoDateTime,
    actor: UserRef,
    action: z.string(),
    entity: z.string(),
    entityId: z.string(),
    project: z.object({ id: Id, key: z.string(), name: z.string() }).nullable(),
    detail: z.record(z.string(), z.unknown()),
    requestId: z.string().nullable(),
  })
  .meta({ id: 'AuditEvent' });
export type AuditEventItem = z.infer<typeof AuditEventItem>;
export const AuditPage = page(AuditEventItem).meta({ id: 'AuditPage' });

export const UserListQuery = PageQuery.extend({
  /** Name or e-mail contains. */
  q: z.string().trim().max(120).optional(),
}).meta({ id: 'UserListQuery' });

export const AdminUser = UserRef.extend({
  /** From the Keycloak group sit-sizing-admins at each sign-in; read-only here. */
  globalRole: GlobalRole,
  active: z.boolean(),
  createdAt: IsoDateTime,
  lastLoginAt: IsoDateTime.nullable(),
  memberships: z.array(z.object({ projectId: Id, projectKey: z.string(), role: ProjectRole })),
}).meta({ id: 'AdminUser' });
export type AdminUser = z.infer<typeof AdminUser>;
export const UserPage = page(AdminUser).meta({ id: 'UserPage' });

/** Only activation is managed in the app; identity and the Admin role live in Keycloak. */
export const UserUpdate = z.object({ active: z.boolean() }).meta({ id: 'UserUpdate' });

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
