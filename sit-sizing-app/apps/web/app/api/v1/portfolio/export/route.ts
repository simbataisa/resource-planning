import { PortfolioQuery } from '@sit/schemas';
import { createTranslator } from 'next-intl';
import { z } from 'zod';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';
import { toCsv } from '@/server/export/csv';
import { portfolioTable } from '@/server/export/portfolio-table';
import { api } from '@/server/http/authed';
import { readQuery } from '@/server/http/parse';
import { portfolio } from '@/server/services/portfolio';

export const dynamic = 'force-dynamic';

const Query = PortfolioQuery.extend({ lang: z.enum(['en', 'vi']).optional() });

/** The portfolio as CSV, for the QBR pack. */
export const GET = api(async (request, { user }) => {
  const q = readQuery(request, Query);
  const locale = q.lang ?? user.locale;
  const tr = createTranslator({ locale, messages: locale === 'vi' ? vi : en });
  const p = await portfolio(user, q);
  const csv = toCsv(portfolioTable(p, (k, v) => tr(k as never, v as never)));
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="sit-sizing-portfolio-${q.status}.csv"`,
      'cache-control': 'no-store',
    },
  });
});
