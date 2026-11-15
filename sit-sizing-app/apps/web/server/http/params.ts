import { Id, LockToken } from '@sit/schemas';
import { z } from 'zod';

/** Path parameter schemas: invalid ids become 400 VALIDATION_FAILED, never a database query. */
export const ProjectParams = z.object({ projectId: Id });
export const EstimateParams = z.object({ estimateId: Id });
export const VersionParams = z.object({ estimateId: Id, number: z.coerce.number().int().min(1) });
export const ProfileParams = z.object({ profileId: Id });
export const NotificationParams = z.object({ notificationId: Id });
export const ActualsParams = VersionParams.extend({ actualsId: Id });
export const UserParams = z.object({ userId: Id });

/** Header carrying the draft lock token (draft lock token design). Never logged. */
export const LOCK_TOKEN_HEADER = 'X-Lock-Token';
/** Header parameters documented on the operations that use the draft lock. */
export const LockTokenHeaders = z.object({ [LOCK_TOKEN_HEADER]: LockToken.optional() });

/**
 * The lock token the caller sent, or undefined when the header is absent or empty.
 * A value over the documented 200 characters throws a ZodError (→ 400 VALIDATION_FAILED).
 */
export function lockTokenOf(request: Request): string | undefined {
  const value = request.headers.get(LOCK_TOKEN_HEADER);
  return value ? LockToken.parse(value) : undefined;
}
