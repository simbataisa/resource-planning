import { defineConfig } from 'vitest/config';

// End-to-end flow against a running MCP server (not part of the root unit run):
// `pnpm --filter @sit/mcp test:e2e` (after `pnpm dev:up`) or `test:e2e:stack` (isolated stack).
export default defineConfig({
  test: {
    name: 'mcp-e2e',
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
