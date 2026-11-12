import type { Assumptions, EstimateInputs } from '@sit/schemas';
import type { Mode } from './types.ts';
import { num, type Triple } from './util.ts';

/** Hours per FTE, blended capacity, FTE, range and the split by level. */
export function capacity(mode: Mode, A: Assumptions, S: EstimateInputs, hours: number) {
  const mix = S.team.mix;
  const tot = num(mix.junior) + num(mix.mid) + num(mix.senior);
  const blended =
    tot > 0
      ? (num(mix.junior) * A.capacity[0] +
          num(mix.mid) * A.capacity[1] +
          num(mix.senior) * A.capacity[2]) /
        tot
      : 0;
  const hpf = num(S.team.weeks) * A.daysPerWeek * A.hoursPerDay;
  const per = hpf * blended;
  const fte = per > 0 ? hours / per : 0;
  const band = mode === 'rough' ? A.band.rough : A.band.detailed;
  const levels: Triple =
    tot > 0
      ? [(mix.junior / tot) * fte, (mix.mid / tot) * fte, (mix.senior / tot) * fte]
      : [0, 0, 0];
  return { hpf, blended, per, fte, band, lo: fte * (1 - band), hi: fte * (1 + band), levels };
}
