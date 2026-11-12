import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { calendarChecks } from './calendar.ts';
import { isDefaultRow, uncalibratedCount } from './calibration.ts';
import { computeBoth } from './compute.ts';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
import { derivedRows } from './derived.ts';
import { gapRows, topGap } from './gap.ts';
import { itemHours } from './rubric.ts';
import { SENSITIVITY_ITEMS, sensitivity } from './sensitivity.ts';
import { shiftLeftScenarios } from './scenarios.ts';
import { toStoredResult } from './summary.ts';

const A = () => structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
const S = () => structuredClone(EXAMPLE_INPUTS) as EstimateInputs;

describe('sensitivity', () => {
  it('drops rough-only rows in detailed mode and sorts by span', () => {
    const { base, rows } = sensitivity('detailed', S(), A(), 0.3);
    expect(base).toBeGreaterThan(0);
    expect(rows.some((r) => r.key === 'proxies' || r.key === 'criticalShare')).toBe(false);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i - 1]!.span).toBeGreaterThanOrEqual(rows[i]!.span);
    for (const r of rows) {
      expect(r.lo).toBeLessThanOrEqual(r.hi);
      expect(r.span).toBeGreaterThan(1e-6);
    }
  });

  it('includes rough-only rows in rough mode and covers all 42 items', () => {
    expect(SENSITIVITY_ITEMS).toHaveLength(42);
    const { rows } = sensitivity('rough', S(), A(), 0.3);
    expect(rows.some((r) => r.key === 'proxies')).toBe(true);
  });

  it('every item changes at least one assumption', () => {
    for (const item of SENSITIVITY_ITEMS) {
      const a = A();
      item.apply(a, 1.5);
      expect(JSON.stringify(a), item.key).not.toBe(JSON.stringify(DEFAULT_ASSUMPTIONS));
    }
  });
});

describe('shiftLeftScenarios', () => {
  it('returns all gates, current and no gates, in that order', () => {
    const sc = shiftLeftScenarios(S(), A());
    expect(sc.map((s) => s.key)).toEqual(['allGates', 'current', 'noGates']);
    expect(sc[0]!.result.fte).toBeLessThan(sc[1]!.result.fte);
    expect(sc[1]!.result.fte).toBeLessThan(sc[2]!.result.fte);
  });
});

describe('calendarChecks', () => {
  it('reports data, AI and performance checks for the example', () => {
    const checks = calendarChecks(computeBoth(S(), A()), S(), A());
    expect(checks.map((c) => c.kind)).toEqual(['data', 'ai', 'performance']);
    expect(checks.every((c) => c.fits)).toBe(true);
  });

  it('flags checks that do not fit a one-week window', () => {
    const s = S();
    s.team.weeks = 1;
    s.team.aiSmes = 1;
    const checks = calendarChecks(computeBoth(s, A()), s, A());
    expect(checks.find((c) => c.kind === 'data')!.fits).toBe(false);
    expect(checks.find((c) => c.kind === 'performance')!.fits).toBe(false);
  });

  it('is empty when there is no data, AI or performance scope', () => {
    const s = S();
    s.features = s.features
      .filter((f) => !f.type || f.type === 'app')
      .map((f) => ({ ...f, pt: false }));
    s.detail.data = {
      feed: [0, 0, 0],
      pipe: [0, 0, 0],
      table: [0, 0, 0],
      report: [0, 0, 0],
      columns: 0,
      dq: 0,
      scd: 0,
      secured: 0,
      accessRoles: 0,
    };
    s.detail.ai = { intent: [0, 0, 0], ocr: [0, 0, 0], rag: 0, tools: 0, guard: 0, hitl: 0 };
    s.detail.pt = { scen: [0, 0, 0], dataHeavy: 0 };
    expect(calendarChecks(computeBoth(s, A()), s, A())).toEqual([]);
  });
});

describe('calibration', () => {
  it('counts rows that still equal the defaults', () => {
    const a = A();
    expect(uncalibratedCount(a, DEFAULT_ASSUMPTIONS)).toBe(142);
    a.minutes = [10, 20, 45];
    a.proxies.S.api = 3;
    expect(uncalibratedCount(a, DEFAULT_ASSUMPTIONS)).toBe(140);
    expect(isDefaultRow(a, DEFAULT_ASSUMPTIONS, 'minutes')).toBe(false);
    expect(isDefaultRow(a, DEFAULT_ASSUMPTIONS, 'cases.api')).toBe(true);
  });
});

describe('gap analysis', () => {
  it('names the group that explains most of the hours gap', () => {
    const b = computeBoth(S(), A());
    const rows = gapRows(b);
    const top = topGap(b);
    expect(top).not.toBeNull();
    const best = rows.reduce((m, r) => (Math.abs(r.deltaHours) > Math.abs(m.deltaHours) ? r : m));
    expect(top!.group).toBe(best.group);
  });

  it('returns null when rough and detailed agree', () => {
    const b = computeBoth(S(), A());
    expect(topGap({ ...b, detailed: b.rough })).toBeNull();
    expect(gapRows({ ...b, detailed: b.rough }).every((r) => r.share === 0)).toBe(true);
  });
});

describe('derivedRows and rubric', () => {
  it('lists formula inputs for every counted family', () => {
    const b = computeBoth(S(), A());
    const rows = derivedRows(b.detailed, A());
    expect(rows.map((r) => r.group)).toContain('dataPrep');
    expect(rows.map((r) => r.group)).toContain('aiEval');
    expect(rows.map((r) => r.group)).toContain('ptRun');
    const rule = rows.find((r) => r.group === 'rule')!;
    expect(rule.cases).toBe(b.detailed.groups.rule.cases);
  });

  it('estimates hours per item from the current rates', () => {
    const d = computeBoth(S(), A()).detailed;
    const a = A();
    expect(itemHours('api', 1, d, a)).toBeCloseTo(
      (a.cases.api[1] * (d.design + a.minutes[1] * d.execF) * (1 + a.overhead)) / 60,
      10,
    );
    expect(itemHours('workflow', 0, d, a)).toBeGreaterThan(0);
  });
});

describe('toStoredResult', () => {
  it('keeps totals and groups and drops working values', () => {
    const b = computeBoth(S(), A());
    const stored = toStoredResult(b);
    expect(stored.detailed.cases).toBe(b.detailed.cases);
    expect(stored.rough.groups.api).toEqual(b.rough.groups.api);
    expect('explain' in stored.detailed).toBe(false);
  });
});
