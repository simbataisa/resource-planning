import { z } from 'zod';
import { Band3, FIELD_TYPES, NonNeg, PT_TYPES, SizeName, keyed } from './common';

/**
 * Model assumptions (the prototype's DEFAULTS). The UI shows them as calibratable rows:
 * 130 fixed rows plus 3 per feature size, 160 with the ten built-in sizes (design 7, ADR-0021). Field names follow the prototype so
 * profiles exported from the HTML tool import without mapping.
 */
const ProxyApp = z.object({
  screen: NonNeg,
  field: NonNeg,
  api: NonNeg,
  integration: NonNeg,
  rule: NonNeg,
  journey: NonNeg,
  batch: NonNeg,
  event: NonNeg,
  workflow: NonNeg,
  actions: NonNeg,
});
const ProxyData = z.object({
  feed: NonNeg,
  pipe: NonNeg,
  table: NonNeg,
  report: NonNeg,
  columns: NonNeg,
  dq: NonNeg,
  scd: NonNeg,
  secured: NonNeg,
});
const ProxyAi = z.object({
  intent: NonNeg,
  ocr: NonNeg,
  rag: NonNeg,
  tools: NonNeg,
  guard: NonNeg,
  hitl: NonNeg,
});
/** A size table: one entry per size in `sizes` (checked on Assumptions). */
const bySize = <T extends z.ZodType>(v: T) => z.record(SizeName, v);

/** Where a calibrated value came from (P-01). */
export const CalibrationEntry = z.object({
  source: z.string().max(200),
  measuredAt: z.iso.date().optional(),
  note: z.string().max(1000).optional(),
});

/** The tables keyed by size; their keys must equal `sizes`. */
export const SIZE_TABLES = ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const;
export const MAX_SIZES = 20;

export const FieldTypeRate = z.object({
  /** Matrix cases for one field of this type. */
  cases: NonNeg,
  /** Share (%) of this type in a typical screen, used when fields are not typed. */
  mix: NonNeg,
});

export const Assumptions = z.object({
  cases: z.object({
    api: Band3,
    screen: Band3,
    integration: Band3,
    rule: Band3,
    journey: Band3,
    batch: Band3,
    event: Band3,
  }),
  ftypes: keyed(FIELD_TYPES, FieldTypeRate),
  sampleFE: NonNeg,
  sampleBE: NonNeg,
  partialShare: NonNeg,
  valDesign: NonNeg,
  valExecUI: NonNeg,
  valExecAPI: NonNeg,
  valCycles: NonNeg,
  roleCasesPerPair: NonNeg,
  roleSampling: NonNeg,
  channelShares: z.object({ web2: NonNeg, ios: NonNeg, android: NonNeg }),
  languageShare: NonNeg,
  deviceCombos: NonNeg,
  deviceExtra: NonNeg,
  mobileCases: Band3,
  releaseCases: NonNeg,
  mobileExec: NonNeg,
  mobileDesignShare: NonNeg,
  a11yCases: NonNeg,
  mobileUnitGate: NonNeg,
  mobileUplift: NonNeg,
  envFactor: z.tuple([NonNeg, NonNeg, NonNeg, NonNeg]),
  mutationGate: NonNeg,
  ruleUplift: NonNeg,
  retestWeak: NonNeg,
  transitions: Band3,
  invalidShare: NonNeg,
  gatedShare: NonNeg,
  sodCases: NonNeg,
  roughApprovalShare: NonNeg,
  criticalShare: NonNeg,
  wiringCases: NonNeg,
  variantShare: NonNeg,
  variantSampling: NonNeg,
  reqFields: Band3,
  respFields: Band3,
  dtoReuse: NonNeg,
  eventFields: NonNeg,
  apiOnlyCases: NonNeg,
  mapPerField: NonNeg,
  formatShare: NonNeg,
  feUnitGate: NonNeg,
  feLogicUplift: NonNeg,
  feMutGate: NonNeg,
  feMutUplift: NonNeg,
  minutes: Band3,
  designFSD: NonNeg,
  designNoFSD: NonNeg,
  cycles: NonNeg,
  regression: NonNeg,
  retest: NonNeg,
  overhead: NonNeg,
  aiDesignCut: Band3,
  dproxies: bySize(ProxyData),
  ptScript: Band3,
  ptNfrFixed: NonNeg,
  ptNfrPer: NonNeg,
  ptDataFixed: NonNeg,
  ptDataPer: NonNeg,
  ptEnvHours: NonNeg,
  ptEnvApm: NonNeg,
  ptMobileFixed: NonNeg,
  ptRuns: keyed(PT_TYPES, NonNeg),
  ptRunHours: keyed(PT_TYPES, NonNeg),
  ptCycles: NonNeg,
  ptCyclesCI: NonNeg,
  ptAnalysis: NonNeg,
  ptReport: NonNeg,
  ptRoughScen: bySize(NonNeg),
  ptEnvDays: NonNeg,
  aproxies: bySize(ProxyAi),
  dFeed: Band3,
  dPipe: Band3,
  dTable: Band3,
  dScd: NonNeg,
  dCol: NonNeg,
  dDq: NonNeg,
  dReport: Band3,
  dAccessSampling: NonNeg,
  dataSample: NonNeg,
  dataDesign: Band3,
  dataExec: Band3,
  dataCycles: NonNeg,
  dataPrepHours: Band3,
  dataDaysPerCycle: NonNeg,
  aiUtt: Band3,
  aiRagQ: NonNeg,
  aiOcrSamples: Band3,
  aiAdv: NonNeg,
  aiToolCases: NonNeg,
  aiHitlCases: NonNeg,
  aiLabelUtt: NonNeg,
  aiLabelRag: NonNeg,
  aiLabelOcr: NonNeg,
  aiLabelAdv: NonNeg,
  aiReviewAuto: NonNeg,
  aiReviewManual: NonNeg,
  aiReviewMin: NonNeg,
  aiAnalysisHours: NonNeg,
  qeLabelShare: NonNeg,
  hoursPerDay: NonNeg,
  daysPerWeek: NonNeg,
  capacity: Band3,
  band: z.object({ rough: NonNeg, detailed: NonNeg }),
  proxies: bySize(ProxyApp),
  /** Feature sizes in display order (ADR-0021). Profiles can add, rename and remove sizes. */
  sizes: z.array(SizeName).min(1).max(MAX_SIZES),
  /**
   * Calibration notes for custom-size rows, copied from the profile when it is applied, so an
   * estimate counts those rows as its profile does (ADR-0021).
   */
  sizeNotes: z.record(z.string().max(80), CalibrationEntry).default({}),
}).superRefine((a, ctx) => {
  if (new Set(a.sizes).size !== a.sizes.length)
    ctx.addIssue({ code: 'custom', path: ['sizes'], message: 'Each size name must be unique.' });
  const want = [...a.sizes].sort().join('\u0000');
  for (const t of SIZE_TABLES)
    if (Object.keys(a[t]).sort().join('\u0000') !== want)
      ctx.addIssue({ code: 'custom', path: [t], message: 'The table must have one entry per size.' });
});
export type Assumptions = z.infer<typeof Assumptions>;
