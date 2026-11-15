import { defineConfig } from 'vitest/config';

// Root runner: every package with its own vitest.config.ts is a project.
// Coverage gates follow design section 13.
export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'apps/*/vitest.config.ts'],
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'reports/junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'cobertura'],
      reportsDirectory: 'coverage',
      include: [
        'packages/*/src/**/*.{ts,tsx}',
        'apps/web/{lib,server,components}/**/*.{ts,tsx}',
        'apps/mcp/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.stories.{ts,tsx}',
        '**/index.ts',
        '**/*.d.ts',
        '**/generated/**',
        'apps/mcp/src/test-support.ts',
      ],
      thresholds: {
        'packages/engine/src/**': { lines: 95, branches: 95 },
        'packages/schemas/src/**': { lines: 90, branches: 90 },
        'apps/web/components/{patterns,features}/**': { lines: 80, branches: 80 },
        'apps/mcp/src/**': { lines: 80, branches: 80 },
      },
    },
  },
});
