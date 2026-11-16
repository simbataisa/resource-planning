import { z } from 'zod';
import { Band3, Complexity, FIELD_TYPES, NonNeg, PT_TYPES, Percent, Size, keyed } from './common';

/** One line in rough mode: a feature of a given size, complexity and quantity. */
export const Feature = z.object({
  /** Free text. Synthetic or business names only, never personal data. */
  name: z.string().max(200),
  type: z.enum(['app', 'data', 'ai']).optional(),
  size: Size,
  cx: Complexity,
  qty: NonNeg,
  /** Performance-critical: adds performance scenarios in rough mode. */
  pt: z.boolean().optional(),
});
export type Feature = z.infer<typeof Feature>;

export const DataScope = z.object({
  feed: Band3,
  pipe: Band3,
  table: Band3,
  report: Band3,
  columns: Band3,
  dq: Band3,
  scd: NonNeg,
  secured: NonNeg,
  accessRoles: NonNeg,
});
export const AiScope = z.object({
  intent: Band3,
  ocr: Band3,
  rag: NonNeg,
  tools: NonNeg,
  guard: NonNeg,
  hitl: NonNeg,
});

/** Detailed mode: counts read from the FSD. */
export const DetailScope = z.object({
  api: Band3,
  screen: Band3,
  integration: Band3,
  rule: Band3,
  journey: Band3,
  batch: Band3,
  event: Band3,
  workflow: Band3,
  fields: NonNeg,
  data: DataScope,
  ai: AiScope,
  pt: z.object({ scen: Band3, dataHeavy: NonNeg }),
  reqFields: NonNeg,
  respFields: NonNeg,
  fieldTypes: keyed(FIELD_TYPES, NonNeg),
  roles: NonNeg,
  actions: NonNeg,
  approvals: NonNeg,
  critical: NonNeg,
  variants: NonNeg,
  languages: NonNeg,
});

export const Team = z.object({
  weeks: NonNeg,
  /** Percentages; the model normalises them if they do not add up to 100. */
  mix: z.object({ junior: NonNeg, mid: NonNeg, senior: NonNeg }),
  /** 0 dedicated · 1 mostly available · 2 shared, real downstream · 3 core-banking windows. */
  env: z.number().int().min(0).max(3),
  automation: Percent,
  /** AI assistance: 0 none · 1 pilot · 2 embedded. */
  ai: z.number().int().min(0).max(2),
  aiIters: z.number().min(1),
  aiSmes: z.number().min(1),
});
export type Team = z.infer<typeof Team>;

/** Shift-left evidence: what has been proven before SIT. */
export const Evidence = z.object({
  mutation: Percent,
  valBE: Percent,
  valFE: Percent,
  mapCov: Percent,
  jacoco: Percent,
  feUnit: Percent,
  feMut: Percent,
  ruleCov: Percent,
  iosUnit: Percent,
  androidUnit: Percent,
  dqCov: Percent,
  contractCov: Percent,
  goldenReuse: Percent,
  evalCI: z.boolean(),
  ptCI: z.boolean(),
  ptReuse: Percent,
  apm: z.boolean(),
});
export type Evidence = z.infer<typeof Evidence>;

/** Everything a user enters for one estimate (the prototype's "scope"). */
export const EstimateInputs = z.object({
  features: z.array(Feature).max(500),
  roughRoles: NonNeg,
  roughLanguages: NonNeg,
  roughVariants: NonNeg,
  channels: z.object({ web2: z.boolean(), ios: z.boolean(), android: z.boolean() }),
  a11y: z.boolean(),
  detail: DetailScope,
  team: Team,
  evidence: Evidence,
  includeL4: z.boolean(),
  ptTypes: keyed(PT_TYPES, z.boolean()),
});
export type EstimateInputs = z.infer<typeof EstimateInputs>;
export type DetailScope = z.infer<typeof DetailScope>;
export type DataScope = z.infer<typeof DataScope>;
export type AiScope = z.infer<typeof AiScope>;
