import { PT_TYPES } from './catalogue.ts';
import type { Ctx } from './context.ts';
import type { PtHours } from './types.ts';
import { dot3, num, sum3, zero3, type Band, type Triple } from './util.ts';

/** Performance testing: scenarios, scripting, workload model, data, environment, runs and cycles (hours). */
export function performance(ctx: Ctx, mobileChannels: number) {
  const { A, S, E, mode } = ctx;
  let ptSc: Triple = [0, 0, 0];
  let ptHeavy = 0;
  if (mode === 'rough') {
    for (const f of S.features) {
      if (!f.pt) continue;
      const n = (A.ptRoughScen[f.size] || 0) * num(f.qty);
      ptSc[num(f.cx) as Band] += n;
      if (f.type === 'data' || f.type === 'ai') ptHeavy += n;
    }
  } else {
    const dp = S.detail.pt ?? { scen: zero3(), dataHeavy: 0 };
    ptSc = (dp.scen ?? zero3()).map((v) => num(v)) as Triple;
    ptHeavy = num(dp.dataHeavy);
  }
  const ptN = sum3(ptSc);
  const ptOn = ptN > 0;
  const ptCI = E.ptCI !== undefined ? !!E.ptCI : !!S.evidence.ptCI;
  // Prototype reads reuse and APM from the estimate's own evidence, not the scenario override.
  const ptReuse = Math.min(100, Math.max(0, num(S.evidence.ptReuse))) / 100;
  const apm = !!S.evidence.apm;
  let runH = 0;
  let runN = 0;
  for (const t of PT_TYPES) {
    if (S.ptTypes?.[t]) {
      runH += A.ptRuns[t] * A.ptRunHours[t];
      runN += A.ptRuns[t];
    }
  }
  const ptCycles = ptCI ? A.ptCyclesCI : A.ptCycles;
  const ptExec = runH * ptCycles;
  const pt: PtHours = ptOn
    ? {
        design:
          dot3(ptSc, A.ptScript) * (1 - ptReuse) +
          A.ptNfrFixed +
          A.ptNfrPer * ptN +
          A.ptDataFixed +
          A.ptDataPer * ptHeavy,
        env: (apm ? A.ptEnvApm : A.ptEnvHours) + mobileChannels * A.ptMobileFixed,
        run: ptExec * (1 + A.ptAnalysis) + A.ptReport,
      }
    : { design: 0, env: 0, run: 0 };
  return {
    pt,
    ptOn,
    ptN,
    ptSc,
    ptHeavy,
    ptCI,
    ptReuse,
    apm,
    runH,
    runN,
    ptCycles,
    ptDesign: [ptN, 0, 0] as Triple,
    ptEnv: zero3(),
    ptRun: zero3(),
  };
}
