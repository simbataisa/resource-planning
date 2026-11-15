import { readFileSync } from 'node:fs';
import { ASSUMPTION_PATHS } from '@sit/engine';
import { describe, expect, it } from 'vitest';
import { buildGlossary, GENERATED_DIR } from './build-glossary';

type Tree = { [k: string]: string | Tree };

function lookup(tree: Tree, key: string): unknown {
  return key.split('.').reduce<unknown>((n, k) => (n as Tree | undefined)?.[k], tree);
}

describe('build-glossary', () => {
  it('generated files equal a fresh run of the generator', () => {
    const files = buildGlossary();
    expect(Object.keys(files).sort()).toEqual([
      'assumption-rows.json',
      'messages.en.json',
      'messages.vi.json',
    ]);
    for (const [name, text] of Object.entries(files)) {
      expect(readFileSync(new URL(name, GENERATED_DIR), 'utf8'), name).toBe(text);
    }
  });

  it('assumption-rows.json has exactly the 142 ASSUMPTION_PATHS, each with a label in EN and VI', () => {
    const files = buildGlossary();
    const rows = JSON.parse(files['assumption-rows.json']!) as Array<{
      path: string;
      group: string;
      labelKey: string;
      unitKey?: string;
    }>;
    expect(rows.map((r) => r.path)).toEqual([...ASSUMPTION_PATHS]);
    expect(rows).toHaveLength(142);
    for (const locale of ['en', 'vi']) {
      const messages = JSON.parse(files[`messages.${locale}.json`]!) as Tree;
      for (const r of rows) {
        expect(typeof lookup(messages, r.labelKey), `${locale} ${r.labelKey}`).toBe('string');
        expect(r.group).toMatch(/^[a-zA-Z]+$/);
        if (r.unitKey) expect(typeof lookup(messages, r.unitKey), r.unitKey).toBe('string');
      }
    }
  });
});
