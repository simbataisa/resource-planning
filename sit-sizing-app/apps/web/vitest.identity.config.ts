import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('./', import.meta.url));

/** Identity baseline against a real Keycloak (K-02). Needs Docker; ~1 minute. */
export default defineConfig({
  root,
  resolve: { alias: { '@': root } },
  test: {
    name: 'identity',
    root,
    dir: root,
    environment: 'node',
    include: ['tests/identity/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 240_000,
    fileParallelism: false,
    // Machine-readable results and the Keycloak container log for diagnosis (git-ignored).
    reporters: ['default', 'json'],
    outputFile: { json: '../../reports/identity.json' },
  },
});
