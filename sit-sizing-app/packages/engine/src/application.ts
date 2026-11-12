import type { Assumptions, Evidence } from '@sit/schemas';
import type { CaseDriver } from './catalogue.ts';
import type { Ctx } from './context.ts';
import { map3, num, zero3, type Triple } from './util.ts';

/** Cases for a driver: count × cases per item × optional multiplier (prototype `by()`). */
export function byDriver(ctx: Ctx, d: CaseDriver, mul?: number): Triple {
  return map3(ctx.c[d], (n, b) => n * ctx.A.cases[d][b] * (mul || 1));
}

/** Frontend L1 gates: missed gates add screen cases (prototype feUnitOK / feMutOK / feUp). */
export function frontendUplift(A: Assumptions, E: Partial<Evidence>) {
  const feUnitOK = num(E.feUnit) >= A.feUnitGate;
  const feMutOK = num(E.feMut) >= A.feMutGate;
  const feUp = (feUnitOK ? 0 : A.feLogicUplift) + (feMutOK ? 0 : A.feMutUplift);
  return { feUnitOK, feMutOK, feUp };
}

/** APIs, screens, integrations, batch, events and L4 journeys. */
export function applicationGroups(ctx: Ctx, feUp: number) {
  return {
    api: byDriver(ctx, 'api'),
    screen: byDriver(ctx, 'screen', 1 + feUp),
    integration: byDriver(ctx, 'integration'),
    batch: byDriver(ctx, 'batch'),
    event: byDriver(ctx, 'event'),
    journey: ctx.S.includeL4 ? byDriver(ctx, 'journey') : zero3(),
  };
}
