// Writes golden/<case>.json from the prototype's own compute() (design 6.4).
// Usage: node tools/generate-golden.mjs   (needs ../sit-sizing-reference, see prototype-harness.mjs)
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPrototype, PROTOTYPE_PATH } from './prototype-harness.mjs';
import { GOLDEN_CASES } from './golden-cases.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'golden');
mkdirSync(outDir, { recursive: true });
const P = loadPrototype();

const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
function expected(o) {
  const groups = {};
  for (const G of P.GROUPS)
    groups[G.k] = { cases: o.groups[G.k].cases, hours: r2(o.groups[G.k].hours) };
  return {
    cases: o.cases,
    hours: r2(o.hours),
    fte: r4(o.fte),
    lo: r4(o.lo),
    hi: r4(o.hi),
    smeLabelHours: r2(o.smeLabelHours),
    groups,
  };
}

// The reference example, unchanged.
const example = JSON.parse(
  readFileSync(join(dirname(PROTOTYPE_PATH), 'golden-example.json'), 'utf8'),
);
writeFileSync(
  join(outDir, 'example.json'),
  JSON.stringify(
    {
      name: 'example',
      description: 'Prototype example scope with default assumptions (golden-example.json)',
      ...example,
    },
    null,
    2,
  ) + '\n',
);

for (const c of GOLDEN_CASES) {
  const A = P.clone(P.DEFAULTS);
  const S = P.clone(P.SAMPLE_SCOPE);
  c.edit(A, S);
  const file = {
    name: c.name,
    description: c.description,
    assumptions: A,
    scope: S,
    expected: {
      rough: expected(P.compute('rough', P.clone(A), P.clone(S))),
      detailed: expected(P.compute('detailed', P.clone(A), P.clone(S))),
    },
  };
  writeFileSync(join(outDir, `${c.name}.json`), JSON.stringify(file, null, 2) + '\n');
}
console.log(`wrote ${GOLDEN_CASES.length + 1} golden files to ${outDir}`);
