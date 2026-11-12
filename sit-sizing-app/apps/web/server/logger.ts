import { pino, type Logger } from 'pino';

/**
 * Structured JSON logger (design 12.6).
 * Reads its few settings straight from process.env so it can be imported at
 * build time; full validation happens in getEnv() at start-up.
 * Never log inputs, tokens or personal data. The redaction list is a safety net, not a licence.
 */
const LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

function resolveLevel(): string {
  const requested = process.env.LOG_LEVEL ?? '';
  if (LEVELS.has(requested)) return requested;
  return process.env.NODE_ENV === 'test' ? 'silent' : 'info';
}

export const REDACT_PATHS = [
  'password',
  'token',
  'secret',
  '*.password',
  '*.token',
  '*.secret',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.clientSecret',
  'headers.authorization',
  'headers.cookie',
  '*.headers.authorization',
  '*.headers.cookie',
];

export function createLogger(destination?: pino.DestinationStream): Logger {
  return pino(
    {
      level: resolveLevel(),
      base: {
        service: process.env.OTEL_SERVICE_NAME ?? 'sit-sizing-web',
        env: process.env.APP_ENV ?? 'local',
        version: process.env.APP_VERSION ?? '0.0.0-dev',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    },
    destination,
  );
}

export const logger: Logger = createLogger();
