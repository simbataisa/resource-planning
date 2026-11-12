import { z } from 'zod';
import { keyed } from './common';

export const MODES = ['rough', 'detailed'] as const;
export const Mode = z.enum(MODES);
export type Mode = z.infer<typeof Mode>;

/** The 34 driver groups, in display order (prototype GROUPS). */
export const GROUP_KEYS = [
  'api',
  'screen',
  'integration',
  'rule',
  'workflow',
  'batch',
  'event',
  'journey',
  'fieldFE',
  'fieldBE',
  'mapping',
  'role',
  'sod',
  'channel',
  'mobile',
  'a11y',
  'dataSource',
  'dataPipeline',
  'dataModel',
  'dataMapping',
  'dataQuality',
  'dataReport',
  'dataAccess',
  'dataPrep',
  'aiIntent',
  'aiRag',
  'aiOcr',
  'aiGuard',
  'aiTool',
  'aiHitl',
  'aiEval',
  'ptDesign',
  'ptEnv',
  'ptRun',
] as const;
export const GroupKey = z.enum(GROUP_KEYS);
export type GroupKey = z.infer<typeof GroupKey>;

export const GroupResult = z.object({ cases: z.number().int().min(0), hours: z.number().min(0) });

/** Numbers stored with every saved version (design 5, 6.6). */
export const ModeSummary = z.object({
  mode: Mode,
  cases: z.number().int().min(0),
  hours: z.number().min(0),
  fte: z.number().min(0),
  band: z.number().min(0),
  lo: z.number(),
  hi: z.number(),
  hpf: z.number().min(0),
  blended: z.number().min(0),
  per: z.number().min(0),
  levels: z.tuple([z.number(), z.number(), z.number()]),
  labelHours: z.number().min(0),
  smeLabelHours: z.number().min(0),
  /** Every group, always present (an object with named properties documents better than a record). */
  groups: keyed(GROUP_KEYS, GroupResult),
});
export type ModeSummary = z.infer<typeof ModeSummary>;

export const EstimateResult = z.object({
  engineVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  rough: ModeSummary,
  detailed: ModeSummary,
});
export type EstimateResult = z.infer<typeof EstimateResult>;
