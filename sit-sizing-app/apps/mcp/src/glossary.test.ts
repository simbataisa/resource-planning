import { ASSUMPTION_PATHS, DEFAULT_ASSUMPTIONS } from '@sit/engine';
import { EstimateInputs } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ASSUMPTION_GROUPS, describeAssumptions, describeInputs, INPUT_GROUPS } from './glossary';
import { PathError } from './merge';

/** Every leaf path of a Zod object schema; array elements are written `*`. */
function leaves(schema: z.ZodType, prefix = ''): string[] {
  if (schema instanceof z.ZodOptional) return leaves(schema.unwrap() as z.ZodType, prefix);
  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape).flatMap(([k, v]) =>
      leaves(v as z.ZodType, prefix ? `${prefix}.${k}` : k),
    );
  }
  if (schema instanceof z.ZodArray) return leaves(schema.element as z.ZodType, `${prefix}.*`);
  return [prefix];
}

describe('describeAssumptions', () => {
  it('returns 142 rows with label and default; explanation is null when no help text exists', () => {
    const rows = describeAssumptions({ locale: 'en' });
    expect(rows.map((r) => r.path)).toEqual([...ASSUMPTION_PATHS]);
    const api = rows.find((r) => r.path === 'cases.api')!;
    expect(api).toEqual({
      path: 'cases.api',
      group: 'cases',
      label: 'API endpoint',
      unit: 'cases',
      explanation: null,
      default: DEFAULT_ASSUMPTIONS.cases.api,
    });
    for (const r of rows) {
      expect(r.label, r.path).toBeTruthy();
      expect(r.label, r.path).not.toContain('{');
      expect(r.default, r.path).not.toBeUndefined();
      expect(r).not.toHaveProperty('value');
      expect(r).not.toHaveProperty('calibrated');
    }
    expect(rows.find((r) => r.path === 'proxies.M')?.label).toBe('Size M');
  });

  it('marks a changed row calibrated and adds source and measuredAt from the profile', () => {
    const values = { ...structuredClone(DEFAULT_ASSUMPTIONS), criticalShare: 0.45 };
    const rows = describeAssumptions({
      locale: 'en',
      paths: ['criticalShare', 'wiringCases'],
      values,
      calibration: {
        criticalShare: { source: 'Synthetic release retro', measuredAt: '2026-03-01' },
        wiringCases: { source: 'Synthetic team note' },
      },
    });
    expect(rows).toEqual([
      expect.objectContaining({
        path: 'criticalShare',
        default: 0.3,
        value: 0.45,
        calibrated: true,
        source: 'Synthetic release retro',
        measuredAt: '2026-03-01',
      }),
      expect.objectContaining({
        path: 'wiringCases',
        value: DEFAULT_ASSUMPTIONS.wiringCases,
        calibrated: false,
        source: 'Synthetic team note',
      }),
    ]);
    expect(rows[1]).not.toHaveProperty('measuredAt');
  });

  it('serves Vietnamese labels for locale vi', () => {
    const en = describeAssumptions({ locale: 'en', paths: ['cases.screen', 'ftypes.text'] });
    const vi = describeAssumptions({ locale: 'vi', paths: ['cases.screen', 'ftypes.text'] });
    expect(vi[0]?.label).toBeTruthy();
    expect(vi[0]?.label).not.toBe(en[0]?.label);
    expect(vi[1]?.label).not.toBe(en[1]?.label);
  });

  it('filters by group and by paths; an unknown path is a validation error naming it', () => {
    const cases = describeAssumptions({ locale: 'en', group: 'cases' });
    expect(cases.map((r) => r.path)).toEqual([
      'cases.api',
      'cases.screen',
      'cases.integration',
      'cases.batch',
      'cases.event',
      'cases.journey',
    ]);
    expect(ASSUMPTION_GROUPS).toContain('proxies');
    expect(
      describeAssumptions({ locale: 'en', group: 'cases', paths: ['cases.api', 'capacity'] }).map(
        (r) => r.path,
      ),
    ).toEqual(['cases.api']);
    expect(() => describeAssumptions({ locale: 'en', paths: ['cases.nope'] })).toThrow(PathError);
    expect(() => describeAssumptions({ locale: 'en', paths: ['cases.nope'] })).toThrow(
      /'cases\.nope'/,
    );
  });
});

describe('describeInputs', () => {
  it('every EstimateInputs leaf has an InputField with a label in EN and VI', () => {
    const en = describeInputs({ locale: 'en' });
    const vi = describeInputs({ locale: 'vi' });
    expect(en.map((f) => f.path).sort()).toEqual(leaves(EstimateInputs).sort());
    expect(vi.map((f) => f.path)).toEqual(en.map((f) => f.path));
    for (const [i, f] of en.entries()) {
      expect(INPUT_GROUPS).toContain(f.group);
      expect(f.label, f.path).toBeTruthy();
      expect(f.label, f.path).not.toMatch(/^[a-zA-Z]+\.[a-zA-Z.]+$/);
      expect(vi[i]?.label, f.path).toBeTruthy();
      expect(vi[i]?.label, f.path).not.toMatch(/^[a-zA-Z]+\.[a-zA-Z.]+$/);
    }
    expect(en.find((f) => f.path === 'evidence.mutation')).toEqual({
      path: 'evidence.mutation',
      group: 'evidence',
      label: 'L1 mutation score (PIT)',
      explanation: expect.stringContaining('JUnit 5'),
      type: 'percent',
      min: 0,
      max: 100,
    });
    expect(en.find((f) => f.path === 'team.env')).toMatchObject({
      type: 'enum',
      min: 0,
      max: 3,
      options: [
        '0: Dedicated or stubbed',
        '1: Mostly available',
        '2: Shared, real downstream',
        '3: Shared core-banking windows',
      ],
    });
    expect(en.find((f) => f.path === 'detail.api')).toMatchObject({
      type: 'band3',
      min: 0,
      explanation: expect.stringContaining('Simple: Read or basic CRUD'),
    });
  });

  it('filters by group', () => {
    const team = describeInputs({ locale: 'en', group: 'ptTypes' });
    expect(team.map((f) => f.path)).toEqual([
      'ptTypes.load',
      'ptTypes.stress',
      'ptTypes.soak',
      'ptTypes.spike',
      'ptTypes.failover',
    ]);
    expect(team.every((f) => f.type === 'boolean')).toBe(true);
  });
});
