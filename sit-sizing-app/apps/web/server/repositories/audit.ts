import type { Prisma } from '@sit/db';
import type { DbOrTx } from '../db';

export interface AuditInput {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  projectId?: string | null;
  detail?: Record<string, unknown>;
  requestId?: string;
}

/** Append-only audit trail (design 11). Never put inputs, tokens or personal data in `detail`. */
export function recordAudit(tx: DbOrTx, e: AuditInput) {
  return tx.auditEvent.create({
    data: {
      actorId: e.actorId,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      projectId: e.projectId ?? null,
      detail: (e.detail ?? {}) as Prisma.InputJsonValue,
      requestId: e.requestId ?? null,
    },
  });
}
