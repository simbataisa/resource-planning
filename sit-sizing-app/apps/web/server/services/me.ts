import type { Me } from '@sit/schemas';
import type { CurrentUser } from '../auth/current-user';
import { db } from '../db';

export async function getMe(user: CurrentUser): Promise<Me> {
  const memberships = await db().projectMember.findMany({
    where: { userId: user.id },
    include: { project: { select: { id: true, key: true, name: true } } },
    orderBy: { project: { key: 'asc' } },
  });
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    globalRole: user.globalRole,
    locale: user.locale,
    memberships: memberships.map((m) => ({
      projectId: m.project.id,
      projectKey: m.project.key,
      projectName: m.project.name,
      role: m.role,
    })),
  };
}
