import { GROUPS, type GroupKey } from './catalogue.ts';
import type { BothResults } from './types.ts';

export interface GapRow {
  group: GroupKey;
  roughCases: number;
  detailedCases: number;
  deltaCases: number;
  deltaHours: number;
  /** Share (%) of the total hours gap, rounded (prototype renderGap). */
  share: number;
}

/** Rough vs detailed by group; groups with no cases and no hours in either mode are left out. */
export function gapRows(result: BothResults): GapRow[] {
  const { rough: R, detailed: D } = result;
  const totH = D.hours - R.hours;
  return GROUPS.filter((G) => {
    const r = R.groups[G.key];
    const d = D.groups[G.key];
    return r.cases || d.cases || r.hours > 0.01 || d.hours > 0.01;
  }).map((G) => {
    const r = R.groups[G.key];
    const d = D.groups[G.key];
    const dh = d.hours - r.hours;
    return {
      group: G.key,
      roughCases: r.cases,
      detailedCases: d.cases,
      deltaCases: d.cases - r.cases,
      deltaHours: dh,
      share: Math.abs(totH) > 1e-6 ? Math.round((dh / totH) * 100) : 0,
    };
  });
}

/** The group that explains most of the hours gap, or null when the modes agree (prototype topGap). */
export function topGap(
  result: BothResults,
): { group: GroupKey; deltaHours: number; share: number } | null {
  const { rough: R, detailed: D } = result;
  const tot = D.hours - R.hours;
  if (Math.abs(tot) < 1e-6) return null;
  let best = {
    group: GROUPS[0].key as GroupKey,
    deltaHours: D.groups[GROUPS[0].key].hours - R.groups[GROUPS[0].key].hours,
  };
  for (const G of GROUPS) {
    const d = D.groups[G.key].hours - R.groups[G.key].hours;
    if (Math.abs(d) > Math.abs(best.deltaHours)) best = { group: G.key, deltaHours: d };
  }
  return { ...best, share: Math.round((best.deltaHours / tot) * 100) };
}
