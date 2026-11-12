import type { Me, MeUpdate } from '@sit/schemas';
import type { z } from 'zod';
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

/** Saves the user's language (design 8.5) and returns the updated profile. */
export async function updateMe(user: CurrentUser, input: z.output<typeof MeUpdate>): Promise<Me> {
  await db().user.update({ where: { id: user.id }, data: { locale: input.locale } });
  return getMe({ ...user, locale: input.locale });
}
