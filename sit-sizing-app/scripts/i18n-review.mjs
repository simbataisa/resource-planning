// Vietnamese review round trip (design 8.5, step 1.6).
//
//   pnpm i18n:review              writes docs/i18n/vi-review.csv for the reviewer (opens in Excel)
//   pnpm i18n:apply [file.csv]    copies the "reviewed_vi" column back into apps/web/messages/vi.json
//                                 (default: docs/i18n/vi-review.csv, the sheet i18n:review writes)
//
// The reviewer fills "reviewed_vi" only where the current Vietnamese should change, and may
// add a comment. Apply refuses a row whose placeholders ({n}) or tags (<b>) differ from English.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EN = join(root, 'apps/web/messages/en.json');
const VI = join(root, 'apps/web/messages/vi.json');
const DICT = join(root, '../sit-sizing-reference/vi-translations.json');
const OUT = join(root, 'docs/i18n/vi-review.csv');
const HEADER = ['key', 'area', 'english', 'vietnamese', 'source', 'reviewed_vi', 'comment'];

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
const plain = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const shape = (s) =>
  [...s.matchAll(/\{\s*(\w+)|<(\w+)>/g)]
    .map((m) => m[1] ?? `<${m[2]}>`)
    .sort()
    .join();

const csvCell = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** RFC 4180 parser (quoted fields, doubled quotes, newlines inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

function exportSheet() {
  const en = new Map(flatten(JSON.parse(readFileSync(EN, 'utf8'))));
  const vi = new Map(flatten(JSON.parse(readFileSync(VI, 'utf8'))));
  const dict = existsSync(DICT)
    ? JSON.parse(readFileSync(DICT, 'utf8'))
    : { units: {}, texts: {}, js: {} };
  const known = new Set(
    ['units', 'texts', 'js'].flatMap((k) =>
      Object.values(dict[k] ?? {}).map((v) => plain(String(v))),
    ),
  );
  const lines = [HEADER.join(',')];
  for (const [key, english] of en) {
    const v = vi.get(key) ?? '';
    const source = known.has(plain(v)) ? 'prototype' : 'app';
    lines.push(
      [key, key.split('.')[0], english, v, source, '', ''].map((c) => csvCell(String(c))).join(','),
    );
  }
  mkdirSync(dirname(OUT), { recursive: true });
  // BOM so Excel opens the file as UTF-8 (Vietnamese diacritics).
  writeFileSync(OUT, `﻿${lines.join('\r\n')}\r\n`);
  const app = lines.filter((l) => l.includes(',app,')).length;
  console.log(
    `wrote ${OUT}: ${en.size} messages, ${app} written for the app (not from the prototype)`,
  );
}

// JSON.parse puts integer-like keys ("0", "1") before the others, so a parse-and-stringify
// would reorder vi.json. Mark them with \u0001 while parsing so they keep their place.
const NUMERIC_KEY = /(?<!\\)"(\d+)"(\s*:)/g;
const MARKED_KEY = /"\\u0001(\d+)"(\s*:)/g;
const parseOrdered = (text) => JSON.parse(text.replace(NUMERIC_KEY, '"\\u0001$1"$2'));
const stringifyOrdered = (tree) =>
  `${JSON.stringify(tree, null, 2).replace(MARKED_KEY, '"$1"$2')}\n`;
const child = (obj, part) => (part in obj ? part : `\u0001${part}`);

/**
 * Copies reviewed wording into the Vietnamese messages. Pure: returns the new vi.json text
 * (the input text, untouched, when nothing changed), the number of changed messages and the
 * rows it refused.
 */
export function applyReview({ enTree, viText, csvText }) {
  const en = new Map(flatten(enTree));
  const viTree = parseOrdered(viText);
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ''));
  const head = rows.shift() ?? [];
  const col = (name) => head.indexOf(name);
  const [ki, ri] = [col('key'), col('reviewed_vi')];
  if (ki < 0 || ri < 0) throw new Error('the file needs "key" and "reviewed_vi" columns');
  let changed = 0;
  const problems = [];
  for (const r of rows) {
    const key = r[ki];
    const next = (r[ri] ?? '').trim();
    if (!next) continue;
    if (!en.has(key)) {
      problems.push(`${key}: unknown key`);
      continue;
    }
    if (shape(next) !== shape(en.get(key))) {
      problems.push(`${key}: placeholders or tags differ from English (${shape(en.get(key))})`);
      continue;
    }
    const parts = key.split('.');
    const last = parts.pop();
    const parent = parts.reduce((o, p) => o[child(o, p)], viTree);
    const slot = child(parent, last);
    if (parent[slot] !== next) {
      parent[slot] = next;
      changed += 1;
    }
  }
  return { text: changed ? stringifyOrdered(viTree) : viText, changed, problems };
}

/** The reviewed sheet: the given path, or the sheet that i18n:review writes. */
export const reviewFile = (arg) => (arg ? resolve(arg) : OUT);

function apply(arg) {
  const file = reviewFile(arg);
  if (!existsSync(file)) {
    console.error(
      `no review sheet at ${relative(process.cwd(), file)}: run pnpm i18n:review first, or pass the reviewed file`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`applying ${relative(process.cwd(), file)}`);
  const { text, changed, problems } = applyReview({
    enTree: JSON.parse(readFileSync(EN, 'utf8')),
    viText: readFileSync(VI, 'utf8'),
    csvText: readFileSync(file, 'utf8'),
  });
  if (problems.length) {
    console.error(`not applied:\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  }
  if (changed) writeFileSync(VI, text);
  console.log(`updated ${changed} Vietnamese messages in apps/web/messages/vi.json`);
}

// Run as a command only, not when a test imports applyReview.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'export') exportSheet();
  else if (cmd === 'apply') apply(arg);
  else console.log('usage: node scripts/i18n-review.mjs export | apply [file.csv]');
}
