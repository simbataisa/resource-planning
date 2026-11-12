import type { Ctx } from './context.ts';
import { bands, num, sum3, zero3, type Triple } from './util.ts';

/** AI product drivers: golden-set intents, RAG, OCR, guardrails, tools, HITL, evaluation runs. */
export function aiGroups(ctx: Ctx) {
  const { A, c, S, E } = ctx;
  const da = c.ai;
  const aOn = sum3(da.intent) + sum3(da.ocr) + num(da.rag) + num(da.tools) + num(da.hitl) > 0;
  const bb = (arr: Readonly<Triple>, per: Readonly<Triple>): Triple =>
    bands((b) => num(arr[b]) * per[b]);
  const langs = c.languages;
  const iters = Math.max(1, num(S.team.aiIters) || 1);
  const reuse = Math.min(100, Math.max(0, num(E.goldenReuse))) / 100;
  const evalCI = E.evalCI !== undefined ? !!E.evalCI : !!S.evidence.evalCI;
  const reviewShare = evalCI ? A.aiReviewAuto : A.aiReviewManual;
  return {
    aOn,
    langs,
    iters,
    reuse,
    evalCI,
    reviewShare,
    aiIntent: (aOn ? [sum3(bb(da.intent, A.aiUtt)) * langs, 0, 0] : zero3()) as Triple,
    aiRag: (aOn ? [num(da.rag) * A.aiRagQ * langs, 0, 0] : zero3()) as Triple,
    aiOcr: (aOn ? [sum3(bb(da.ocr, A.aiOcrSamples)), 0, 0] : zero3()) as Triple,
    aiGuard: (aOn ? [num(da.guard) * A.aiAdv, 0, 0] : zero3()) as Triple,
    aiTool: (aOn ? [0, num(da.tools) * A.aiToolCases, 0] : zero3()) as Triple,
    aiHitl: (aOn ? [0, num(da.hitl) * A.aiHitlCases, 0] : zero3()) as Triple,
    aiEval: zero3(),
  };
}

/** Labelling minutes per sample for the golden-set groups (prototype LABEL). */
export function labelMinutes(A: Ctx['A']): Partial<Record<string, number>> {
  return {
    aiIntent: A.aiLabelUtt,
    aiRag: A.aiLabelRag,
    aiOcr: A.aiLabelOcr,
    aiGuard: A.aiLabelAdv,
  };
}
