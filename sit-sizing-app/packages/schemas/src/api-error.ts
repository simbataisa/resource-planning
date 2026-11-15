import { z } from 'zod';

/**
 * Machine-readable error codes the server knows. Add codes here, never inline in
 * handlers. This closed set is for the server's own use: it can only emit these.
 */
export const ApiErrorCode = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  /** Valid bearer token, but no active app user yet: sign in once in the browser (ADR-0016). */
  'NOT_PROVISIONED',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'NOT_READY',
  'INTERNAL',
]);
export type KnownApiErrorCode = z.infer<typeof ApiErrorCode>;
export const KNOWN_API_ERROR_CODES = ApiErrorCode.options;

/**
 * The code as published in the contract and parsed by clients: an extensible set
 * (ADR-0018). Any string is accepted, so a client built before a new code was added
 * keeps working; it falls back to the HTTP status and the message.
 */
export const ApiErrorCodeWire = z.string().meta({
  description:
    `Machine-readable error code. Known codes: ${KNOWN_API_ERROR_CODES.join(', ')}. ` +
    'The set is extensible: new codes may be added without a new API version. ' +
    'Clients must handle an unknown code by falling back to the HTTP status and the message.',
  'x-extensible-enum': [...KNOWN_API_ERROR_CODES],
});

/** One error envelope for every API response that is not 2xx (design 9.1). */
export const ApiErrorEnvelope = z.object({
  error: z.object({
    code: ApiErrorCodeWire,
    message: z.string().min(1),
    details: z.array(z.unknown()).optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorEnvelope>;
