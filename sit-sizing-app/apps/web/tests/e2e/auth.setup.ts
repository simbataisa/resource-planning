import { expect, test as setup } from '@playwright/test';
import { STATE } from '../../playwright.config';

/** Signs in once through Keycloak as the synthetic Estimator; the tests reuse the session. */
setup('sign in through Keycloak as the synthetic Estimator', async ({ page, baseURL, request }) => {
  // Wait for the stack (the dev server may still be compiling or restarting).
  await expect
    .poll(async () => (await request.get('/api/v1/ready').catch(() => null))?.status(), {
      timeout: 120_000,
      intervals: [1_000, 2_000, 5_000],
    })
    .toBe(200);
  const password = process.env.KC_DEV_USER_PASSWORD;
  if (!password) throw new Error('KC_DEV_USER_PASSWORD is not set: run `pnpm dev:env`');
  await page.context().addCookies([{ name: 'sit-locale', value: 'en', url: baseURL! }]);
  await page.goto('/en/projects');
  await page.locator('#username').fill('dev-estimator');
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
  await page.context().storageState({ path: STATE });
});
