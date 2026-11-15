import { readFileSync } from 'node:fs';
import { ASSUMPTION_PATHS } from '@sit/engine';
import { describe, expect, it } from 'vitest';
import { buildGlossary, GENERATED_DIR, parseApprovalRecord } from './build-glossary';

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

describe('approved explanations gate', () => {
  const HELP = 'assumptionsTab.help.';
  const source = (approval: unknown, vi: Record<string, string> = { minutes_1: 'Giải thích' }) => ({
    approval,
    messages: {
      en: { assumptionsTab: { help: { minutes_1: 'Explains', minutes_2: 'Draft' }, units: {} } },
      vi: { assumptionsTab: { help: vi, units: {} } },
    },
  });
  const help = (files: Record<string, string>, locale: 'en' | 'vi') =>
    (JSON.parse(files[`messages.${locale}.json`]!) as Tree).assumptionsTab as Tree;

  it('drops help keys that are not in the approval record', () => {
    const files = buildGlossary(source({ approvedBy: null, approvedOn: null, rows: [] }));
    expect(help(files, 'en').help).toBeUndefined();
    expect(help(files, 'vi').help).toBeUndefined();
    expect(help(files, 'en').units).toEqual({});
  });

  it('keeps an approved key in EN and VI and drops the others', () => {
    const files = buildGlossary(
      source({ approvedBy: 'Lead', approvedOn: '2026-11-20', rows: [`${HELP}minutes_1`] }),
    );
    expect(help(files, 'en').help).toEqual({ minutes_1: 'Explains' });
    expect(help(files, 'vi').help).toEqual({ minutes_1: 'Giải thích' });
  });

  it('fails when an approved key is missing in VI', () => {
    expect(() =>
      buildGlossary(
        source({ approvedBy: 'Lead', approvedOn: '2026-11-20', rows: [`${HELP}minutes_1`] }, {}),
      ),
    ).toThrow(/assumptionsTab\.help\.minutes_1.*Vietnamese/);
  });

  it('fails when an approved key is missing in EN', () => {
    expect(() =>
      buildGlossary(
        source({ approvedBy: 'Lead', approvedOn: '2026-11-20', rows: [`${HELP}nope`] }),
      ),
    ).toThrow(/assumptionsTab\.help\.nope.*English/);
  });

  it('rejects a bad record shape', () => {
    expect(() => parseApprovalRecord({ rows: [] })).toThrow();
    expect(() =>
      parseApprovalRecord({ approvedBy: null, approvedOn: null, rows: ['minutes_1'] }),
    ).toThrow();
    expect(() =>
      parseApprovalRecord({ approvedBy: null, approvedOn: 'x', rows: [], extra: 1 }),
    ).toThrow();
    expect(() =>
      parseApprovalRecord({ approvedBy: 'Lead', approvedOn: null, rows: [`${HELP}a`] }),
    ).toThrow();
  });

  it('the committed record parses and approves nothing yet', () => {
    const record = parseApprovalRecord(
      JSON.parse(
        readFileSync(
          new URL('../../../docs/i18n/assumption-help-approved.json', import.meta.url),
          'utf8',
        ),
      ),
    );
    expect(record.rows).toEqual([]);
  });
});
