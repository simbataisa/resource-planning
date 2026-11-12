import type { Me } from '@sit/schemas';
import type { Principal } from './rbac';

/** The signed-in user as an rbac Principal, so components can hide actions they cannot take. */
export function principalFromMe(me: Me): Principal {
  return {
    id: me.id,
    globalRole: me.globalRole,
    memberships: Object.fromEntries(me.memberships.map((m) => [m.projectId, m.role])),
  };
}
