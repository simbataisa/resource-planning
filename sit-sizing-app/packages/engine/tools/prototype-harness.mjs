// Loads the prototype's model code (constants, counts, compute, SENS, META) from
// sit-sizing-reference/prototype-engine-and-ui.js and runs it in Node without a DOM.
// Used only to generate golden files and to cross-check the port. Never imported by src/.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const PROTOTYPE_PATH =
  process.env.PROTOTYPE_PATH ??
  resolve(here, '../../../../sit-sizing-reference/prototype-engine-and-ui.js');

const START = 'var CX=';
const END = '/* ---------- rubric and derived rows ---------- */';

export function loadPrototype(path = PROTOTYPE_PATH) {
  const src = readFileSync(path, 'utf8');
  const a = src.indexOf(START);
  const b = src.indexOf(END);
  if (a < 0 || b < 0) throw new Error(`Prototype markers not found in ${path}`);
  const body = src.slice(a, b);
  // tr/trf are only used for error messages and labels; identity stubs are enough.
  const factory = new Function(
    'localStorage',
    `"use strict";
     function tr(s){ return s; }
     function trf(s,v){ return s.replace(/\\{(\\w+)\\}/g,function(m,k){ return v[k]!==undefined?v[k]:m; }); }
     ${body}
     return { CX, SIZES, GROUPS, DRV, FTYPES, PTT, DEFAULTS, SAMPLE_SCOPE, META, ROWS,
              clone, get, merge, counts, fieldProfile, credit, compute, SENS, scaleArr,
              loadProfile: function(o){ loadProfile(o); return { A: A, S: S, profile: PROFILE }; } };`,
  );
  return factory(undefined);
}
