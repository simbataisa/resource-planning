import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://app_user:synthetic@localhost:5432/app',
  OIDC_ISSUER: 'http://localhost:8080/realms/qe-tools',
  OIDC_CLIENT_SECRET: 'synthetic-client-secret',
  SESSION_SECRET: 'synthetic-session-secret-0123456789abcdef',
};

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

  it('requires the OIDC settings for AUTH_MODE=oidc', () => {
    expect(() => parseEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/OIDC_ISSUER/);
    expect(() => parseEnv({ ...valid, SESSION_SECRET: '' })).toThrow(/SESSION_SECRET/);
    expect(() => parseEnv({ ...valid, SESSION_SECRET: 'too-short' })).toThrow(/SESSION_SECRET/);
    expect(
      parseEnv({ DATABASE_URL: valid.DATABASE_URL, AUTH_MODE: 'dev' }).OIDC_ISSUER,
    ).toBeUndefined();
  });

  it('lets the notification worker run without OIDC settings (N-01)', () => {
    const env = parseEnv({ DATABASE_URL: valid.DATABASE_URL, PROCESS_ROLE: 'worker' });
    expect(env.AUTH_MODE).toBe('oidc');
    expect(env.NOTIFY_MAX_ATTEMPTS).toBe(6);
    expect(env.SMTP_URL).toBeUndefined();
    expect(() =>
      parseEnv({ DATABASE_URL: valid.DATABASE_URL, PROCESS_ROLE: 'worker', SMTP_URL: 'nope' }),
    ).toThrow(/SMTP_URL/);
  });

  it('requires https outside local', () => {
    expect(() => parseEnv({ ...valid, APP_ENV: 'sit' })).toThrow(/APP_BASE_URL/);
    expect(
      parseEnv({ ...valid, APP_ENV: 'sit', APP_BASE_URL: 'https://sit-sizing.example.invalid' })
        .APP_ENV,
    ).toBe('sit');
  });

  it('requires DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
