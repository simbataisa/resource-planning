import type { Credit } from './credit.ts';
import type { GroupKey } from './catalogue.ts';
import type { Triple } from './util.ts';

export type Mode = 'rough' | 'detailed';

/** Driver counts after rough expansion or as entered in detailed mode (prototype `c`). */
export interface Counts {
  api: Triple;
  screen: Triple;
  integration: Triple;
  rule: Triple;
  workflow: Triple;
  batch: Triple;
  event: Triple;
  journey: Triple;
  fields: number;
  roles: number;
  actions: number;
  languages: number;
  critical: number;
  variants: number;
  approvals: number;
  ch: { web2?: boolean; ios?: boolean; android?: boolean };
  a11y: boolean;
  data: {
    feed: Triple;
    pipe: Triple;
    table: Triple;
    report: Triple;
    columns: number;
    dq: number;
    scd: number;
    secured: number;
    accessRoles: number;
  };
  ai: { intent: Triple; ocr: Triple; rag: number; tools: number; guard: number; hitl: number };
}

export interface PtHours {
  design: number;
  env: number;
  run: number;
}

/** Intermediate values the UI shows in "how it was derived" (prototype `x`). */
export interface Explain {
  rTot: number;
  crit: number;
  std: number;
  vf: number;
  mu: number;
  trTot: number;
  wfTot: number;
  guarded: number;
  feUp: number;
  perField: number;
  typed: boolean;
  reqF: number;
  respF: number;
  reqIn: boolean;
  respIn: boolean;
  apis: number;
  mobOn: ('ios' | 'android')[];
  mobWeak: ('ios' | 'android')[];
  chOn: number;
  devX: number;
  w2: number;
  xl: number;
  dOn: boolean;
  aOn: boolean;
  dqC: Credit;
  ctC: Credit;
  feedTot: number;
  iters: number;
  reviewShare: number;
  evalCI: boolean;
  reuse: number;
  ptOn: boolean;
  ptN: number;
  ptSc: Triple;
  ptHeavy: number;
  ptCI: boolean;
  ptReuse: number;
  apm: boolean;
  runH: number;
  runN: number;
  ptCycles: number;
  pt: PtHours;
  langs: number;
  dataExecF: number;
}

export interface GroupTotal {
  cases: number;
  hours: number;
}

/** Full result for one mode (prototype `compute()` output). */
export interface ModeResult {
  mode: Mode;
  counts: Counts;
  groups: Record<GroupKey, GroupTotal>;
  cases: number;
  hours: number;
  mutOK: boolean;
  retest: number;
  fe: Credit;
  be: Credit;
  mp: Credit;
  rc: Credit;
  env: number;
  envI: number;
  auto: number;
  feUnitOK: boolean;
  feMutOK: boolean;
  execF: number;
  design: number;
  aiI: number;
  aiCut: number;
  explain: Explain;
  labelHours: number;
  smeLabelHours: number;
  hpf: number;
  blended: number;
  per: number;
  fte: number;
  band: number;
  lo: number;
  hi: number;
  levels: Triple;
}

export interface BothResults {
  engineVersion: string;
  rough: ModeResult;
  detailed: ModeResult;
}
