import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    name: 'web',
    // Server and library tests run in Node; component tests opt into jsdom per file
    // with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['{lib,server,components,app}/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup-dom.ts'],
  },
});
