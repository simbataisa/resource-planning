import type { Assumptions, EstimateInputs, Evidence } from '@sit/schemas';
import { aiGroups, labelMinutes } from './ai-product.ts';
import { applicationGroups, frontendUplift } from './application.ts';
import { capacity } from './capacity.ts';
import type { GroupKey } from './catalogue.ts';
import { channelGroups } from './channels.ts';
import type { Ctx } from './context.ts';
import { counts, fieldProfile } from './counts.ts';
import { credit } from './credit.ts';
import { dataGroups } from './data-platform.ts';
import { effort } from './effort.ts';
import { mappingGroup } from './mapping.ts';
import { performance } from './performance.ts';
import { ruleGroup } from './rules.ts';
import type { BothResults, Mode, ModeResult } from './types.ts';
import { num, raw, sum3, type Triple } from './util.ts';
import { apiFields, validationGroups } from './validation.ts';
import { workflowRoleGroups } from './workflow-roles.ts';
import { ENGINE_VERSION } from './version.ts';

/**
 * One estimate in one mode (prototype `compute(mode, A, S, E)`).
 * `evidenceOverride` replaces the estimate's evidence as a whole, as the prototype's
 * scenarios do; a few values (PT reuse, APM) are still read from the estimate.
 */
export function compute(
  mode: Mode,
  inputs: EstimateInputs,
  assumptions: Assumptions,
  evidenceOverride?: Partial<Evidence>,
): ModeResult {
  const A = assumptions;
  const S = inputs;
  const E: Partial<Evidence> = evidenceOverride ?? S.evidence;
  const c = counts(mode, A, S);
  const mutOK = raw(E.mutation) >= A.mutationGate;
  const retest = mutOK ? A.retest : A.retestWeak;
  const aiI = Math.min(2, Math.max(0, num(S.team.ai)));
  const aiCut = A.aiDesignCut[aiI as 0 | 1 | 2] || 0;
  const design = (mode === 'rough' ? A.designNoFSD : A.designFSD) * (1 - aiCut);
  const valDesign = A.valDesign * (1 - aiCut);
  const fe = credit(raw(E.valFE));
  const be = credit(raw(E.valBE));
  const mp = credit(num(E.mapCov));
  const rc = credit(num(E.ruleCov));

  const fp = fieldProfile(mode, A, S);
  if (fp.typed && fp.count !== null) c.fields = fp.count;
  const ctx: Ctx = { mode, A, S, E, c, fp };

  const fields = apiFields(ctx);
  const front = frontendUplift(A, E);
  const app = applicationGroups(ctx, front.feUp);
  const rules = ruleGroup(ctx, rc, mutOK);
  const wf = workflowRoleGroups(ctx);
  const ch = channelGroups(ctx, app.screen, app.journey);
  const val = validationGroups(ctx, fe, be, fields);
  const mapping = mappingGroup(ctx, mp, fields.respF);
  const data = dataGroups(ctx);
  const ai = aiGroups(ctx);
  const perf = performance(ctx, ch.mobOn.length);

  const envI = Math.min(3, Math.max(0, num(S.team.env)));
  const env = A.envFactor[envI as 0 | 1 | 2 | 3];
  const auto = Math.min(100, Math.max(0, num(S.team.automation))) / 100;
  const exec = (A.cycles + A.regression * (1 - auto)) * (1 + retest) * env;
  const valExec = A.valCycles * (1 + retest) * env;
  const dataExecF = A.dataCycles * (1 + retest) * env;

  const g: Record<GroupKey, Triple> = {
    api: app.api,
    screen: app.screen,
    integration: app.integration,
    rule: rules.rule,
    workflow: wf.workflow,
    batch: app.batch,
    event: app.event,
    journey: app.journey,
    fieldFE: val.fieldFE,
    fieldBE: val.fieldBE,
    mapping,
    role: wf.role,
    sod: wf.sod,
    channel: ch.channel,
    mobile: ch.mobile,
    a11y: ch.a11y,
    dataSource: data.dataSource,
    dataPipeline: data.dataPipeline,
    dataModel: data.dataModel,
    dataMapping: data.dataMapping,
    dataQuality: data.dataQuality,
    dataReport: data.dataReport,
    dataAccess: data.dataAccess,
    dataPrep: data.dataPrep,
    aiIntent: ai.aiIntent,
    aiRag: ai.aiRag,
    aiOcr: ai.aiOcr,
    aiGuard: ai.aiGuard,
    aiTool: ai.aiTool,
    aiHitl: ai.aiHitl,
    aiEval: ai.aiEval,
    ptDesign: perf.ptDesign,
    ptEnv: perf.ptEnv,
    ptRun: perf.ptRun,
  };

  const totals = effort(A, g, {
    design,
    valDesign,
    exec,
    valExec,
    dataExecF,
    aiCut,
    dOn: data.dOn,
    aOn: ai.aOn,
    feedTot: data.feedTot,
    iters: ai.iters,
    reviewShare: ai.reviewShare,
    reuse: ai.reuse,
    label: labelMinutes(A),
    pt: perf.pt,
  });
  const cap = capacity(mode, A, S, totals.hours);

  return {
    mode,
    counts: c,
    groups: totals.groups,
    cases: totals.cases,
    hours: totals.hours,
    mutOK,
    retest,
    fe,
    be,
    env,
    envI,
    auto,
    mp,
    rc,
    feUnitOK: front.feUnitOK,
    feMutOK: front.feMutOK,
    execF: exec,
    design,
    aiI,
    aiCut,
    explain: {
      rTot: rules.rTot,
      crit: rules.crit,
      std: rules.rTot - rules.crit,
      vf: rules.vf,
      mu: rules.mu,
      trTot: wf.trTot,
      wfTot: sum3(c.workflow),
      guarded: wf.guarded,
      feUp: front.feUp,
      perField: fp.per,
      typed: fp.typed,
      reqF: fields.reqF,
      respF: fields.respF,
      reqIn: fields.reqIn,
      respIn: fields.respIn,
      apis: fields.apis,
      mobOn: ch.mobOn,
      mobWeak: ch.mobWeak,
      chOn: ch.chOn,
      devX: ch.devX,
      w2: ch.w2,
      xl: ch.xl,
      dOn: data.dOn,
      aOn: ai.aOn,
      dqC: data.dqC,
      ctC: data.ctC,
      feedTot: data.feedTot,
      iters: ai.iters,
      reviewShare: ai.reviewShare,
      evalCI: ai.evalCI,
      reuse: ai.reuse,
      ptOn: perf.ptOn,
      ptN: perf.ptN,
      ptSc: perf.ptSc,
      ptHeavy: perf.ptHeavy,
      ptCI: perf.ptCI,
      ptReuse: perf.ptReuse,
      apm: perf.apm,
      runH: perf.runH,
      runN: perf.runN,
      ptCycles: perf.ptCycles,
      pt: perf.pt,
      langs: ai.langs,
      dataExecF,
    },
    labelHours: (totals.labelMinTotal / 60) * (1 + A.overhead),
    smeLabelHours: (totals.labelMinTotal / 60) * (1 - A.qeLabelShare),
    ...cap,
  };
}

/** Both modes for one estimate, stamped with the engine version. */
export function computeBoth(inputs: EstimateInputs, assumptions: Assumptions): BothResults {
  return {
    engineVersion: ENGINE_VERSION,
    rough: compute('rough', inputs, assumptions),
    detailed: compute('detailed', inputs, assumptions),
  };
}
