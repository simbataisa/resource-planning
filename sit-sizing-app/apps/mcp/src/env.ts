import { z } from 'zod';

/**
 * Runtime configuration of the MCP server, validated once at start-up like
 * `apps/web/server/env.ts` (design spec 6.7). Add every new variable here AND to
 * `.env.example`. Error messages name the variable but never echo its value.
 */
const EnvSchema = z
  .object({
    APP_ENV: z.enum(['local', 'dev', 'sit', 'prod']).default('local'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Origin of the SIT Sizing web app; the client adds `/api/v1`. */
    SIT_API_BASE_URL: z.url(),
    /** Public issuer of the Keycloak realm (must equal the token's `iss`). */
    OIDC_ISSUER: z.url(),
    /** Origin the server uses to reach Keycloak for its keys (container network). */
    OIDC_INTERNAL_URL: z.url().optional(),
    /** Audience every access token must carry (ADR-0016). */
    OIDC_API_AUDIENCE: z.string().min(1).default('sit-sizing-api'),
    /** This server's own public URL: the OAuth protected resource identifier. */
    MCP_PUBLIC_URL: z.url(),
    MCP_PORT: z.coerce.number().int().min(0).max(65535).default(3100),
    MCP_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(60),
    /** Local only: act as this seeded user via `x-dev-user`, without Keycloak. */
    MCP_DEV_USER: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MCP_DEV_USER && env.APP_ENV !== 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['MCP_DEV_USER'],
        message: 'dev user is only allowed when APP_ENV=local',
      });
    }
    if (env.APP_ENV !== 'local' && !env.MCP_PUBLIC_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['MCP_PUBLIC_URL'],
        message: 'must use https outside local',
      });
    }
    if (env.APP_ENV === 'prod' && (env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace')) {
      ctx.addIssue({
        code: 'custom',
        path: ['LOG_LEVEL'],
        message: 'debug/trace logging is not allowed in prod',
      });
    }
  });

export type McpEnv = z.infer<typeof EnvSchema>;

/** Validates the environment; throws an error naming each bad variable (values never echoed). */
export function parseEnv(source: NodeJS.ProcessEnv): McpEnv {
  // Empty strings (as written by `.env.example`) count as unset.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid MCP server configuration: ${problems.join('; ')}`);
  }
  return parsed.data;
}
