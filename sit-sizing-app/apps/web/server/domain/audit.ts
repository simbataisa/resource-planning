/**
 * Audit log filters (design 10.6, release 3 H-01). Pure: turns the query into the conditions
 * the repository applies. Dates are whole UTC days, both ends included.
 */
export interface AuditFilter {
  projectId?: string;
  entity?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export function auditWhere(f: AuditFilter) {
  const at =
    f.from || f.to
      ? {
          ...(f.from ? { gte: new Date(`${f.from}T00:00:00.000Z`) } : {}),
          ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999Z`) } : {}),
        }
      : undefined;
  return {
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.entity ? { entity: f.entity } : {}),
    // "estimate.version." matches every version action; anything else must match exactly.
    ...(f.action ? { action: f.action.endsWith('.') ? { startsWith: f.action } : f.action } : {}),
    ...(f.actorId ? { actorId: f.actorId } : {}),
    ...(at ? { at } : {}),
  };
}
