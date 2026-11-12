import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * API integration suite (design 13, L2/L3): real PostgreSQL in a Testcontainer,
 * migrations applied, synthetic seed loaded, route handlers called directly.
 * Needs Docker (Docker Desktop, or Rancher Desktop with dockerd; see docs/runbook.md).
 */
const root = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  root,
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    name: 'integration',
    root,
    dir: root,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    reporters: ['default', 'json'],
    outputFile: { json: '../../reports/integration.json' },
  },
});
