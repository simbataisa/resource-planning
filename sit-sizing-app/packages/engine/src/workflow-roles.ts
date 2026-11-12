import type { Ctx } from './context.ts';
import { map3, sum3, type Triple } from './util.ts';

/** Workflows become transitions; role-gated transitions join the role matrix; approvals add SoD cases. */
export function workflowRoleGroups(ctx: Ctx) {
  const { A, c } = ctx;
  const trans = map3(c.workflow, (n, b) => n * A.transitions[b]);
  const trTot = sum3(trans);
  const workflow: Triple = map3(trans, (t) => t * (1 + A.invalidShare));
  const guarded = c.actions + trTot * A.gatedShare;
  const role: Triple = [guarded * c.roles * A.roleCasesPerPair * A.roleSampling, 0, 0];
  const sod: Triple = [c.approvals * A.sodCases, 0, 0];
  return { workflow, role, sod, trTot, guarded };
}
