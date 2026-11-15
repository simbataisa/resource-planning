import { TourState, type Me, type MeUpdate } from '@sit/schemas';
import type { z } from 'zod';
import type { CurrentUser } from '../auth/current-user';
import { clock } from '../clock';
import { db } from '../db';
import { mergeTours } from '../domain/tours';

function parseTours(raw: unknown): TourState {
  const parsed = TourState.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export async function getMe(user: CurrentUser): Promise<Me> {
  const [memberships, row] = await Promise.all([
    db().projectMember.findMany({
      where: { userId: user.id },
      include: { project: { select: { id: true, key: true, name: true } } },
      orderBy: { project: { key: 'asc' } },
    }),
    db().user.findUniqueOrThrow({
      where: { id: user.id },
      select: { tours: true, createdAt: true, lastLoginAt: true },
    }),
  ]);
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    globalRole: user.globalRole,
    locale: user.locale,
    tours: parseTours(row.tours),
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    memberships: memberships.map((m) => ({
      projectId: m.project.id,
      projectKey: m.project.key,
      projectName: m.project.name,
      role: m.role,
    })),
  };
}

/** Saves the user's language (design 8.5) and guided-tour state, and returns the updated profile. */
export async function updateMe(user: CurrentUser, input: z.output<typeof MeUpdate>): Promise<Me> {
  await db().$transaction(async (tx) => {
    const data: { locale?: string; tours?: object } = {};
    if (input.locale) data.locale = input.locale;
    if (input.tours && Object.keys(input.tours).length > 0) {
      const row = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { tours: true },
      });
      data.tours = mergeTours(parseTours(row.tours), input.tours, clock.now());
    }
    if (Object.keys(data).length > 0) await tx.user.update({ where: { id: user.id }, data });
  });
  return getMe({ ...user, locale: input.locale ?? user.locale });
}
