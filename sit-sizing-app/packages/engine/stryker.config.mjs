// Mutation testing for the engine (design 13: mutation score ≥ 70%).
// Run: pnpm --filter @sit/engine mutation   (Jenkins stage "Engine parity and mutation gate")
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  coverageAnalysis: 'perTest',
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
    '!src/defaults.ts',
    '!src/catalogue.ts',
    '!src/types.ts',
    '!src/context.ts',
  ],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: '../../reports/mutation/engine.html' },
  jsonReporter: { fileName: '../../reports/mutation/engine.json' },
  thresholds: { high: 85, low: 75, break: 70 },
  tempDirName: '../../.stryker-tmp/engine',
  concurrency: 4,
};

export default config;
