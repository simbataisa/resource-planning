import { Id } from '@sit/schemas';
import { z } from 'zod';

/** Path parameter schemas: invalid ids become 400 VALIDATION_FAILED, never a database query. */
export const ProjectParams = z.object({ projectId: Id });
export const EstimateParams = z.object({ estimateId: Id });
export const VersionParams = z.object({ estimateId: Id, number: z.coerce.number().int().min(1) });
export const ProfileParams = z.object({ profileId: Id });
export const NotificationParams = z.object({ notificationId: Id });
