import { expect, test } from '@playwright/test';
import { createExampleEstimate } from './helpers';

/** Visual regression on the summary cards and the gap table (design 13). Linux CI baselines. */
test('summary cards and gap table look as approved @visual', async ({ page }) => {
  await createExampleEstimate(page, 'visual');
  await expect(page.getByRole('region', { name: 'Summary' })).toHaveScreenshot('summary-cards.png');
  const gap = page.locator('section', {
    has: page.getByRole('heading', { name: 'Where the two estimates differ' }),
  });
  await expect(gap).toHaveScreenshot('gap-table.png');
});
