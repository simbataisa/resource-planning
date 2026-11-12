import type { PageQuery } from '@sit/schemas';

/** Prisma arguments for cursor paging, newest first (design 9.1: `?cursor=&limit=`). */
export function pageArgs(q: PageQuery) {
  return {
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  };
}

/** Splits the extra row off and returns the cursor for the next page. */
export function toPage<T extends { id: string }, R>(rows: T[], q: PageQuery, map: (row: T) => R) {
  const more = rows.length > q.limit;
  const items = more ? rows.slice(0, q.limit) : rows;
  return { items: items.map(map), nextCursor: more ? (items[items.length - 1]?.id ?? null) : null };
}
