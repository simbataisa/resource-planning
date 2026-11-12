import { z } from 'zod';

/** Machine-readable error codes. Add codes here, never inline in handlers. */
export const ApiErrorCode = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'NOT_READY',
  'INTERNAL',
]);

/** One error envelope for every API response that is not 2xx (design 9.1). */
export const ApiErrorEnvelope = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string().min(1),
    details: z.array(z.unknown()).optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorEnvelope>;
