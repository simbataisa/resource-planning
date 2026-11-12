import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * L5 E2E (design 13, H-02): Playwright against the running stack with Keycloak.
 * Local: `pnpm dev:up`, then `pnpm test:e2e` (uses your installed Google Chrome; no download).
 * CI: deploy/ci/e2e.sh runs the same suite in the Playwright image against the smoke stack.
 * The synthetic users' password comes from KC_DEV_USER_PASSWORD (the repository .env locally);
 * it is never printed.
 */
if (!process.env.KC_DEV_USER_PASSWORD && existsSync('../../.env'))
  process.loadEnvFile('../../.env');

export const STATE = '../../reports/e2e/.auth/estimator.json';
/** The synthetic QE Lead (release 2: approvals, profiles). */
export const LEAD_STATE = '../../reports/e2e/.auth/lead.json';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: '../../reports/e2e/results',
  reporter: [['list'], ['html', { outputFolder: '../../reports/e2e/html', open: 'never' }]],
  // One shared dev database: run in order, one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  // Visual baselines are per platform; they run in CI's Linux image (E2E_VISUAL=1).
  ...(process.env.E2E_VISUAL ? {} : { grepInvert: /@visual/ }),
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'en-GB',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Your installed Google Chrome locally (no browser download); CI's image has its own.
    ...(process.env.E2E_BROWSER === 'bundled' ? {} : { channel: 'chrome' }),
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.E2E_BROWSER === 'bundled' ? {} : { channel: 'chrome' }),
      },
    },
    {
      name: 'smoke',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.E2E_BROWSER === 'bundled' ? {} : { channel: 'chrome' }),
        storageState: STATE,
      },
    },
  ],
});
