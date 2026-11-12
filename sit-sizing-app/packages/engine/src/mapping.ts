import type { Credit } from './credit.ts';
import type { Ctx } from './context.ts';
import type { Triple } from './util.ts';

/** Response and payload mapping and format checks, credited by mapping coverage. */
export function mappingGroup(ctx: Ctx, mp: Credit, respF: number): Triple {
  const { A } = ctx;
  const mapBase = respF * A.mapPerField * (1 + A.formatShare);
  return [mp === 'sample' ? 0 : mp === 'partial' ? mapBase * A.partialShare : mapBase, 0, 0];
}
