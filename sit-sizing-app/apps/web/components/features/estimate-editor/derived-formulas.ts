import type { Assumptions } from '@sit/schemas';
import type { GroupKey, ModeResult } from '@sit/engine';
import { formatFte as f1, formatInt as fmt, num1, pctS } from '@/lib/format';

type Values = Record<string, string | number>;
/** Translator for the `detailTab.derived.f` namespace. */
export type FormulaT = (key: string, values?: Values) => string;

const sum3 = (a: readonly number[]) => a[0]! + a[1]! + a[2]!;

/**
 * "How it is calculated" text per derived driver (prototype `renderDerived`), built from the
 * detailed result and the assumptions. Same rows, order, rounding and wording as the prototype.
 */
export function derivedFormulas(
  D: ModeResult,
  A: Assumptions,
  t: FormulaT,
): { group: GroupKey; text: string }[] {
  const c = D.counts;
  const x = D.explain;
  const rows: { group: GroupKey; text: string }[] = [];
  const push = (group: GroupKey, text: string) => rows.push({ group, text });
  const back = (state: string) =>
    state === 'partial' ? pctS(A.partialShare) : state === 'sample' ? '0%' : '100%';

  const ruleStd =
    D.rc === 'sample'
      ? t('ruleWiring', { w: A.wiringCases })
      : D.rc === 'partial'
        ? t('rulePartial', { p: pctS(A.partialShare) })
        : t('ruleFull');
  push(
    'rule',
    t('rule', {
      k: num1(x.crit),
      s: num1(x.std),
      std: ruleStd,
      v: x.vf.toFixed(2),
      m: x.mu.toFixed(2),
    }),
  );
  push('workflow', t('workflow', { w: num1(x.wfTot), t: num1(x.trTot), i: pctS(A.invalidShare) }));
  const fieldTxt = (state: string, sampleKey: string, base: number, each: number) =>
    state === 'sample'
      ? t(sampleKey, { n: num1(base), e: each })
      : t(x.typed ? 'fieldTyped' : 'fieldMix', {
          f: num1(c.fields),
          p: x.perField.toFixed(1),
          s: state === 'partial' ? pctS(A.partialShare) : '100%',
        });
  push('fieldFE', fieldTxt(D.fe, 'fieldFESample', sum3(c.screen), A.sampleFE));
  push(
    'fieldBE',
    D.be === 'sample'
      ? t('fieldBESample', { n: num1(x.apis), e: A.sampleBE })
      : t('fieldBE', {
          f: fmt(x.reqF),
          src: t(x.reqIn ? 'fromFsd' : 'estimated'),
          p: x.perField.toFixed(1),
          a: num1(x.apis),
          o: A.apiOnlyCases,
          s: D.be === 'partial' ? pctS(A.partialShare) : '100%',
        }),
  );
  push(
    'mapping',
    t('mapping', {
      f: fmt(x.respF),
      src: t(x.respIn ? 'fromFsd' : 'estimated'),
      m: A.mapPerField,
      fs: pctS(A.formatShare),
      s: back(D.mp),
    }),
  );
  push(
    'role',
    t('role', {
      a: num1(c.actions),
      t: num1(x.trTot),
      g: pctS(A.gatedShare),
      r: num1(c.roles),
      pp: A.roleCasesPerPair,
      sm: pctS(A.roleSampling),
    }),
  );
  push('sod', t('sod', { n: num1(c.approvals), c: A.sodCases }));
  push('channel', t('channel', { w: pctS(x.w2), l: c.languages, ls: pctS(A.languageShare) }));
  push(
    'mobile',
    x.mobOn.length
      ? t('mobile', {
          n: x.mobOn.length,
          d: pctS(x.devX),
          up: x.mobWeak.length
            ? ` × ${(1 + A.mobileUplift).toFixed(2)} (${x.mobWeak.join(', ')} ${t('belowUnitGate')})`
            : '',
          r: x.mobOn.length * A.releaseCases,
        })
      : t('noMobile'),
  );
  push(
    'a11y',
    c.a11y ? t('a11y', { s: num1(sum3(c.screen)), a: A.a11yCases, c: x.chOn }) : t('a11yOff'),
  );
  if (x.dOn) {
    const dd = c.data;
    const dqs =
      x.dqC === 'sample' ? pctS(A.dataSample) : x.dqC === 'partial' ? pctS(A.partialShare) : '100%';
    push(
      'dataSource',
      t('dataSource', {
        n: num1(x.feedTot),
        c: A.dFeed.join('/'),
        s:
          x.ctC === 'sample'
            ? t('oneCaseEach')
            : x.ctC === 'partial'
              ? pctS(A.partialShare)
              : '100%',
      }),
    );
    push('dataPipeline', t('dataPipeline', { n: num1(sum3(dd.pipe)), c: A.dPipe.join('/') }));
    push(
      'dataModel',
      t('dataModel', { n: num1(sum3(dd.table)), c: A.dTable.join('/'), d: dd.scd, e: A.dScd }),
    );
    push('dataMapping', t('dataMapping', { n: fmt(dd.columns), c: A.dCol, s: dqs }));
    push('dataQuality', t('dataQuality', { n: fmt(dd.dq), c: A.dDq, s: dqs }));
    push('dataReport', t('dataReport', { n: num1(sum3(dd.report)), c: A.dReport.join('/') }));
    push(
      'dataAccess',
      t('dataAccess', { d: dd.secured, r: dd.accessRoles, s: pctS(A.dAccessSampling) }),
    );
    push('dataPrep', t('dataPrep', { n: num1(x.feedTot), h: A.dataPrepHours, c: A.dataCycles }));
  }
  if (x.aOn) {
    const da = c.ai;
    push(
      'aiIntent',
      t('aiIntent', {
        n: num1(sum3(da.intent)),
        u: A.aiUtt.join('/'),
        l: x.langs,
        m: A.aiLabelUtt,
        r: pctS(x.reviewShare),
        i: x.iters,
      }),
    );
    push('aiRag', t('aiRag', { n: da.rag, q: A.aiRagQ, l: x.langs, m: A.aiLabelRag }));
    push(
      'aiOcr',
      t('aiOcr', { n: num1(sum3(da.ocr)), q: A.aiOcrSamples.join('/'), m: A.aiLabelOcr }),
    );
    push('aiGuard', t('aiGuard', { n: da.guard, q: A.aiAdv }));
    push('aiTool', t('aiTool', { n: da.tools, c: A.aiToolCases }));
    push('aiHitl', t('aiHitl', { n: da.hitl, c: A.aiHitlCases }));
    push('aiEval', t('aiEval', { i: x.iters, h: A.aiAnalysisHours }));
  }
  if (x.ptOn) {
    push(
      'ptDesign',
      t('ptDesign', {
        n: x.ptN,
        s: A.ptScript.join('/'),
        r: pctS(x.ptReuse),
        w: A.ptNfrFixed + A.ptNfrPer * x.ptN,
        d: A.ptDataFixed + A.ptDataPer * x.ptHeavy,
        h: f1(x.pt.design),
      }),
    );
    push(
      'ptEnv',
      t('ptEnv', {
        e: x.apm ? A.ptEnvApm : A.ptEnvHours,
        m: t(x.apm ? 'apmInPlace' : 'noApm'),
        mob: x.mobOn.length
          ? ` + ${x.mobOn.length} × ${A.ptMobileFixed} h ${t('mobileDeviceChecks')}`
          : '',
        h: f1(x.pt.env),
      }),
    );
    push(
      'ptRun',
      t('ptRun', {
        n: x.runN,
        r: f1(x.runH),
        c: x.ptCycles,
        a: pctS(A.ptAnalysis),
        p: A.ptReport,
        h: f1(x.pt.run),
      }),
    );
  }
  return rows;
}
