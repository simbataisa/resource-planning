import { expect, test, type Page } from '@playwright/test';
import { OUTSIDER_STATE, VIEWER_STATE } from '../../playwright.config';
import { expectNoAxeViolations } from './helpers';

/**
 * Guided tours (guided-tours spec 6.8). The setup marks every onboarding tour seen; each test
 * resets one tour with `PATCH /me` (a null value removes the key) and opens a fresh page. The
 * first-estimate tour runs as `dev-outsider` in project OTHER, so the DEMO data the other specs
 * rely on is untouched. Specs run one at a time, so the reset cannot race another spec.
 */

const FIRST = 'first-estimate@1';
const READING = 'reading-tour@1';

/** The tour step card: a dialog named by the step title. */
const step = (page: Page, title: string) => page.getByRole('dialog', { name: title });

async function resetTour(page: Page, id: string) {
  const res = await page.request.patch('/api/v1/me', { data: { tours: { [id]: null } } });
  expect(res.status()).toBe(200);
}

async function tourStatus(page: Page, id: string): Promise<string | undefined> {
  const res = await page.request.get('/api/v1/me');
  expect(res.status()).toBe(200);
  const me = (await res.json()) as { tours: Record<string, { status: string } | undefined> };
  return me.tours[id]?.status;
}

/** Waits for the projects list, then checks that no tour step opened over it. */
async function expectNoTour(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
  await expect(page.locator('[data-tour="project-list"]')).toBeVisible();
  // The provider starts a tour as soon as /me loads; give it that moment before checking.
  await page.waitForLoadState('networkidle');
  await expect(step(page, 'Welcome to SIT Sizing')).toBeHidden();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe.serial('guided tours', () => {
  test.describe('first estimate, as the QE Lead of OTHER', () => {
    test.use({ storageState: OUTSIDER_STATE });

    test('walks from the projects list to a saved version 1', async ({ page }) => {
      await resetTour(page, FIRST);
      await page.goto('/en/projects');
      await expect(step(page, 'Welcome to SIT Sizing')).toBeVisible();
      await expectNoAxeViolations(page);
      await step(page, 'Welcome to SIT Sizing').getByRole('button', { name: 'Next' }).click();

      await expect(step(page, 'Open your project')).toBeVisible();
      await page.getByRole('link', { name: /Cards platform/ }).click();

      await expect(step(page, 'Start a new estimate')).toBeVisible();
      await page.getByRole('button', { name: 'New estimate' }).click();

      await expect(step(page, 'Name it and create it')).toBeVisible();
      const create = page.getByRole('dialog', { name: 'New estimate' });
      await create.getByLabel('Name').fill('E2E · Tour first estimate');
      await create.getByRole('button', { name: 'Create estimate' }).click();

      await expect(
        page.getByRole('heading', { level: 1, name: 'E2E · Tour first estimate' }),
      ).toBeVisible();
      for (const title of [
        'Rough scope',
        'Window and team',
        'Rough and detailed side by side',
        'Where the two differ',
        'Autosave and the edit lock',
      ]) {
        await expect(step(page, title)).toBeVisible();
        await step(page, title).getByRole('button', { name: 'Next' }).click();
      }

      await expect(step(page, 'Save a version')).toBeVisible();
      await page.getByRole('button', { name: 'Save version' }).click();
      const save = page.getByRole('dialog', { name: 'Save version 1' });
      await save.getByLabel('Note (optional)').fill('Synthetic E2E tour note');
      await save.getByRole('button', { name: 'Save version' }).click();
      await expect(page.getByText(/Version 1 is saved and cannot change/)).toBeVisible();

      // Recorded when the version is saved, before the Done card is closed.
      const done = step(page, 'Version 1 is saved');
      await expect(done).toBeVisible();
      await expect.poll(() => tourStatus(page, FIRST)).toBe('completed');
      await expect(done.getByRole('button', { name: 'Skip tour' })).toHaveCount(0);
      await done.getByRole('button', { name: 'Finish' }).click();
      await expect(done).toBeHidden();

      await page.goto('/en/projects');
      await expectNoTour(page);
      expect(await tourStatus(page, FIRST)).toBe('completed');
    });

    test('Skip tour closes it for good', async ({ page }) => {
      await resetTour(page, FIRST);
      await page.goto('/en/projects');
      const welcome = step(page, 'Welcome to SIT Sizing');
      await expect(welcome).toBeVisible();
      await welcome.getByRole('button', { name: 'Skip tour' }).click();
      await expect(welcome).toBeHidden();
      await expect.poll(() => tourStatus(page, FIRST)).toBe('skipped');

      await page.reload();
      await expectNoTour(page);
    });

    test('a tour left on another page resumes from the "?" menu', async ({ page }) => {
      await resetTour(page, FIRST);
      await page.goto('/en/projects');
      await step(page, 'Welcome to SIT Sizing').getByRole('button', { name: 'Next' }).click();
      await expect(step(page, 'Open your project')).toBeVisible();

      await page.goto('/en/profiles');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(step(page, 'Open your project')).toBeHidden();

      await page.getByRole('button', { name: 'Tours' }).click();
      await page.getByRole('menuitem', { name: 'Resume tour' }).click();
      await expect(page).toHaveURL(/\/en\/projects$/);
      await expect(step(page, 'Open your project')).toBeVisible();
      await expect(step(page, 'Open your project')).toContainText('2 of 11');
    });
  });

  test.describe('reading tour, as the Viewer of DEMO', () => {
    test.use({ storageState: VIEWER_STATE });

    test('opens on the projects list, with no axe violations', async ({ page }) => {
      await resetTour(page, READING);
      await page.goto('/en/projects');
      const first = step(page, 'Open a project');
      await expect(first).toBeVisible();
      await expect(first).toContainText('1 of 6');
      await expectNoAxeViolations(page);
    });
  });
});
