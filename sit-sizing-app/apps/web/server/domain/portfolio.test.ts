import { describe, expect, it } from 'vitest';
import type { PortfolioRow } from '@sit/schemas';
import { rollUp, totals } from './portfolio';

const row = (over: Partial<PortfolioRow>): PortfolioRow => ({
  projectId: 'p1',
  projectKey: 'LEND',
  projectName: 'Synthetic · Lending',
  estimateId: 'e1',
  estimateName: 'Onboarding',
  versionNumber: 1,
  status: 'APPROVED',
  approvedAt: '2026-11-13T07:00:00.000Z',
  profileName: 'Default',
  engineVersion: '1.0.0',
  fte: 21.53,
  lo: 18.3,
  hi: 24.76,
  cases: 4047,
  hours: 3680.8,
  roughFte: 20.46,
  uncalibrated: 160,
  assumptionRows: 160,
  ...over,
});

describe('portfolio roll-up (R-01: totals equal the sum of the versions)', () => {
  const rows = [
    row({}),
    row({
      estimateId: 'e2',
      estimateName: 'Cards',
      fte: 8.25,
      lo: 7,
      hi: 9.5,
      cases: 1200,
      hours: 1400.5,
      roughFte: 9,
      uncalibrated: 120,
    }),
    row({
      projectId: 'p2',
      projectKey: 'PAY',
      projectName: 'Synthetic · Payments',
      estimateId: 'e3',
      estimateName: 'Wallet',
      fte: 3.1,
      lo: 2.6,
      hi: 3.6,
      cases: 300,
      hours: 410,
      roughFte: 4,
      uncalibrated: 160,
    }),
  ];
  const p = rollUp(rows, 'approved', 160);

  it('sums every row into the total', () => {
    expect(p.total).toEqual({
      estimates: 3,
      fte: 21.53 + 8.25 + 3.1,
      lo: 18.3 + 7 + 2.6,
      hi: 24.76 + 9.5 + 3.6,
      cases: 4047 + 1200 + 300,
      hours: 3680.8 + 1400.5 + 410,
      roughFte: 20.46 + 9 + 4,
      onDefaults: 2,
    });
  });

  it('subtotals per project add up to the total', () => {
    expect(p.projects.map((x) => x.projectKey)).toEqual(['LEND', 'PAY']);
    expect(p.projects[0]!.rows.map((r) => r.estimateName)).toEqual(['Cards', 'Onboarding']);
    for (const k of [
      'estimates',
      'fte',
      'lo',
      'hi',
      'cases',
      'hours',
      'roughFte',
      'onDefaults',
    ] as const) {
      const sum = p.projects.reduce((s, x) => s + x.subtotal[k], 0);
      expect(sum).toBeCloseTo(p.total[k], 9);
    }
  });

  it('handles an empty portfolio', () => {
    expect(rollUp([], 'latest', 160)).toEqual({
      status: 'latest',
      projects: [],
      total: totals([]),
      assumptionRows: 160,
    });
    expect(totals([])).toMatchObject({ estimates: 0, fte: 0, onDefaults: 0 });
  });
});

describe('portfolio with custom sizes (ADR-0021)', () => {
  it('judges each estimate on defaults against its own row total', () => {
    const t = totals([
      row({ uncalibrated: 163, assumptionRows: 163 }),
      row({ estimateId: 'e2', uncalibrated: 160, assumptionRows: 163 }),
    ]);
    expect(t.onDefaults).toBe(1);
  });
});
