import type { Assumptions } from '@sit/schemas';
import type { GroupKey } from './catalogue.ts';
import type { ModeResult } from './types.ts';
import { sum3 } from './util.ts';

export type ParamValue = number | string | boolean | readonly string[];

/** One "how it was derived" row: the numbers the UI puts into its translated formula text. */
export interface DerivedRow {
  group: GroupKey;
  cases: number;
  params: Record<string, ParamValue>;
}

/** Inputs to each formula row (prototype renderDerived), without any UI text. */
export function derivedRows(D: ModeResult, A: Assumptions): DerivedRow[] {
  const c = D.counts;
  const x = D.explain;
  const rows: [GroupKey, Record<string, ParamValue>][] = [];
  rows.push([
    'rule',
    {
      critical: x.crit,
      standard: x.std,
      credit: D.rc,
      wiringCases: A.wiringCases,
      partialShare: A.partialShare,
      variantFactor: x.vf,
      mutationFactor: x.mu,
    },
  ]);
  rows.push([
    'workflow',
    { workflows: x.wfTot, transitions: x.trTot, invalidShare: A.invalidShare },
  ]);
  rows.push([
    'fieldFE',
    {
      credit: D.fe,
      screens: sum3(c.screen),
      sampleCases: A.sampleFE,
      fields: c.fields,
      perField: x.perField,
      typed: x.typed,
      partialShare: A.partialShare,
    },
  ]);
  rows.push([
    'fieldBE',
    {
      credit: D.be,
      apis: x.apis,
      sampleCases: A.sampleBE,
      requestFields: x.reqF,
      fromFsd: x.reqIn,
      perField: x.perField,
      apiOnlyCases: A.apiOnlyCases,
      partialShare: A.partialShare,
    },
  ]);
  rows.push([
    'mapping',
    {
      credit: D.mp,
      responseFields: x.respF,
      fromFsd: x.respIn,
      perField: A.mapPerField,
      formatShare: A.formatShare,
      partialShare: A.partialShare,
    },
  ]);
  rows.push([
    'role',
    {
      actions: c.actions,
      transitions: x.trTot,
      gatedShare: A.gatedShare,
      roles: c.roles,
      casesPerPair: A.roleCasesPerPair,
      sampling: A.roleSampling,
    },
  ]);
  rows.push(['sod', { approvals: c.approvals, casesEach: A.sodCases }]);
  rows.push([
    'channel',
    { secondWebShare: x.w2, languages: c.languages, languageShare: A.languageShare },
  ]);
  rows.push([
    'mobile',
    {
      channels: x.mobOn,
      deviceExtra: x.devX,
      belowUnitGate: x.mobWeak,
      uplift: 1 + A.mobileUplift,
      releaseCases: x.mobOn.length * A.releaseCases,
    },
  ]);
  rows.push([
    'a11y',
    { on: c.a11y, screens: sum3(c.screen), casesEach: A.a11yCases, channels: x.chOn },
  ]);
  if (x.dOn) {
    const dd = c.data;
    rows.push([
      'dataSource',
      {
        feeds: x.feedTot,
        casesByComplexity: A.dFeed.join('/'),
        credit: x.ctC,
        partialShare: A.partialShare,
      },
    ]);
    rows.push(['dataPipeline', { pipelines: sum3(dd.pipe), casesByComplexity: A.dPipe.join('/') }]);
    rows.push([
      'dataModel',
      {
        tables: sum3(dd.table),
        casesByComplexity: A.dTable.join('/'),
        scd: dd.scd,
        scdCases: A.dScd,
      },
    ]);
    rows.push([
      'dataMapping',
      {
        columns: dd.columns,
        checksPerColumn: A.dCol,
        credit: x.dqC,
        sampleShare: A.dataSample,
        partialShare: A.partialShare,
      },
    ]);
    rows.push([
      'dataQuality',
      {
        rules: dd.dq,
        casesEach: A.dDq,
        credit: x.dqC,
        sampleShare: A.dataSample,
        partialShare: A.partialShare,
      },
    ]);
    rows.push(['dataReport', { reports: sum3(dd.report), casesByComplexity: A.dReport.join('/') }]);
    rows.push([
      'dataAccess',
      { securedDatasets: dd.secured, roles: dd.accessRoles, sampling: A.dAccessSampling },
    ]);
    rows.push([
      'dataPrep',
      { feeds: x.feedTot, hoursEach: A.dataPrepHours, loadCycles: A.dataCycles },
    ]);
  }
  if (x.aOn) {
    const da = c.ai;
    rows.push([
      'aiIntent',
      {
        intents: sum3(da.intent),
        utterancesByComplexity: A.aiUtt.join('/'),
        languages: x.langs,
        labelMinutes: A.aiLabelUtt,
        reviewShare: x.reviewShare,
        runs: x.iters,
      },
    ]);
    rows.push([
      'aiRag',
      { sources: da.rag, questionsEach: A.aiRagQ, languages: x.langs, labelMinutes: A.aiLabelRag },
    ]);
    rows.push([
      'aiOcr',
      {
        documentTypes: sum3(da.ocr),
        samplesByComplexity: A.aiOcrSamples.join('/'),
        labelMinutes: A.aiLabelOcr,
      },
    ]);
    rows.push(['aiGuard', { categories: da.guard, promptsEach: A.aiAdv }]);
    rows.push(['aiTool', { tools: da.tools, casesEach: A.aiToolCases }]);
    rows.push(['aiHitl', { steps: da.hitl, casesEach: A.aiHitlCases }]);
    rows.push(['aiEval', { runs: x.iters, analysisHours: A.aiAnalysisHours }]);
  }
  if (x.ptOn) {
    rows.push([
      'ptDesign',
      {
        scenarios: x.ptN,
        scriptHoursByComplexity: A.ptScript.join('/'),
        reuse: x.ptReuse,
        workloadModelHours: A.ptNfrFixed + A.ptNfrPer * x.ptN,
        testDataHours: A.ptDataFixed + A.ptDataPer * x.ptHeavy,
        hours: x.pt.design,
      },
    ]);
    rows.push([
      'ptEnv',
      {
        setupHours: x.apm ? A.ptEnvApm : A.ptEnvHours,
        apm: x.apm,
        mobileChannels: x.mobOn.length,
        mobileHoursEach: A.ptMobileFixed,
        hours: x.pt.env,
      },
    ]);
    rows.push([
      'ptRun',
      {
        runs: x.runN,
        hoursPerCycle: x.runH,
        cycles: x.ptCycles,
        analysisShare: A.ptAnalysis,
        reportHours: A.ptReport,
        hours: x.pt.run,
      },
    ]);
  }
  return rows.map(([group, params]) => ({ group, cases: D.groups[group].cases, params }));
}
