import type { Assumptions } from '@sit/schemas';
import type { Driver } from './catalogue.ts';
import type { ModeResult } from './types.ts';
import type { Band } from './util.ts';

/** Approximate hours for one item of a driver at a complexity band (prototype itemHours). */
export function itemHours(driver: Driver, band: Band, result: ModeResult, A: Assumptions): number {
  const cases =
    driver === 'workflow' ? A.transitions[band] * (1 + A.invalidShare) : A.cases[driver][band];
  return (cases * (result.design + A.minutes[band] * result.execF) * (1 + A.overhead)) / 60;
}
