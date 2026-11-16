import { DEFAULT_ASSUMPTIONS } from '@sit/engine';
import type { Prisma } from '@sit/db';
import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import * as draft from '@/app/api/v1/estimates/[estimateId]/draft/route';
import * as applyRoute from '@/app/api/v1/estimates/[estimateId]/draft/profile/route';
import * as versions from '@/app/api/v1/estimates/[estimateId]/versions/route';
import * as estimates from '@/app/api/v1/projects/[projectId]/estimates/route';
import * as profileRoute from '@/app/api/v1/profiles/[profileId]/route';
import { db } from '@/server/db';
import { call, seeded } from './helpers';

/** Custom feature sizes (ADR-0021) through the route handlers. Synthetic data only. */
const run = Date.now().toString(36);
const TABLES = ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const;
let projectId: string;
let createdById: string;

beforeAll(async () => {
  const s = await seeded();
  projectId = s.demo.id;
  createdById = s.profile.createdById;
});

/** Defaults with `add` sizes (copied from S) and without `remove` sizes. */
function values(add: string[] = [], remove: string[] = []): Assumptions {
  const a = structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
  for (const t of TABLES) {
    const table = a[t] as Record<string, unknown>;
    for (const n of add) table[n] = structuredClone(table.S);
    for (const n of remove) delete table[n];
  }
  a.sizes = [...a.sizes.filter((s) => !remove.includes(s)), ...add];
  return a;
}

async function publishedProfile(name: string, v: Assumptions, calibration: object = {}) {
  return db().assumptionProfile.create({
    data: {
      scope: 'GLOBAL',
      status: 'PUBLISHED',
      name: `Synthetic · custom sizes ${run} ${name}`,
      values: v as unknown as Prisma.InputJsonValue,
      calibration: calibration as Prisma.InputJsonValue,
      createdById,
      publishedAt: new Date(),
    },
  });
}

/** A new estimate whose rough scope has these feature sizes; returns ids and the lock. */
async function estimateWith(name: string, sizes: string[], profileId?: string) {
  const res = await call(estimates.POST, {
    who: 'dev-estimator',
    method: 'POST',
    params: { projectId },
    body: { name: `Synthetic · ${name} ${run}`, ...(profileId ? { profileId } : {}) },
  });
  expect(res.status, JSON.stringify(res.json)).toBe(201);
  const estimateId = res.json.id as string;
  const lockToken = res.json.lockToken as string;
  const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId } });
  const inputs = structuredClone(v.inputs) as unknown as EstimateInputs;
  inputs.features = sizes.map((size, i) => ({ ...inputs.features[0]!, name: `F${i}`, size }));
  const patched = await call(draft.PATCH, {
    who: 'dev-estimator',
    method: 'PATCH',
    params: { estimateId },
    body: { rowVersion: v.rowVersion, inputs },
    lockToken,
  });
  expect(patched.status, JSON.stringify(patched.json)).toBe(200);
  return { estimateId, lockToken, rowVersion: patched.json.rowVersion as number, inputs };
}

const apply = (
  e: { estimateId: string; lockToken: string },
  profileId: string,
  rowVersion: number,
) =>
  call(applyRoute.POST, {
    who: 'dev-estimator',
    method: 'POST',
    params: { estimateId: e.estimateId },
    body: { profileId, rowVersion },
    lockToken: e.lockToken,
  });

describe('applying a profile with custom sizes (ADR-0021)', () => {
  it('refuses when features use a size the profile lacks, and changes nothing', async () => {
    const p = await publishedProfile('no XXL', values([], ['XXL']));
    const e = await estimateWith('blocked', ['XXL', 'M', 'XXL', 'XXL']);
    const res = await apply(e, p.id, e.rowVersion);
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe('CONFLICT');
    expect(res.json.error.details).toEqual([
      { reason: 'SIZE_NOT_IN_PROFILE', size: 'XXL', features: 3 },
    ]);
    const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId: e.estimateId } });
    expect(v.rowVersion).toBe(e.rowVersion);
    expect(v.profileId).not.toBe(p.id);
  });

  it('applies when only unused sizes are missing; the draft takes the profile sizes', async () => {
    const p = await publishedProfile('no XXXL', values([], ['XXXL']));
    const e = await estimateWith('unused', ['M']);
    const res = await apply(e, p.id, e.rowVersion);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.assumptions.sizes).not.toContain('XXXL');
  });

  it('copies the profile notes for custom-size rows into the estimate', async () => {
    const note = { source: 'Synthetic pilot' };
    const calibration = {
      'proxies.XS2': note,
      'dproxies.XS2': note,
      'aproxies.XS2': note,
      sampleFE: note,
    };
    const p = await publishedProfile('XS2', values(['XS2']), calibration);
    const e = await estimateWith('notes', ['M']);
    const res = await apply(e, p.id, e.rowVersion);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(Object.keys(res.json.assumptions.sizeNotes).sort()).toEqual([
      'aproxies.XS2',
      'dproxies.XS2',
      'proxies.XS2',
    ]);
    expect(res.json.uncalibrated).toBe(160);
  });

  it('copies the notes when an estimate is created from the profile', async () => {
    const note = { source: 'Synthetic pilot' };
    const p = await publishedProfile('create', values(['XS3']), { 'proxies.XS3': note });
    const e = await estimateWith('created', ['XS3'], p.id);
    const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId: e.estimateId } });
    expect((v.assumptions as unknown as Assumptions).sizeNotes).toEqual({ 'proxies.XS3': note });
    expect(v.uncalibrated).toBe(162);
  });
});

describe('an estimate keeps the sizes of its profile (ADR-0021)', () => {
  it('keeps the copied notes: an autosave cannot calibrate custom-size rows', async () => {
    const p = await publishedProfile('notes guard', values(['XS5']));
    const e = await estimateWith('notes guard', ['M'], p.id);
    const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId: e.estimateId } });
    const assumptions = structuredClone(v.assumptions) as unknown as Assumptions;
    const note = { source: 'Synthetic, not from the profile' };
    assumptions.sizeNotes = { 'proxies.XS5': note, 'dproxies.XS5': note, 'aproxies.XS5': note };
    const res = await call(draft.PATCH, {
      who: 'dev-estimator',
      method: 'PATCH',
      params: { estimateId: e.estimateId },
      body: { rowVersion: e.rowVersion, assumptions },
      lockToken: e.lockToken,
    });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.assumptions.sizeNotes).toEqual({});
    expect(res.json.uncalibrated).toBe(v.uncalibrated);
  });

  it('refuses an autosave that changes the size list', async () => {
    const e = await estimateWith('guard sizes', ['M']);
    const res = await call(draft.PATCH, {
      who: 'dev-estimator',
      method: 'PATCH',
      params: { estimateId: e.estimateId },
      body: { rowVersion: e.rowVersion, assumptions: values(['Z']) },
      lockToken: e.lockToken,
    });
    expect(res.status).toBe(422);
  });

  it('refuses an autosave with a feature whose size the estimate lacks', async () => {
    const e = await estimateWith('guard features', ['M']);
    const inputs = structuredClone(e.inputs);
    inputs.features[0]!.size = 'Q';
    const res = await call(draft.PATCH, {
      who: 'dev-estimator',
      method: 'PATCH',
      params: { estimateId: e.estimateId },
      body: { rowVersion: e.rowVersion, inputs },
      lockToken: e.lockToken,
    });
    expect(res.status).toBe(422);
  });

  it('still saves a version with valid sizes', async () => {
    const e = await estimateWith('save', ['M', 'XXS']);
    const res = await call(versions.POST, {
      who: 'dev-estimator',
      method: 'POST',
      params: { estimateId: e.estimateId },
      body: { note: 'Synthetic · v1' },
      lockToken: e.lockToken,
    });
    expect(res.status, JSON.stringify(res.json)).toBe(201);
  });
});

describe('a profile counts its own custom sizes (ADR-0021)', () => {
  it('uses its notes for custom-size rows and reports its row total', async () => {
    const note = { source: 'Synthetic pilot' };
    const p = await publishedProfile('count', values(['XS4']), {
      'proxies.XS4': note,
      'dproxies.XS4': note,
    });
    const res = await call(profileRoute.GET, {
      who: 'dev-estimator',
      method: 'GET',
      params: { profileId: p.id },
    });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.assumptionRows).toBe(163);
    expect(res.json.uncalibrated).toBe(161);
  });
});

describe('each version stores its own row total (ADR-0021)', () => {
  it('stores 130 fixed rows plus 3 per size', async () => {
    const p = await publishedProfile(
      'rows',
      values([], ['XXS', 'XS', 'M-', 'M+', 'XL', 'XXL', 'XXXL']),
    );
    const e = await estimateWith('rows', ['S', 'M'], p.id);
    const v = await db().estimateVersion.findFirstOrThrow({ where: { estimateId: e.estimateId } });
    expect(v.assumptionRows).toBe(139);
  });
});
