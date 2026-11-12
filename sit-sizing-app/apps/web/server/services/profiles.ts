import type { Prisma } from '@sit/db';
import type { ProfileListQuery } from '@sit/schemas';
import type { z } from 'zod';
import { can } from '@/lib/rbac';
import type { CurrentUser } from '../auth/current-user';
import { db } from '../db';
import { profileDetailDto, profileDto } from '../dto';
import { ensure, notFound } from './access';

/**
 * Global profiles (published, plus drafts for Admin) and, when a project is given,
 * that project's profiles. Creating and publishing profiles is release 2 (P-01).
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
  if (!p) throw notFound();
  if (p.scope === 'GLOBAL') {
    if (p.status !== 'PUBLISHED' && user.globalRole !== 'ADMIN') throw notFound();
  } else if (!p.projectId || !can(user, 'profile.project.read', p.projectId)) {
    throw notFound();
  }
  return profileDetailDto(p);
}
