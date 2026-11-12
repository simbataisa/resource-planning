import { AuditQuery } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { readQuery } from '@/server/http/parse';
import { listAudit } from '@/server/services/admin';

export const dynamic = 'force-dynamic';

/** Audit events, newest first (H-01): a project for its QE Leads, everything for Admins. */
export const GET = api(async (request, { user }) =>
  ok(await listAudit(user, readQuery(request, AuditQuery))),
);
