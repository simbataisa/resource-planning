import { describe, expect, it } from 'vitest';
import { pageArgs, toPage } from './pagination';

describe('pagination', () => {
  it('asks for one extra row and uses the cursor when given', () => {
    expect(pageArgs({ limit: 2 })).toMatchObject({ take: 3 });
    expect(pageArgs({ limit: 2, cursor: 'c1' })).toMatchObject({
      take: 3,
      cursor: { id: 'c1' },
      skip: 1,
    });
  });

  it('returns the next cursor only when there are more rows', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(toPage(rows, { limit: 2 }, (r) => r.id)).toEqual({ items: ['a', 'b'], nextCursor: 'b' });
    expect(toPage(rows.slice(0, 2), { limit: 2 }, (r) => r.id)).toEqual({
      items: ['a', 'b'],
      nextCursor: null,
    });
  });
});
