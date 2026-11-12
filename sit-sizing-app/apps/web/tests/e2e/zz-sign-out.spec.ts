import { expect, test } from '@playwright/test';

/** Runs last (file order): signing out ends the Keycloak session the other tests reuse. */
test('sign-out ends the session in the app and in Keycloak', async ({ page }) => {
  await page.goto('/en/projects');
  await page.getByRole('link', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'You are signed out' })).toBeVisible();
  expect((await page.request.get('/api/v1/me')).status()).toBe(401);
  await page.goto('/en/projects');
  await expect(page.locator('#username')).toBeVisible(); // back at the Keycloak sign-in form
});
