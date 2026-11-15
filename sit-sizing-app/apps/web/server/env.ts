import { z } from 'zod';

/**
 * Runtime configuration, validated once at start-up (design 12.4).
 * Add every new variable here AND to .env.example (AGENTS.md rule 8).
 * Error messages name the variable but never echo its value.
 */
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'dev', 'sit', 'prod']).default('local'),
    APP_VERSION: z.string().min(1).default('0.0.0-dev'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z
      .url()
      .refine((v) => /^postgres(ql)?:\/\//.test(v), { message: 'must be a postgresql:// URL' }),
    OTEL_SERVICE_NAME: z.string().min(1).default('sit-sizing-web'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    /**
     * oidc: sign-in through Keycloak only. dev: also trust the `x-dev-user` header or
     * `sit-dev-user` cookie (a seeded subject) — local runs and integration tests only.
     */
    AUTH_MODE: z.enum(['oidc', 'dev']).default('oidc'),
    /** Public URL of this app; the OIDC redirect and post-logout URIs are built from it. */
    APP_BASE_URL: z.url().default('http://localhost:3000'),
    /** Issuer as the browser sees it, e.g. https://idp.example/realms/qe-tools (design 10). */
    OIDC_ISSUER: z.url().optional(),
    /** Optional server-to-server base URL of the IdP when it differs (e.g. http://keycloak:8080 in compose). */
    OIDC_INTERNAL_URL: z.url().optional(),
    OIDC_CLIENT_ID: z.string().min(1).default('sit-sizing-web'),
    OIDC_CLIENT_SECRET: z.string().min(16).optional(),
    /**
     * Audience a bearer access token must carry to call /api/v1 (ADR-0016). Set by the
     * realm's `sit-sizing-api` audience client scope.
     */
    OIDC_API_AUDIENCE: z.string().min(1).default('sit-sizing-api'),
    /** Encrypts the session cookie. At least 32 characters; from the secret store outside local. */
    SESSION_SECRET: z.string().min(32).optional(),
    /** API requests per user per minute and app instance (design 11, threat model T-11; Q10). */
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(300),
    /**
     * Notification worker (N-01, Q12). SMTP server, e.g. smtp://mail:1025 for the local
     * mail catcher; smtps://user:pass@host:465 outside local, from the secret store.
     * Unset: emails stay queued and in-app notices still work.
     */
    SMTP_URL: z.url().optional(),
    MAIL_FROM: z.string().min(3).default('SIT Sizing <no-reply@sit-sizing.local>'),
    /** Delivery attempts before an email is marked FAILED. */
    NOTIFY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(6),
    /** How often the worker looks for due emails, in milliseconds. */
    NOTIFY_POLL_MS: z.coerce.number().int().min(500).default(5000),
    /**
     * web (default) or worker. The worker serves no requests, so it needs no OIDC client
     * settings or session secret; it keeps AUTH_MODE=oidc and never trusts dev headers.
     */
    PROCESS_ROLE: z.enum(['web', 'worker']).default('web'),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === 'dev' && env.APP_ENV !== 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message: 'dev sign-in is only allowed when APP_ENV=local',
      });
    }
    if (env.AUTH_MODE === 'oidc' && !env.OIDC_ISSUER && env.PROCESS_ROLE === 'web') {
      ctx.addIssue({
        code: 'custom',
        path: ['OIDC_ISSUER'],
        message: 'required when AUTH_MODE=oidc',
      });
    }
    if (env.OIDC_ISSUER) {
      for (const key of ['OIDC_CLIENT_SECRET', 'SESSION_SECRET'] as const) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'required when OIDC_ISSUER is set',
          });
      }
    }
    if (env.APP_ENV !== 'local' && !env.APP_BASE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_BASE_URL'],
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

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'EnvError';
    this.problems = problems;
  }
}

/** Parses a raw environment. Empty strings count as "not set". */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, v === undefined || v.trim() === '' ? undefined : v]),
  );
  const result = EnvSchema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated configuration for this process. Throws EnvError on the first call if invalid. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
