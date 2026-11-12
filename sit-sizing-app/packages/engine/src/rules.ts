import type { Credit } from './credit.ts';
import type { Ctx } from './context.ts';
import { map3, sum3, type Triple } from './util.ts';

/**
 * Business rules: critical rules in full, standard rules credited by rule unit-test
 * coverage, then the mutation uplift and the variant factor.
 */
export function ruleGroup(ctx: Ctx, rc: Credit, mutOK: boolean) {
  const { A, c } = ctx;
  const rTot = sum3(c.rule);
  const crit = Math.min(rTot, c.critical);
  const cf = rTot > 0 ? crit / rTot : 0;
  const vf = 1 + (c.variants - 1) * A.variantShare * A.variantSampling;
  const mu = mutOK ? 1 : 1 + A.ruleUplift;
  const rule: Triple = map3(c.rule, (n, b) => {
    const full = A.cases.rule[b];
    const st = n * (1 - cf);
    const std =
      rc === 'sample'
        ? st * A.wiringCases
        : rc === 'partial'
          ? st * full * A.partialShare
          : st * full;
    return (n * cf * full + std) * mu * vf;
  });
  return { rule, rTot, crit, vf, mu };
}
