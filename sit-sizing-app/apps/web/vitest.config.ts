import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    name: 'web',
    // Component tests (jsdom + Testing Library) are added with the component base in step 1.4.
    environment: 'node',
    include: ['{lib,server,components,app}/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
  },
});
