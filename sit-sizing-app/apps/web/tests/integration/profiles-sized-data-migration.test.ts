import { readFileSync } from 'node:fs';
import type { Prisma } from '@sit/db';
import { DEFAULT_ASSUMPTIONS, uncalibratedCount } from '@sit/engine';
import { Assumptions } from '@sit/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { seeded } from './helpers';

/**
 * ADR-0019 profile data migration: profiles stored with single data-test values (engine
 * 1.0.0) become Simple/Medium/Complex triples. Default rows take the new defaults and stay
 * uncalibrated; calibrated rows keep their value at every size. Synthetic data only.
 */
const SQL = readFileSync(
  new URL(
    '../../../../packages/db/prisma/migrations/20261120000000_sized_data_assumptions/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const run = Date.now().toString(36);
let createdById: string;

beforeAll(async () => {
  createdById = (await seeded()).profile.createdById;
});

async function migrate() {
  for (const stmt of SQL.split(';').filter((s) => /\bUPDATE\b/.test(s)))
    await db().$executeRawUnsafe(stmt);
}

async function legacyProfile(name: string, over: Record<string, number>) {
  const values = {
    ...structuredClone(DEFAULT_ASSUMPTIONS),
    dataDesign: 10,
    dataExec: 5,
    dataPrepHours: 2,
    ...over,
  };
  return db().assumptionProfile.create({
    data: {
      scope: 'GLOBAL',
      name: `Synthetic · sized data ${run} ${name}`,
      values: values as unknown as Prisma.InputJsonValue,
      createdById,
    },
  });
}

describe('profile data migration 20261120000000_sized_data_assumptions (ADR-0019)', () => {
  it('gives default rows the new defaults and calibrated rows [v, v, v]', async () => {
    const p = await legacyProfile('mixed', { dataExec: 7 });
    await migrate();
    const row = await db().assumptionProfile.findUniqueOrThrow({ where: { id: p.id } });
    const values = Assumptions.parse(row.values);
    expect(values.dataDesign).toEqual([10, 15, 25]);
    expect(values.dataExec).toEqual([7, 7, 7]);
    expect(values.dataPrepHours).toEqual([2, 3, 5]);
    // Only dataExec was calibrated, so 141 rows still equal the defaults.
    expect(uncalibratedCount(values, DEFAULT_ASSUMPTIONS)).toBe(141);
  });

  it('changes nothing when it runs again', async () => {
    const p = await legacyProfile('twice', { dataDesign: 12 });
    await migrate();
    const once = (await db().assumptionProfile.findUniqueOrThrow({ where: { id: p.id } })).values;
    await migrate();
    const twice = (await db().assumptionProfile.findUniqueOrThrow({ where: { id: p.id } })).values;
    expect(twice).toEqual(once);
    expect((once as { dataDesign: number[] }).dataDesign).toEqual([12, 12, 12]);
  });

  it('leaves the seeded profile, already in the new shape, unchanged', async () => {
    const { profile } = await seeded();
    await migrate();
    const row = await db().assumptionProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(row.values).toEqual(profile.values);
  });
});
