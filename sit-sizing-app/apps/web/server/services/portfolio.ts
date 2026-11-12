import { ASSUMPTION_PATHS } from '@sit/engine';
import { EstimateResult, type PortfolioQuery, type PortfolioRow } from '@sit/schemas';
import type { z } from 'zod';
import { can } from '@/lib/rbac';
import type { CurrentUser } from '../auth/current-user';
import { db } from '../db';
import { rollUp } from '../domain/portfolio';
import { HttpError } from '../http/route';
import { notFound } from './access';

/**
 * The portfolio for the QBR (design 7, 9.2; release 3 R-01): one row per estimate, from its
 * approved version (or its newest saved version with status=latest), grouped by project.
 * QE Leads see the projects they lead; Admins see every project. Archived ones are left out.
 */
export async function portfolio(user: CurrentUser, q: z.output<typeof PortfolioQuery>) {
  const isAdmin = user.globalRole === 'ADMIN';
  const led = Object.keys(user.memberships).filter((id) => can(user, 'portfolio.read', id));
  if (!isAdmin && led.length === 0)
    throw new HttpError(403, 'FORBIDDEN', 'The portfolio is for QE Leads and Admins.');
  if (q.projectIds && !isAdmin && q.projectIds.some((id) => !led.includes(id))) throw notFound();
  if (q.projectIds && isAdmin) {
    const known = await db().project.count({ where: { id: { in: q.projectIds } } });
    if (known < q.projectIds.length) throw notFound();
  }

  const estimates = await db().estimate.findMany({
    where: {
      archived: false,
      project: { archived: false },
      projectId: { in: q.projectIds ?? (isAdmin ? undefined : led) },
    },
    select: {
      id: true,
      name: true,
      project: { select: { id: true, key: true, name: true } },
      versions: {
        where: q.status === 'approved' ? { status: 'APPROVED' } : { status: { not: 'DRAFT' } },
        orderBy: { number: 'desc' },
        take: 1,
        select: {
          number: true,
          status: true,
          approvedAt: true,
          engineVersion: true,
          result: true,
          uncalibrated: true,
          profile: { select: { name: true } },
        },
      },
    },
  });
  const rows: PortfolioRow[] = estimates.flatMap((e) => {
    const v = e.versions[0];
    if (!v) return [];
    const r = EstimateResult.parse(v.result);
    return [
      {
        projectId: e.project.id,
        projectKey: e.project.key,
        projectName: e.project.name,
        estimateId: e.id,
        estimateName: e.name,
        versionNumber: v.number,
        status: v.status,
        approvedAt: v.approvedAt ? v.approvedAt.toISOString() : null,
        profileName: v.profile?.name ?? null,
        engineVersion: v.engineVersion,
        fte: r.detailed.fte,
        lo: r.detailed.lo,
        hi: r.detailed.hi,
        cases: r.detailed.cases,
        hours: r.detailed.hours,
        roughFte: r.rough.fte,
        uncalibrated: v.uncalibrated,
      },
    ];
  });
  return rollUp(rows, q.status, ASSUMPTION_PATHS.length);
}
