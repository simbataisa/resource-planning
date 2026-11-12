import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { FIELD_TYPES, PT_TYPES, SIZES } from './catalogue.ts';
import { compute } from './compute.ts';
import type { Mode } from './types.ts';
import { clone, type Triple } from './util.ts';

type Mutator = (A: Assumptions, k: number) => void;
const scale = (a: Triple, k: number): Triple => [a[0] * k, a[1] * k, a[2] * k];

/**
 * Assumptions moved in the tornado chart (prototype SENS, same order).
 * `roughOnly` rows only affect rough mode. Labels are in the web app's messages
 * under `sensitivity.<key>`.
 */
export const SENSITIVITY_ITEMS: readonly { key: string; roughOnly?: true; apply: Mutator }[] = [
  {
    key: 'casesIntegration',
    apply: (A, k) => {
      A.cases.integration = scale(A.cases.integration, k);
    },
  },
  {
    key: 'casesApi',
    apply: (A, k) => {
      A.cases.api = scale(A.cases.api, k);
    },
  },
  {
    key: 'casesScreen',
    apply: (A, k) => {
      A.cases.screen = scale(A.cases.screen, k);
    },
  },
  {
    key: 'casesRule',
    apply: (A, k) => {
      A.cases.rule = scale(A.cases.rule, k);
    },
  },
  {
    key: 'criticalShare',
    roughOnly: true,
    apply: (A, k) => {
      A.criticalShare = Math.min(1, A.criticalShare * k);
    },
  },
  {
    key: 'variantSampling',
    apply: (A, k) => {
      A.variantSampling = Math.min(1, A.variantSampling * k);
    },
  },
  {
    key: 'transitions',
    apply: (A, k) => {
      A.transitions = scale(A.transitions, k);
    },
  },
  {
    key: 'gatedShare',
    apply: (A, k) => {
      A.gatedShare = Math.min(1, A.gatedShare * k);
    },
  },
  {
    key: 'casesJourney',
    apply: (A, k) => {
      A.cases.journey = scale(A.cases.journey, k);
    },
  },
  {
    key: 'casesBatch',
    apply: (A, k) => {
      A.cases.batch = scale(A.cases.batch, k);
    },
  },
  {
    key: 'casesEvent',
    apply: (A, k) => {
      A.cases.event = scale(A.cases.event, k);
    },
  },
  {
    key: 'channelShares',
    apply: (A, k) => {
      for (const x of ['ios', 'android', 'web2'] as const)
        A.channelShares[x] = Math.min(1, A.channelShares[x] * k);
    },
  },
  {
    key: 'mobileCases',
    apply: (A, k) => {
      A.mobileCases = scale(A.mobileCases, k);
    },
  },
  {
    key: 'deviceExtra',
    apply: (A, k) => {
      A.deviceExtra *= k;
    },
  },
  {
    key: 'mobileExec',
    apply: (A, k) => {
      A.mobileExec = 1 + (A.mobileExec - 1) * k;
    },
  },
  {
    key: 'languageShare',
    apply: (A, k) => {
      A.languageShare *= k;
    },
  },
  {
    key: 'envFactor',
    apply: (A, k) => {
      A.envFactor = A.envFactor.map((x) => x * k) as Assumptions['envFactor'];
    },
  },
  {
    key: 'fieldTypeCases',
    apply: (A, k) => {
      for (const t of FIELD_TYPES) A.ftypes[t].cases *= k;
    },
  },
  {
    key: 'reqFields',
    apply: (A, k) => {
      A.reqFields = scale(A.reqFields, k);
    },
  },
  {
    key: 'respFields',
    apply: (A, k) => {
      A.respFields = scale(A.respFields, k);
    },
  },
  {
    key: 'validationExec',
    apply: (A, k) => {
      A.valExecUI *= k;
      A.valExecAPI *= k;
    },
  },
  {
    key: 'roleSampling',
    apply: (A, k) => {
      A.roleSampling *= k;
    },
  },
  {
    key: 'minutes',
    apply: (A, k) => {
      A.minutes = scale(A.minutes, k);
    },
  },
  {
    key: 'designMinutes',
    apply: (A, k) => {
      A.designFSD *= k;
      A.designNoFSD *= k;
    },
  },
  {
    key: 'cycles',
    apply: (A, k) => {
      A.cycles *= k;
    },
  },
  {
    key: 'retest',
    apply: (A, k) => {
      A.retest *= k;
      A.retestWeak *= k;
    },
  },
  {
    key: 'overhead',
    apply: (A, k) => {
      A.overhead *= k;
    },
  },
  {
    key: 'aiDesignCut',
    apply: (A, k) => {
      A.aiDesignCut = A.aiDesignCut.map((x) => Math.min(0.9, x * k)) as Triple;
    },
  },
  {
    key: 'hoursPerDay',
    apply: (A, k) => {
      A.hoursPerDay *= k;
    },
  },
  {
    key: 'capacity',
    apply: (A, k) => {
      A.capacity = scale(A.capacity, k);
    },
  },
  {
    key: 'dataMinutes',
    apply: (A, k) => {
      A.dataDesign *= k;
      A.dataExec *= k;
    },
  },
  {
    key: 'dCol',
    apply: (A, k) => {
      A.dCol *= k;
    },
  },
  {
    key: 'dataCycles',
    apply: (A, k) => {
      A.dataCycles *= k;
    },
  },
  {
    key: 'aiUtt',
    apply: (A, k) => {
      A.aiUtt = scale(A.aiUtt, k);
    },
  },
  {
    key: 'aiOcrSamples',
    apply: (A, k) => {
      A.aiOcrSamples = scale(A.aiOcrSamples, k);
    },
  },
  {
    key: 'labelMinutes',
    apply: (A, k) => {
      A.aiLabelUtt *= k;
      A.aiLabelRag *= k;
      A.aiLabelOcr *= k;
      A.aiLabelAdv *= k;
    },
  },
  {
    key: 'reviewShare',
    apply: (A, k) => {
      A.aiReviewAuto = Math.min(1, A.aiReviewAuto * k);
      A.aiReviewManual = Math.min(1, A.aiReviewManual * k);
    },
  },
  {
    key: 'ptScript',
    apply: (A, k) => {
      A.ptScript = scale(A.ptScript, k);
    },
  },
  {
    key: 'ptCycles',
    apply: (A, k) => {
      A.ptCycles *= k;
      A.ptCyclesCI *= k;
    },
  },
  {
    key: 'ptRunHours',
    apply: (A, k) => {
      for (const t of PT_TYPES) A.ptRunHours[t] *= k;
    },
  },
  {
    key: 'ptAnalysis',
    apply: (A, k) => {
      A.ptAnalysis *= k;
    },
  },
  {
    key: 'proxies',
    roughOnly: true,
    apply: (A, k) => {
      for (const s of SIZES) {
        const p = A.proxies[s];
        for (const x of Object.keys(p) as (keyof typeof p)[]) p[x] *= k;
      }
    },
  },
];

export interface SensitivityRow {
  key: string;
  lo: number;
  hi: number;
  span: number;
}

/**
 * Tornado analysis: each assumption moved by ±swing with everything else fixed.
 * Rows with no effect are dropped; the rest are sorted by span, largest first.
 */
export function sensitivity(
  mode: Mode,
  inputs: EstimateInputs,
  assumptions: Assumptions,
  swing: number,
) {
  const base = compute(mode, inputs, assumptions).fte;
  const rows: SensitivityRow[] = SENSITIVITY_ITEMS.filter((s) => !(s.roughOnly && mode !== 'rough'))
    .map((s) => {
      const a1 = clone(assumptions);
      const a2 = clone(assumptions);
      s.apply(a1, 1 - swing);
      s.apply(a2, 1 + swing);
      const v1 = compute(mode, inputs, a1).fte;
      const v2 = compute(mode, inputs, a2).fte;
      return { key: s.key, lo: Math.min(v1, v2), hi: Math.max(v1, v2), span: Math.abs(v2 - v1) };
    })
    .filter((x) => x.span > 1e-6)
    .sort((a, b) => b.span - a.span);
  return { base, rows };
}
