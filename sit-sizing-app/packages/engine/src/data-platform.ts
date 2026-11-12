import { applyCredit, credit } from './credit.ts';
import type { Ctx } from './context.ts';
import { bands, map3, num, sum3, zero3, type Triple } from './util.ts';

/** Data platform drivers: feeds, pipelines, tables and SCD, column mapping, DQ, reports, access. */
export function dataGroups(ctx: Ctx) {
  const { A, c, E } = ctx;
  const dd = c.data;
  const dOn =
    sum3(dd.feed) +
      sum3(dd.pipe) +
      sum3(dd.table) +
      sum3(dd.report) +
      num(dd.columns) +
      num(dd.dq) +
      num(dd.secured) >
    0;
  const bb = (arr: Readonly<Triple>, per: Readonly<Triple>): Triple =>
    bands((b) => num(arr[b]) * per[b]);
  const dqC = credit(num(E.dqCov));
  const ctC = credit(num(E.contractCov));
  const cr = (st: typeof dqC, v: number, sampleV: number) =>
    applyCredit(st, v, sampleV, A.partialShare);
  const feedTot = sum3(dd.feed);
  const colV = num(dd.columns) * A.dCol;
  const dqV = num(dd.dq) * A.dDq;
  return {
    dOn,
    dqC,
    ctC,
    feedTot,
    dataSource: dOn ? map3(bb(dd.feed, A.dFeed), (v, b) => cr(ctC, v, num(dd.feed[b]))) : zero3(),
    dataPipeline: dOn ? bb(dd.pipe, A.dPipe) : zero3(),
    dataModel: dOn
      ? map3(bb(dd.table, A.dTable), (v, b) => v + (b === 1 ? num(dd.scd) * A.dScd : 0))
      : zero3(),
    dataMapping: (dOn ? [cr(dqC, colV, colV * A.dataSample), 0, 0] : zero3()) as Triple,
    dataQuality: (dOn ? [cr(dqC, dqV, dqV * A.dataSample), 0, 0] : zero3()) as Triple,
    dataReport: dOn ? bb(dd.report, A.dReport) : zero3(),
    dataAccess: (dOn
      ? [num(dd.secured) * num(dd.accessRoles) * 2 * A.dAccessSampling, 0, 0]
      : zero3()) as Triple,
    dataPrep: zero3(),
  };
}
