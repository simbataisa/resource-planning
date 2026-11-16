import type { Assumptions } from '@sit/schemas';
import { GROUPS, type GroupKey } from './catalogue.ts';
import type { GroupTotal, PtHours } from './types.ts';
import { sum3, type Band, type Triple } from './util.ts';

export interface EffortRates {
  /** Design minutes per functional case (after the AI-assist cut). */
  design: number;
  /** Validation design minutes per case (after the AI-assist cut). */
  valDesign: number;
  /** Execution factor for functional cases: cycles, regression, retest, environment. */
  exec: number;
  /** Execution factor for validation and mapping cases. */
  valExec: number;
  /** Execution factor for data cases. */
  dataExecF: number;
  aiCut: number;
  dOn: boolean;
  aOn: boolean;
  /** Feeds by complexity, for preparation hours. */
  feedByBand: Triple;
  iters: number;
  reviewShare: number;
  reuse: number;
  label: Partial<Record<string, number>>;
  pt: PtHours;
}

export interface EffortTotals {
  groups: Record<GroupKey, GroupTotal>;
  cases: number;
  hours: number;
  labelMinTotal: number;
}

/**
 * Cases are rounded per group and band, then minutes per group use that family's
 * rates; every group gets the overhead (prototype GROUPS.forEach loop).
 */
export function effort(A: Assumptions, g: Record<GroupKey, Triple>, r: EffortRates): EffortTotals {
  const groups = {} as Record<GroupKey, GroupTotal>;
  let cases = 0;
  let hours = 0;
  let labelMinTotal = 0;
  for (const G of GROUPS) {
    const k = G.key;
    const arr = g[k].map((x) => Math.max(0, Math.round(x))) as Triple;
    let min = 0;
    const lab = r.label[k];
    if (k === 'fieldFE' || k === 'fieldBE' || k === 'mapping') {
      min = sum3(arr) * (r.valDesign + (k === 'fieldFE' ? A.valExecUI : A.valExecAPI) * r.valExec);
    } else if (k === 'mobile') {
      arr.forEach((n, b) => {
        min +=
          n * (r.design * A.mobileDesignShare + A.minutes[b as 0 | 1 | 2] * r.exec * A.mobileExec);
      });
    } else if (k === 'dataPrep') {
      // Prototype order: Σ_b feeds[b] × hours[b], then × load cycles × 60 (ADR-0019).
      min = r.dOn
        ? r.feedByBand.reduce((t, n, b) => t + n * A.dataPrepHours[b as Band], 0) *
          A.dataCycles *
          60
        : 0;
    } else if (G.family === 'data' && k !== 'dataReport') {
      arr.forEach((n, b) => {
        min += n * (A.dataDesign[b as Band] * (1 - r.aiCut) + A.dataExec[b as Band] * r.dataExecF);
      });
    } else if (lab !== undefined) {
      const labMin = sum3(arr) * lab * (1 - r.reuse);
      labelMinTotal += labMin;
      min = labMin * A.qeLabelShare + sum3(arr) * r.iters * r.reviewShare * A.aiReviewMin;
    } else if (k === 'aiEval') {
      min = r.aOn ? r.iters * A.aiAnalysisHours * 60 : 0;
    } else if (k === 'ptDesign') {
      min = r.pt.design * 60;
    } else if (k === 'ptEnv') {
      min = r.pt.env * 60;
    } else if (k === 'ptRun') {
      min = r.pt.run * 60;
    } else {
      arr.forEach((n, b) => {
        min += n * (r.design + A.minutes[b as 0 | 1 | 2] * r.exec);
      });
    }
    const h = (min / 60) * (1 + A.overhead);
    groups[k] = { cases: sum3(arr), hours: h };
    cases += sum3(arr);
    hours += h;
  }
  return { groups, cases, hours, labelMinTotal };
}
