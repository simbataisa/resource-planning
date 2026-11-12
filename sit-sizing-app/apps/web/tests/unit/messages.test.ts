import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';

/**
 * C-01 message checks (design 8.5, AGENTS.md rule 9). They fail CI when a key is missing,
 * when EN and VI disagree on placeholders or tags, when a message does not compile, or when
 * a Vietnamese string is a copy of the English one without being on the allow-list.
 */
type Tree = Record<string, unknown>;

function flatten(obj: Tree, prefix = ''): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? flatten(v as Tree, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v as string] as [string, string]],
  );
}

const EN = new Map(flatten(en));
const VI = new Map(flatten(vi));
const args = (s: string) => [...s.matchAll(/\{\s*([A-Za-z_]\w*)/g)].map((m) => m[1]!).sort();
const tags = (s: string) => [...s.matchAll(/<([A-Za-z]\w*)>/g)].map((m) => m[1]!).sort();

/**
 * Vietnamese values that are intentionally the same as English: product and standard names,
 * codes, units and references the prototype also leaves in English (engine findings U3).
 */
const SAME_IN_VI = [
  /^assumptionsTab\.(keys\.android|proxyKeys\.batch|rows\.cases_api)$/,
  /^catalogue\.channels\.(web|ios|android)$/,
  /^catalogue\.fieldTypes\.(boolean|checkbox|email|enum|radio)$/,
  /^catalogue\.groups\.fieldBE$/,
  /^catalogue\.levels\.[0-2]$/,
  /^catalogue\.ptTypes\.(load|spike|stress)$/,
  /^content\.standards\.(defaults\.rows\.21\.derivation|refs\.\d+|techniques\.rows\.\d+\.1)$/,
  /^detailTab\.app\.cellLabel$/,
  /^estimates\.(versionLabel|byOn)$/,
  /^evidenceTab\.spares\.r1\.test$/,
  /^roles\.QE_LEAD$/,
  /^teamTab\.(junior|mid|senior)$/,
];

describe('i18n messages', () => {
  it('EN and VI have exactly the same keys', () => {
    expect([...VI.keys()].sort()).toEqual([...EN.keys()].sort());
  });

  it('has no empty translations', () => {
    const empty = (m: Map<string, string>) =>
      [...m].filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k);
    expect(empty(EN)).toEqual([]);
    expect(empty(VI)).toEqual([]);
  });

  it('uses the same placeholders and rich-text tags in both languages', () => {
    const mismatched = [...EN].filter(([k, e]) => {
      const v = VI.get(k) ?? '';
      return args(e).join() !== args(v).join() || tags(e).join() !== tags(v).join();
    });
    expect(mismatched.map(([k]) => k)).toEqual([]);
  });

  it('compiles every message in both languages', () => {
    for (const [locale, messages, flat] of [
      ['en', en, EN],
      ['vi', vi, VI],
    ] as const) {
      const errors: string[] = [];
      const t = createTranslator({
        locale,
        messages: messages as Tree,
        onError: (e) => errors.push(e.message),
      });
      for (const [key, value] of flat) {
        const values = Object.fromEntries(args(value).map((a) => [a, '1']));
        const tagged = Object.fromEntries(tags(value).map((tag) => [tag, (c: string) => c]));
        if (tags(value).length) t.markup(key as never, { ...values, ...tagged } as never);
        else t(key as never, values as never);
      }
      expect(errors).toEqual([]);
    }
  });

  it('translates every message that is not on the allow-list', () => {
    const copies = [...EN]
      .filter(([k, e]) => VI.get(k) === e && /[a-z]{3}/.test(e))
      .map(([k]) => k)
      .filter((k) => !SAME_IN_VI.some((re) => re.test(k)));
    expect(copies).toEqual([]);
  });
});
