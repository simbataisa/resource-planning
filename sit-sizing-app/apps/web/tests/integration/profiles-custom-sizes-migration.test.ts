import { readFileSync } from 'node:fs';
import { DEFAULT_ASSUMPTIONS, SIZES } from '@sit/engine';
import type { Prisma } from '@sit/db';
import { Assumptions } from '@sit/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { seeded } from './helpers';

/**
 * ADR-0021 profile data migration: stored profiles gain an ordered size list (the built-in
 * names present in their tables, in built-in order) and empty size notes. Synthetic data only.
 */
const SQL = readFileSync(
  new URL(
    '../../../../packages/db/prisma/migrations/20261123000000_custom_sizes_profiles/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
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

/** A profile as engine 1.2 stored it: no size list, with these sizes in its tables. */
async function oldProfile(name: string, keep: readonly string[] = SIZES) {
  const values = structuredClone(DEFAULT_ASSUMPTIONS) as unknown as Record<
    string,
    Record<string, unknown>
  >;
  delete values.sizes;
  delete values.sizeNotes;
  for (const g of GROUPS)
    for (const s of Object.keys(values[g]!)) if (!keep.includes(s)) delete values[g]![s];
  return db().assumptionProfile.create({
    data: {
      scope: 'GLOBAL',
      name: `Synthetic · size list ${run} ${name}`,
      values: values as unknown as Prisma.InputJsonValue,
      createdById,
    },
  });
}

const valuesOf = async (id: string) =>
  (await db().assumptionProfile.findUniqueOrThrow({ where: { id } })).values as Record<
    string,
    unknown
  >;

describe('profile data migration 20261123000000_custom_sizes_profiles (ADR-0021)', () => {
  it('adds the ten built-in sizes in order and empty notes', async () => {
    const p = await oldProfile('all');
    await migrate();
    const values = await valuesOf(p.id);
    expect(values.sizes).toEqual([...SIZES]);
    expect(values.sizeNotes).toEqual({});
    expect(Assumptions.safeParse(values).success).toBe(true);
  });

  it('lists only the sizes in the tables', async () => {
    const p = await oldProfile('two', ['M', 'S']);
    await migrate();
    expect((await valuesOf(p.id)).sizes).toEqual(['S', 'M']);
  });

  it('leaves a profile that already has a size list alone, so it is safe to run twice', async () => {
    const p = await oldProfile('twice');
    await migrate();
    await db().$executeRawUnsafe(
      `UPDATE "AssumptionProfile" SET "values" = jsonb_set("values", '{sizes}', '["XL","S"]') WHERE id = '${p.id}'`,
    );
    await migrate();
    expect((await valuesOf(p.id)).sizes).toEqual(['XL', 'S']);
  });
});
