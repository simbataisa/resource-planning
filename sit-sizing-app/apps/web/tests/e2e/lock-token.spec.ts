import { expect, test } from '@playwright/test';
import { STATE } from '../../playwright.config';
import { createExampleEstimate } from './helpers';

/**
 * Draft lock token (draft lock token design): the same user opens one draft in two tabs. Only
 * the tab that holds the lock token edits; "Open here instead" moves editing, and the first
 * tab keeps its unsaved values in recovery. Synthetic data only.
 */
test('one draft in two tabs: open elsewhere, "Open here instead", and recovery in the first tab', async ({
  page,
  browser,
}) => {
  await createExampleEstimate(page, 'lock token');
  const url = page.url();
  const quantity = (p: typeof page) => p.getByRole('spinbutton', { name: 'Quantity' }).first();

  const second = await browser.newContext({ storageState: STATE, locale: 'en-GB' });
  try {
    const tab2 = await second.newPage();
    await tab2.goto(url);
    await expect(
      tab2.getByText('This draft is open in another tab or in the assistant.'),
    ).toBeVisible();
    await expect(quantity(tab2)).toBeDisabled();

    await tab2.getByRole('button', { name: 'Open here instead' }).click();
    await expect(quantity(tab2)).toBeEnabled();
    await expect(tab2.getByText('All changes saved')).toBeVisible();

    // The first tab's next autosave is refused: recovery keeps its value on the page.
    await quantity(page).fill('3');
    await expect(page.getByText(/Your unsaved values are kept on this page/)).toBeVisible();
    await expect(quantity(page)).toBeDisabled();
    await expect(quantity(page)).toHaveValue('3');
    await expect(
      page.getByRole('button', { name: 'Download my unsaved values (JSON)' }),
    ).toBeVisible();

    // Nothing changed meanwhile, so taking it back carries on with the unsaved value.
    await page.getByRole('button', { name: 'Open here instead' }).click();
    await expect(quantity(page)).toBeEnabled();
    await expect(page.getByText('All changes saved')).toBeVisible();
    await page.reload();
    await expect(quantity(page)).toHaveValue('3');
    await expect(quantity(page)).toBeEnabled();
  } finally {
    await second.close();
  }
});
