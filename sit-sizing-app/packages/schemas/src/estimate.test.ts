import { describe, expect, it } from 'vitest';
import { Assumptions } from './assumptions';
import { EstimateInputs, Feature, Team } from './inputs';
import { EstimateResult, GROUP_KEYS } from './result';

const feature = { name: 'Synthetic · Payments', size: 'M', cx: 1, qty: 2 };
const team = {
  weeks: 6,
  mix: { junior: 30, mid: 50, senior: 20 },
  env: 1,
  automation: 0,
  ai: 0,
  aiIters: 4,
  aiSmes: 2,
};

describe('Feature', () => {
  it('accepts the prototype shape, with optional type and pt', () => {
    expect(Feature.parse(feature)).toEqual(feature);
    expect(Feature.parse({ ...feature, type: 'data', pt: true }).type).toBe('data');
  });

  it.each([
    ['badly named size', { size: 'M.1' }],
    ['complexity out of range', { cx: 3 }],
    ['negative quantity', { qty: -1 }],
    ['unknown type', { type: 'mobile' }],
  ])('rejects %s', (_label, patch) => {
    expect(Feature.safeParse({ ...feature, ...patch }).success).toBe(false);
  });
});

describe('Team', () => {
  it('accepts a valid team', () => {
    expect(Team.parse(team)).toEqual(team);
  });

  it.each([
    ['environment index 4', { env: 4 }],
    ['fractional AI level', { ai: 1.5 }],
    ['automation above 100%', { automation: 120 }],
    ['zero evaluation runs', { aiIters: 0 }],
  ])('rejects %s', (_label, patch) => {
    expect(Team.safeParse({ ...team, ...patch }).success).toBe(false);
  });
});

describe('Assumptions and EstimateInputs', () => {
  it('reject an empty object and list every missing key', () => {
    const a = Assumptions.safeParse({});
    expect(a.success).toBe(false);
    expect(a.error?.issues.length).toBeGreaterThan(100);
    expect(EstimateInputs.safeParse({}).success).toBe(false);
  });

  it('reject non-finite numbers', () => {
    expect(Team.safeParse({ ...team, weeks: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(Team.safeParse({ ...team, weeks: Number.NaN }).success).toBe(false);
  });
});

describe('EstimateResult', () => {
  const group = { cases: 1, hours: 1.5 };
  const summary = {
    mode: 'rough',
    cases: 34,
    hours: 51,
    fte: 0.3,
    band: 0.4,
    lo: 0.18,
    hi: 0.42,
    hpf: 180,
    blended: 0.95,
    per: 171,
    levels: [0.1, 0.1, 0.1],
    labelHours: 0,
    smeLabelHours: 0,
    groups: Object.fromEntries(GROUP_KEYS.map((k) => [k, group])),
  };

  it('requires every group and a semantic engine version', () => {
    const ok = {
      engineVersion: '1.0.0',
      rough: summary,
      detailed: { ...summary, mode: 'detailed' },
    };
    expect(EstimateResult.parse(ok).engineVersion).toBe('1.0.0');
    expect(EstimateResult.safeParse({ ...ok, engineVersion: 'v1' }).success).toBe(false);
    const { api: _api, ...missing } = summary.groups;
    expect(
      EstimateResult.safeParse({ ...ok, rough: { ...summary, groups: missing } }).success,
    ).toBe(false);
  });
});
