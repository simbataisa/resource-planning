import type { Credit } from './credit.ts';
import type { Ctx } from './context.ts';
import { dot3, num, sum3, type Triple } from './util.ts';

/** Request and response field counts: from the FSD when entered, otherwise estimated per API. */
export function apiFields(ctx: Ctx) {
  const { A, c, S, mode } = ctx;
  const apis = sum3(c.api);
  const estReq = dot3(c.api, A.reqFields) * (1 - A.dtoReuse);
  const estResp = dot3(c.api, A.respFields) * (1 - A.dtoReuse) + sum3(c.event) * A.eventFields;
  const reqIn = mode === 'detailed' ? num(S.detail.reqFields) : 0;
  const respIn = mode === 'detailed' ? num(S.detail.respFields) : 0;
  return {
    apis,
    reqF: reqIn > 0 ? reqIn : estReq,
    respF: respIn > 0 ? respIn : estResp,
    reqIn: reqIn > 0,
    respIn: respIn > 0,
  };
}

/** Field validation, frontend and backend, credited by L1 validation coverage. */
export function validationGroups(
  ctx: Ctx,
  fe: Credit,
  be: Credit,
  f: ReturnType<typeof apiFields>,
) {
  const { A, c, fp } = ctx;
  const fld = (state: Credit, base: number, each: number) =>
    state === 'sample'
      ? base * each
      : state === 'partial'
        ? c.fields * fp.per * A.partialShare
        : c.fields * fp.per;
  const fieldFE: Triple = [fld(fe, sum3(c.screen), A.sampleFE), 0, 0];
  const beFull = f.reqF * fp.per + f.apis * A.apiOnlyCases;
  const fieldBE: Triple = [
    be === 'sample' ? f.apis * A.sampleBE : be === 'partial' ? beFull * A.partialShare : beFull,
    0,
    0,
  ];
  return { fieldFE, fieldBE };
}
