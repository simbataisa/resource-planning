/** Shared Prisma selections so every query returns what the DTO mappers need. */
export const USER_REF = { select: { id: true, displayName: true, email: true } } as const;

export const VERSION_SUMMARY_INCLUDE = {
  createdBy: USER_REF,
  submittedBy: USER_REF,
  approvedBy: USER_REF,
} as const;
export const VERSION_FULL_INCLUDE = {
  ...VERSION_SUMMARY_INCLUDE,
  lockedBy: USER_REF,
  comments: { orderBy: { createdAt: 'asc' }, include: { author: USER_REF } },
} as const;

export const ESTIMATE_LIST_INCLUDE = {
  createdBy: USER_REF,
  versions: { orderBy: { number: 'desc' }, take: 1, include: VERSION_SUMMARY_INCLUDE },
  _count: { select: { versions: { where: { status: 'DRAFT' } } } },
} as const;

export const ESTIMATE_DETAIL_INCLUDE = {
  createdBy: USER_REF,
  versions: { orderBy: { number: 'desc' }, include: VERSION_FULL_INCLUDE },
} as const;
