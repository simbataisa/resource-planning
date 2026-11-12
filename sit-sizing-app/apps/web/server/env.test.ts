import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env';

const valid = { DATABASE_URL: 'postgresql://app_user:synthetic@localhost:5432/app' };

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.APP_ENV).toBe('local');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it('treats empty strings as unset', () => {
    expect(
      parseEnv({ ...valid, OTEL_EXPORTER_OTLP_ENDPOINT: '' }).OTEL_EXPORTER_OTLP_ENDPOINT,
    ).toBeUndefined();
  });

  it('fails fast and names every problem without echoing values', () => {
    const secretish = 'mysql://root:do-not-print@db/app';
    try {
      parseEnv({ DATABASE_URL: secretish, APP_ENV: 'staging' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      const e = err as EnvError;
      expect(e.problems.some((p) => p.startsWith('DATABASE_URL'))).toBe(true);
      expect(e.problems.some((p) => p.startsWith('APP_ENV'))).toBe(true);
      expect(e.message).not.toContain('do-not-print');
    }
  });

  it('rejects verbose logging in prod', () => {
    expect(() => parseEnv({ ...valid, APP_ENV: 'prod', LOG_LEVEL: 'debug' })).toThrow(/LOG_LEVEL/);
  });

  it('allows dev sign-in only locally', () => {
    expect(parseEnv({ ...valid, AUTH_MODE: 'dev' }).AUTH_MODE).toBe('dev');
    expect(() => parseEnv({ ...valid, AUTH_MODE: 'dev', APP_ENV: 'sit' })).toThrow(/AUTH_MODE/);
    expect(parseEnv(valid).AUTH_MODE).toBe('oidc');
  });

  it('requires DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
