import { readFileSync } from 'node:fs';
import { DEFAULT_ASSUMPTIONS, uncalibratedCount } from '@sit/engine';
import type { Prisma } from '@sit/db';
import { Assumptions } from '@sit/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { seeded } from './helpers';

/**
 * ADR-0020 profile data migration: profiles saved with four sizes (S, M, L, XL) gain the six
 * new sizes at their defaults; existing values never change. Synthetic data only.
 */
const SQL = readFileSync(
  new URL(
    '../../../../packages/db/prisma/migrations/20261122000000_more_feature_sizes/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const NEW = ['XXS', 'XS', 'M-', 'M+', 'XXL', 'XXXL'] as const;
const GROUPS = ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const;
const run = Date.now().toString(36);
let createdById: string;

beforeAll(async () => {
  createdById = (await seeded()).profile.createdById;
});

async function migrate() {
  for (const stmt of SQL.split(';').filter((s) => /\bUPDATE\b/.test(s)))
    await db().$executeRawUnsafe(stmt);
}

/** A profile as engine 1.1 stored it: only S, M, L and XL, with one calibrated value. */
async function fourSizeProfile(name: string) {
  const values = structuredClone(DEFAULT_ASSUMPTIONS) as unknown as Record<
    string,
    Record<string, unknown>
  >;
  for (const g of GROUPS) for (const s of NEW) delete values[g]![s];
  (values.proxies!.S as Record<string, number>).api = 3;
  return db().assumptionProfile.create({
    data: {
      scope: 'GLOBAL',
      name: `Synthetic · sizes ${run} ${name}`,
      values: values as unknown as Prisma.InputJsonValue,
      createdById,
    },
  });
}

describe('profile data migration 20261122000000_more_feature_sizes (ADR-0020)', () => {
  it('adds the six new sizes at their defaults and keeps existing values', async () => {
    const p = await fourSizeProfile('add');
    await migrate();
    const row = await db().assumptionProfile.findUniqueOrThrow({ where: { id: p.id } });
    const values = Assumptions.parse(row.values);
    const D = DEFAULT_ASSUMPTIONS as unknown as Record<string, Record<string, unknown>>;
    for (const g of GROUPS)
      for (const s of NEW)
        expect((values as unknown as Record<string, Record<string, unknown>>)[g]![s]).toEqual(
          D[g]![s],
        );
    expect(values.proxies.S.api).toBe(3);
    // Only proxies.S was calibrated; the 18 new rows are uncalibrated defaults.
    expect(uncalibratedCount(values, DEFAULT_ASSUMPTIONS)).toBe(159);
  });

  it('changes nothing when it runs again', async () => {
    const p = await fourSizeProfile('twice');
    await migrate();
    const once = (await db().assumptionProfile.findUniqueOrThrow({ where: { id: p.id } })).values;
    await migrate();
    const twice = (await db().assumptionProfile.findUniqueOrThrow({ where: { id: p.id } })).values;
    expect(twice).toEqual(once);
  });
});
