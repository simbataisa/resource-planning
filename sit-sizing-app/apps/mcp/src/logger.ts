import { pino, type DestinationStream } from 'pino';

/**
 * Structured JSON logger, set up like the web app's (design 12.6). Log request ID, user,
 * tool name, status and duration only: never tokens, tool arguments or document text.
 * The redaction list is a safety net, not a licence.
 */
export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
  child(bindings: object): Logger;
}

const REDACT_PATHS = [
  'token',
  'authorization',
  '*.token',
  '*.accessToken',
  '*.lockToken',
  '*.authorization',
  'headers.authorization',
  'headers.cookie',
  '*.headers.authorization',
  '*.headers.cookie',
  'headers["x-lock-token"]',
  '*.headers["x-lock-token"]',
];

export function createLogger(level: string, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      base: {
        service: 'sit-sizing-mcp',
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
