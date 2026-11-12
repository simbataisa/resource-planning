import type { BothResults, ModeResult } from './types.ts';

/** The subset of a mode result that is stored with a saved version (schemas ModeSummary). */
export function toSummary(r: ModeResult) {
  return {
    mode: r.mode,
    cases: r.cases,
    hours: r.hours,
    fte: r.fte,
    band: r.band,
    lo: r.lo,
    hi: r.hi,
    hpf: r.hpf,
    blended: r.blended,
    per: r.per,
    levels: r.levels,
    labelHours: r.labelHours,
    smeLabelHours: r.smeLabelHours,
    groups: r.groups,
  };
}

/** Stored form of both modes (schemas EstimateResult). */
export function toStoredResult(b: BothResults) {
  return {
    engineVersion: b.engineVersion,
    rough: toSummary(b.rough),
    detailed: toSummary(b.detailed),
  };
}
