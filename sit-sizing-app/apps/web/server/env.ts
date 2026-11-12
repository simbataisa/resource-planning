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
     * oidc: sign-in through Keycloak (step 1.3). dev: trust the `x-dev-user` header
     * (a seeded subject) — only for local runs and tests before Keycloak exists.
     */
    AUTH_MODE: z.enum(['oidc', 'dev']).default('oidc'),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === 'dev' && env.APP_ENV !== 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message: 'dev sign-in is only allowed when APP_ENV=local',
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
