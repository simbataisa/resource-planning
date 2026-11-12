import type { Prisma } from '@sit/db';
import type {
  MembersPut,
  PageQuery,
  ProjectCreate,
  ProjectDetail,
  ProjectUpdate,
} from '@sit/schemas';
import type { z } from 'zod';
import type { CurrentUser } from '../auth/current-user';
import { db } from '../db';
import { projectDto, userRef } from '../dto';
import { HttpError } from '../http/route';
import { recordAudit } from '../repositories/audit';
import { USER_REF } from '../repositories/includes';
import { pageArgs, toPage } from '../repositories/pagination';
import { ensure, projectFor, type RequestMeta } from './access';

/** Projects the caller can see: all for Admin, otherwise memberships. */
export async function listProjects(user: CurrentUser, q: PageQuery) {
  ensure(user, 'project.list');
  const where: Prisma.ProjectWhereInput =
    user.globalRole === 'ADMIN' ? {} : { members: { some: { userId: user.id } } };
  const rows = await db().project.findMany({ where, ...pageArgs(q) });
  return toPage(rows, q, (p) => projectDto(p, user.memberships[p.id] ?? null));
}

export async function getProject(user: CurrentUser, projectId: string): Promise<ProjectDetail> {
  await projectFor(db(), user, projectId, 'project.read');
  const p = await db().project.findUniqueOrThrow({
    where: { id: projectId },
    include: { members: { include: { user: USER_REF }, orderBy: { addedAt: 'asc' } } },
  });
  return {
    ...projectDto(p, user.memberships[p.id] ?? null),
    members: p.members.map((m) => ({
      user: userRef(m.user),
      role: m.role,
      addedAt: m.addedAt.toISOString(),
    })),
  };
}

export async function createProject(
  user: CurrentUser,
  input: z.output<typeof ProjectCreate>,
  meta: RequestMeta,
) {
  ensure(user, 'project.create');
  return db().$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        createdById: user.id,
        members: { create: { userId: user.id, role: 'QE_LEAD', addedById: user.id } },
      },
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'project.create',
      entity: 'Project',
      entityId: p.id,
      projectId: p.id,
      detail: { key: p.key },
      requestId: meta.requestId,
    });
    return projectDto(p, 'QE_LEAD');
  });
}

export async function updateProject(
  user: CurrentUser,
  projectId: string,
  input: z.output<typeof ProjectUpdate>,
  meta: RequestMeta,
) {
  return db().$transaction(async (tx) => {
    await projectFor(tx, user, projectId, 'project.update');
    const p = await tx.project.update({ where: { id: projectId }, data: input });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'project.update',
      entity: 'Project',
      entityId: p.id,
      projectId: p.id,
      detail: { fields: Object.keys(input) },
      requestId: meta.requestId,
    });
    return projectDto(p, user.memberships[p.id] ?? null);
  });
}

/** Replaces the member list. Every e-mail must belong to a user who has signed in at least once. */
export async function putMembers(
  user: CurrentUser,
  projectId: string,
  input: z.output<typeof MembersPut>,
  meta: RequestMeta,
) {
  return db()
    .$transaction(async (tx) => {
      await projectFor(tx, user, projectId, 'project.members.manage');
      const emails = input.members.map((m) => m.email.toLowerCase());
      const users = await tx.user.findMany({
        where: { email: { in: emails, mode: 'insensitive' }, active: true },
      });
      const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
      const unknown = emails.filter((e) => !byEmail.has(e));
      if (unknown.length) {
        throw new HttpError(
          422,
          'VALIDATION_FAILED',
          'Some people have not signed in yet.',
          unknown.map((email) => ({ path: ['members'], email })),
        );
      }
      await tx.projectMember.deleteMany({ where: { projectId } });
      await tx.projectMember.createMany({
        data: input.members.map((m) => ({
          projectId,
          userId: byEmail.get(m.email.toLowerCase())!.id,
          role: m.role,
          addedById: user.id,
        })),
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: 'project.members.replace',
        entity: 'Project',
        entityId: projectId,
        projectId,
        detail: {
          members: input.members.map((m) => ({
            userId: byEmail.get(m.email.toLowerCase())!.id,
            role: m.role,
          })),
        },
        requestId: meta.requestId,
      });
    })
    .then(() => getProjectAfterChange(user, projectId));
}

/** Re-read after a member change; the caller may no longer be a member (Admin still sees it). */
async function getProjectAfterChange(user: CurrentUser, projectId: string): Promise<ProjectDetail> {
  const p = await db().project.findUniqueOrThrow({
    where: { id: projectId },
    include: { members: { include: { user: USER_REF }, orderBy: { addedAt: 'asc' } } },
  });
  const mine = p.members.find((m) => m.userId === user.id)?.role ?? null;
  return {
    ...projectDto(p, mine),
    members: p.members.map((m) => ({
      user: userRef(m.user),
      role: m.role,
      addedAt: m.addedAt.toISOString(),
    })),
  };
}
