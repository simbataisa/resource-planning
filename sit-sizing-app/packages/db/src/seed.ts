/**
 * Synthetic seed data for local development and tests (design 11: synthetic data only).
 * Idempotent: safe to run more than once. Never run against sit or prod.
 *
 * Users match the dev identities used until Keycloak arrives in step 1.3
 * (send `x-dev-user: <subject>` when AUTH_MODE=dev).
 */
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS, versionSnapshot } from '@sit/engine';
import { INPUTS_SCHEMA_VERSION } from '@sit/schemas';
import { createPrismaClient, type Prisma } from './index.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
if (['sit', 'prod'].includes(process.env.APP_ENV ?? ''))
  throw new Error('Refusing to seed a sit or prod database');

const db = createPrismaClient(url, { max: 2 });

const USERS = [
  {
    subject: 'dev-admin',
    email: 'admin@example.invalid',
    displayName: 'Synthetic Admin',
    globalRole: 'ADMIN' as const,
  },
  {
    subject: 'dev-lead',
    email: 'lead@example.invalid',
    displayName: 'Synthetic QE Lead',
    globalRole: 'USER' as const,
  },
  {
    subject: 'dev-estimator',
    email: 'estimator@example.invalid',
    displayName: 'Synthetic Estimator',
    globalRole: 'USER' as const,
  },
  {
    subject: 'dev-viewer',
    email: 'viewer@example.invalid',
    displayName: 'Synthetic Viewer',
    globalRole: 'USER' as const,
  },
  {
    subject: 'dev-outsider',
    email: 'outsider@example.invalid',
    displayName: 'Synthetic Outsider',
    globalRole: 'USER' as const,
  },
];

async function main() {
  const users = Object.fromEntries(
    await Promise.all(
      USERS.map(
        async (u) =>
          [
            u.subject,
            await db.user.upsert({ where: { subject: u.subject }, update: {}, create: u }),
          ] as const,
      ),
    ),
  );
  const admin = users['dev-admin']!;

  const profile =
    (await db.assumptionProfile.findFirst({
      where: { scope: 'GLOBAL', name: 'Default (uncalibrated)' },
    })) ??
    (await db.assumptionProfile.create({
      data: {
        scope: 'GLOBAL',
        name: 'Default (uncalibrated)',
        status: 'PUBLISHED',
        values: DEFAULT_ASSUMPTIONS as unknown as Prisma.InputJsonValue,
        createdById: admin.id,
        publishedAt: new Date(),
      },
    }));

  const projects = [
    {
      key: 'DEMO',
      name: 'Synthetic · Retail lending',
      members: { 'dev-lead': 'QE_LEAD', 'dev-estimator': 'ESTIMATOR', 'dev-viewer': 'VIEWER' },
    },
    { key: 'OTHER', name: 'Synthetic · Cards platform', members: { 'dev-outsider': 'QE_LEAD' } },
  ] as const;

  for (const p of projects) {
    const project = await db.project.upsert({
      where: { key: p.key },
      update: {},
      create: {
        key: p.key,
        name: p.name,
        description: 'Synthetic project for local development',
        createdById: admin.id,
      },
    });
    for (const [subject, role] of Object.entries(p.members)) {
      const user = users[subject]!;
      await db.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
        update: { role },
        create: { projectId: project.id, userId: user.id, role, addedById: admin.id },
      });
    }
    const existing = await db.estimate.findFirst({
      where: { projectId: project.id, name: 'Example estimate' },
    });
    if (!existing) {
      const snap = versionSnapshot(
        structuredClone(EXAMPLE_INPUTS),
        structuredClone(DEFAULT_ASSUMPTIONS),
      );
      await db.estimate.create({
        data: {
          projectId: project.id,
          name: 'Example estimate',
          description: 'The prototype example scope with default assumptions',
          createdById: admin.id,
          versions: {
            create: {
              number: 1,
              status: 'SAVED',
              inputs: EXAMPLE_INPUTS as unknown as Prisma.InputJsonValue,
              assumptions: DEFAULT_ASSUMPTIONS as unknown as Prisma.InputJsonValue,
              profileId: profile.id,
              result: snap.result as unknown as Prisma.InputJsonValue,
              engineVersion: snap.engineVersion,
              schemaVersion: INPUTS_SCHEMA_VERSION,
              roughFte: snap.roughFte,
              detailedFte: snap.detailedFte,
              totalCasesDetailed: snap.totalCasesDetailed,
              uncalibrated: snap.uncalibrated,
              assumptionRows: snap.assumptionRows,
              note: 'Seeded example',
              createdById: admin.id,
            },
          },
        },
      });
    }
  }
  console.log(
    `seed: ${USERS.length} users, ${projects.length} projects, global profile "${profile.name}"`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
