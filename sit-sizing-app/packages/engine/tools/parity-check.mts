// Cross-checks the TypeScript engine against the prototype on the golden cases and on
// thousands of seeded random estimates. Every number must be bit-identical (Object.is).
// Run: node tools/parity-check.mts [count]   (Node 24 strips types natively)
import { loadPrototype } from './prototype-harness.mjs';
import { randomCase } from './random-inputs.mjs';
import { compute, SENSITIVITY_ITEMS, sensitivity, shiftLeftScenarios } from '../src/index.ts';

const P = loadPrototype();
const N = Number(process.argv[2] ?? 3000);
const failures: string[] = [];

function same(path: string, a: unknown, b: unknown): void {
  if (failures.length > 20) return;
  if (typeof a === 'number' && typeof b === 'number') {
    if (!Object.is(a, b)) failures.push(`${path}: prototype ${a} vs engine ${b}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) failures.push(`${path}: length ${a.length} vs ${b.length}`);
    a.forEach((v, i) => same(`${path}[${i}]`, v, b[i]));
    return;
  }
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    for (const k of Object.keys(a))
      same(`${path}.${k}`, (a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]);
    return;
  }
  if (a !== b) failures.push(`${path}: prototype ${String(a)} vs engine ${String(b)}`);
}

function checkMode(tag: string, mode: 'rough' | 'detailed', A: any, S: any, E?: any) {
  const p = P.compute(mode, P.clone(A), P.clone(S), E ? P.clone(E) : undefined);
  const t = compute(
    mode,
    structuredClone(S),
    structuredClone(A),
    E ? structuredClone(E) : undefined,
  ) as any;
  const { c, x, ...rest } = p;
  same(`${tag}.${mode}.counts`, c, t.counts);
  same(`${tag}.${mode}.explain`, x, t.explain);
  for (const k of Object.keys(rest)) same(`${tag}.${mode}.${k}`, rest[k], t[k]);
}

function protoTornado(mode: string, A: any, S: any, sw: number) {
  return P.SENS.map((s: any, i: number) => ({ s, i }))
    .filter(({ s }: any) => !(s.rough && mode !== 'rough'))
    .map(({ s, i }: any) => {
      const a1 = P.clone(A),
        a2 = P.clone(A);
      s.f(a1, 1 - sw);
      s.f(a2, 1 + sw);
      const v1 = P.compute(mode, a1, P.clone(S)).fte,
        v2 = P.compute(mode, a2, P.clone(S)).fte;
      return {
        key: SENSITIVITY_ITEMS[i]!.key,
        lo: Math.min(v1, v2),
        hi: Math.max(v1, v2),
        span: Math.abs(v2 - v1),
      };
    })
    .filter((x: any) => x.span > 1e-6)
    .sort((a: any, b: any) => b.span - a.span);
}

function protoScenarioFte(A: any, S: any) {
  const gate = A.mutationGate;
  const E = [
    {
      mutation: Math.max(gate, 80),
      valBE: 100,
      valFE: 100,
      mapCov: 100,
      jacoco: 90,
      feUnit: Math.max(A.feUnitGate, 90),
      feMut: Math.max(A.feMutGate, 80),
      ruleCov: 100,
      iosUnit: Math.max(A.mobileUnitGate, 90),
      androidUnit: Math.max(A.mobileUnitGate, 90),
      dqCov: 100,
      contractCov: 100,
      goldenReuse: S.evidence.goldenReuse,
      evalCI: true,
      ptCI: true,
    },
    S.evidence,
    {
      mutation: 0,
      valBE: 0,
      valFE: 0,
      mapCov: 0,
      jacoco: 0,
      feUnit: 0,
      feMut: 0,
      ruleCov: 0,
      iosUnit: 0,
      androidUnit: 0,
      dqCov: 0,
      contractCov: 0,
      goldenReuse: S.evidence.goldenReuse,
      evalCI: false,
      ptCI: false,
    },
  ];
  return E.map((e) => {
    const o = P.compute('detailed', P.clone(A), P.clone(S), e);
    return [o.fte, o.cases];
  });
}

if (P.SENS.length !== SENSITIVITY_ITEMS.length)
  failures.push(`SENS length ${P.SENS.length} vs ${SENSITIVITY_ITEMS.length}`);

for (let seed = 1; seed <= N && failures.length <= 20; seed++) {
  // Odd seeds draw from all ten sizes (ADR-0020), even seeds from the original four.
  const { A, S } = randomCase(P, seed, seed % 2 ? P.SIZES : undefined);
  checkMode(`seed${seed}`, 'rough', A, S);
  checkMode(`seed${seed}`, 'detailed', A, S);
  if (seed % 10 === 0) {
    checkMode(`seed${seed}.override`, 'detailed', A, S, { mutation: 90, valFE: 60, evalCI: false });
    for (const mode of ['rough', 'detailed'] as const) {
      same(
        `seed${seed}.sens.${mode}`,
        protoTornado(mode, A, S, 0.3),
        sensitivity(mode, structuredClone(S), structuredClone(A), 0.3).rows,
      );
    }
    same(
      `seed${seed}.scen`,
      protoScenarioFte(A, S),
      shiftLeftScenarios(structuredClone(S), structuredClone(A)).map((s) => [
        s.result.fte,
        s.result.cases,
      ]),
    );
  }
}

if (failures.length) {
  console.error(`PARITY FAILED (${failures.length}+ differences):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `parity OK: ${N} random estimates × 2 modes, ${Math.floor(N / 10)} sensitivity/scenario/override checks, bit-identical`,
);
