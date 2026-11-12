import { expect, test as setup, type Page } from '@playwright/test';
import { LEAD_STATE, STATE } from '../../playwright.config';

/** Signs in through Keycloak once per synthetic user; the tests reuse the sessions. */
async function signIn(page: Page, baseURL: string, username: string, path: string) {
  const password = process.env.KC_DEV_USER_PASSWORD;
  if (!password) throw new Error('KC_DEV_USER_PASSWORD is not set: run `pnpm dev:env`');
  await page.context().addCookies([{ name: 'sit-locale', value: 'en', url: baseURL }]);
  await page.goto('/en/projects');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
  await page.context().storageState({ path });
}

setup(
  'sign in through Keycloak as the synthetic Estimator and QE Lead',
  async ({ page, browser, baseURL, request }) => {
    // Wait for the stack (the dev server may still be compiling or restarting).
    await expect
      .poll(async () => (await request.get('/api/v1/ready').catch(() => null))?.status(), {
        timeout: 120_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toBe(200);
    await signIn(page, baseURL!, 'dev-estimator', STATE);
    // A separate browser context, so the two Keycloak sessions do not mix.
    const lead = await browser.newContext({ baseURL });
    await signIn(await lead.newPage(), baseURL!, 'dev-lead', LEAD_STATE);
    await lead.close();
  },
);
