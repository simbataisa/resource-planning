import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';

/** Flattens nested message objects to dotted keys. */
function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe('i18n messages', () => {
  it('EN and VI have exactly the same keys (AGENTS.md rule 9)', () => {
    expect(keys(vi).sort()).toEqual(keys(en).sort());
  });

  it('has no empty translations', () => {
    const empty = (m: Record<string, unknown>) =>
      keys(m).filter((k) => {
        const v = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], m);
        return typeof v !== 'string' || v.trim() === '';
      });
    expect(empty(en)).toEqual([]);
    expect(empty(vi)).toEqual([]);
  });
});
