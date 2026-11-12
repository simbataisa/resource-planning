import { PortfolioQuery } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { readQuery } from '@/server/http/parse';
import { portfolio } from '@/server/services/portfolio';

export const dynamic = 'force-dynamic';

/** The QBR roll-up (R-01): QE Leads for the projects they lead, Admins for all. */
export const GET = api(async (request, { user }) =>
  ok(await portfolio(user, readQuery(request, PortfolioQuery))),
);
