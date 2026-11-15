import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { start } from './main';
import { fakeLogger } from './test-support';

describe('start', () => {
  it('validates the environment and listens on MCP_PORT', async () => {
    const { log, calls } = fakeLogger();
    const server = await start(
      {
        SIT_API_BASE_URL: 'http://web:3000',
        OIDC_ISSUER: 'http://localhost:8080/realms/qe-tools',
        MCP_PUBLIC_URL: 'http://localhost:3100',
        MCP_PORT: '0',
      },
      { log, host: '127.0.0.1' },
    );
    const { port } = server.address() as AddressInfo;
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
    expect(JSON.stringify(calls)).toContain('mcp server listening');
    await new Promise<void>((r) => server.close(() => r()));
  });

  it('refuses to start with an invalid environment', async () => {
    await expect(start({}, { log: fakeLogger().log })).rejects.toThrow(/SIT_API_BASE_URL/);
  });
});
