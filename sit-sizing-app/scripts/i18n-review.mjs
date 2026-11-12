// Vietnamese review round trip (design 8.5, step 1.6).
//
//   pnpm i18n:review              writes docs/i18n/vi-review.csv for the reviewer (opens in Excel)
//   pnpm i18n:apply <file.csv>    copies the "reviewed_vi" column back into apps/web/messages/vi.json
//
// The reviewer fills "reviewed_vi" only where the current Vietnamese should change, and may
// add a comment. Apply refuses a row whose placeholders ({n}) or tags (<b>) differ from English.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

function apply(file) {
  if (!file) throw new Error('usage: pnpm i18n:apply <reviewed.csv>');
  const en = new Map(flatten(JSON.parse(readFileSync(EN, 'utf8'))));
  const viTree = JSON.parse(readFileSync(VI, 'utf8'));
  const rows = parseCsv(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const head = rows.shift();
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
    const parent = parts.reduce((o, p) => o[p], viTree);
    if (parent[last] !== next) {
      parent[last] = next;
      changed += 1;
    }
  }
  if (problems.length) {
    console.error(`not applied:\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  }
  writeFileSync(VI, `${JSON.stringify(viTree, null, 2)}\n`);
  console.log(`updated ${changed} Vietnamese messages in apps/web/messages/vi.json`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'export') exportSheet();
else if (cmd === 'apply') apply(arg);
else console.log('usage: node scripts/i18n-review.mjs export | apply <file.csv>');
