import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const BASE = {
  SIT_API_BASE_URL: 'http://web:3000',
  OIDC_ISSUER: 'http://localhost:8080/realms/qe-tools',
  MCP_PUBLIC_URL: 'http://localhost:3100',
};

describe('parseEnv', () => {
  it('applies the defaults', () => {
    const env = parseEnv({ ...BASE });
    expect(env).toMatchObject({
      OIDC_API_AUDIENCE: 'sit-sizing-api',
      MCP_PORT: 3100,
      MCP_RATE_LIMIT_PER_MINUTE: 60,
      APP_ENV: 'local',
      LOG_LEVEL: 'info',
    });
    expect(env.MCP_DEV_USER).toBeUndefined();
    expect(env.OIDC_INTERNAL_URL).toBeUndefined();
  });

  it('refuses MCP_DEV_USER unless APP_ENV is local', () => {
    expect(parseEnv({ ...BASE, MCP_DEV_USER: 'dev-estimator' }).MCP_DEV_USER).toBe('dev-estimator');
    expect(() =>
      parseEnv({
        ...BASE,
        APP_ENV: 'sit',
        MCP_PUBLIC_URL: 'https://mcp.example.test',
        MCP_DEV_USER: 'dev-estimator',
      }),
    ).toThrow(/MCP_DEV_USER/);
  });

  it('requires SIT_API_BASE_URL, OIDC_ISSUER and MCP_PUBLIC_URL', () => {
    for (const key of Object.keys(BASE)) {
      const source: Record<string, string> = { ...BASE };
      delete source[key];
      expect(() => parseEnv(source), key).toThrow(new RegExp(key));
    }
    expect(() => parseEnv({ ...BASE, SIT_API_BASE_URL: 'not a url' })).toThrow(/SIT_API_BASE_URL/);
  });

  it('requires https for the public URL outside local and never echoes values', () => {
    expect(() => parseEnv({ ...BASE, APP_ENV: 'dev' })).toThrow(/MCP_PUBLIC_URL/);
    try {
      parseEnv({ ...BASE, SIT_API_BASE_URL: 'synthetic-secret-value' });
    } catch (err) {
      expect(String(err)).not.toContain('synthetic-secret-value');
    }
  });

  it('refuses debug logging in prod and parses numbers', () => {
    const prod = { ...BASE, APP_ENV: 'prod', MCP_PUBLIC_URL: 'https://mcp.example.test' };
    expect(() => parseEnv({ ...prod, LOG_LEVEL: 'debug' })).toThrow(/LOG_LEVEL/);
    expect(parseEnv({ ...prod, MCP_PORT: '4000', MCP_RATE_LIMIT_PER_MINUTE: '10' })).toMatchObject({
      MCP_PORT: 4000,
      MCP_RATE_LIMIT_PER_MINUTE: 10,
    });
  });
});
