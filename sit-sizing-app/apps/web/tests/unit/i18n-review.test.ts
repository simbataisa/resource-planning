import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain Node script without type declarations
import { applyReview } from '../../../../scripts/i18n-review.mjs';

/** Synthetic messages: numeric keys after a text key, as in the real data-platform drivers. */
const en = {
  app: { name: 'SIT Sizing' },
  feed: { label: 'Data feed', '0': 'Simple', '1': 'Complex' },
};
const viText = `${JSON.stringify(
  {
    app: { name: 'SIT Sizing' },
    feed: { label: 'Nguồn dữ liệu', '0': 'Đơn giản', '1': 'Phức tạp' },
  },
  null,
  2,
)
  // JSON.stringify itself moves integer keys first; restore the file's real order.
  .replace(
    /"0": "Đơn giản",\n {4}"1": "Phức tạp",\n {4}"label": "Nguồn dữ liệu"/,
    '"label": "Nguồn dữ liệu",\n    "0": "Đơn giản",\n    "1": "Phức tạp"',
  )}\n`;
const csv = (rows: string[]) => `﻿key,reviewed_vi\r\n${rows.join('\r\n')}\r\n`;

describe('i18n:apply (scripts/i18n-review.mjs)', () => {
  it('fixture keeps "label" before the numeric keys', () => {
    expect(viText.indexOf('"label"')).toBeLessThan(viText.indexOf('"0"'));
  });

  it('changes nothing when no row has reviewed wording', () => {
    const result = applyReview({ enTree: en, viText, csvText: csv(['feed.label,', 'app.name,']) });
    expect(result).toEqual({ text: viText, changed: 0, problems: [] });
  });

  it('keeps the key order when it applies a change', () => {
    const result = applyReview({ enTree: en, viText, csvText: csv(['feed.1,Rất phức tạp']) });
    expect(result.changed).toBe(1);
    expect(result.text).toBe(viText.replace('"Phức tạp"', '"Rất phức tạp"'));
  });

  it('applies a change to a text key', () => {
    const result = applyReview({
      enTree: en,
      viText,
      csvText: csv(['feed.label,Nguồn dữ liệu (feed)']),
    });
    expect(result.text).toBe(viText.replace('"Nguồn dữ liệu"', '"Nguồn dữ liệu (feed)"'));
  });

  it('refuses unknown keys and placeholder mismatches', () => {
    const result = applyReview({
      enTree: { ...en, hello: 'Hi {name}' },
      viText,
      csvText: csv(['nope.key,X', 'hello,Xin chào']),
    });
    expect(result.changed).toBe(0);
    expect(result.text).toBe(viText);
    expect(result.problems).toEqual([
      'nope.key: unknown key',
      'hello: placeholders or tags differ from English (name)',
    ]);
  });
});
