import { expect, test as setup, type Page } from '@playwright/test';
import { LEAD_STATE, OUTSIDER_STATE, STATE, VIEWER_STATE } from '../../playwright.config';

/** Onboarding tours marked seen for every E2E user, so no tour opens over the screens tested. */
const TOURS_SEEN = {
  tours: {
    'first-estimate@1': { status: 'completed' },
    'first-estimate-admin@1': { status: 'completed' },
    'reading-tour@1': { status: 'completed' },
  },
};

/**
 * Signs in through Keycloak once per synthetic user; the tests reuse the sessions. The welcome
 * card may open over the page before the tours are marked seen; nothing here clicks it.
 */
async function signIn(page: Page, baseURL: string, username: string, path: string) {
  const password = process.env.KC_DEV_USER_PASSWORD;
  if (!password) throw new Error('KC_DEV_USER_PASSWORD is not set: run `pnpm dev:env`');
  await page.context().addCookies([{ name: 'sit-locale', value: 'en', url: baseURL }]);
  await page.goto('/en/projects');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
  const seen = await page.request.patch('/api/v1/me', { data: TOURS_SEEN });
  expect(seen.status()).toBe(200);
  await page.context().storageState({ path });
}

setup(
  'sign in through Keycloak as the synthetic Estimator, QE Leads and Viewer',
  async ({ page, browser, baseURL, request }) => {
    // Wait for the stack (the dev server may still be compiling or restarting).
    await expect
      .poll(async () => (await request.get('/api/v1/ready').catch(() => null))?.status(), {
        timeout: 120_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toBe(200);
    await signIn(page, baseURL!, 'dev-estimator', STATE);
    // A separate browser context per user, so the Keycloak sessions do not mix.
    for (const [username, path] of [
      ['dev-lead', LEAD_STATE],
      ['dev-outsider', OUTSIDER_STATE],
      ['dev-viewer', VIEWER_STATE],
    ] as const) {
      const context = await browser.newContext({ baseURL });
      await signIn(await context.newPage(), baseURL!, username, path);
      await context.close();
    }
  },
);
