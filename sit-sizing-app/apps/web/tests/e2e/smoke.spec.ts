import { expect, test } from '@playwright/test';
import { createExampleEstimate, expectNoAxeViolations } from './helpers';

test('the worked example gives the prototype numbers, autosaves, exports and saves a version', async ({
  page,
}) => {
  await createExampleEstimate(page, 'smoke');
  const cards = page.getByRole('region', { name: 'Summary' });
  // The prototype's worked example (golden-example.json): 20.46 and 21.53 FTE.
  await expect(cards).toContainText('20.5');
  await expect(cards).toContainText('21.5');
  await expect(cards).toContainText('3,511 cases');
  await expect(cards).toContainText('4,047 cases');
  await expectNoAxeViolations(page);

  await page.getByRole('spinbutton', { name: 'Quantity' }).first().fill('2');
  await expect(page.getByText('All changes saved')).toBeVisible();
  await expect(cards).toContainText('24.4');
  await page.reload();
  await expect(cards).toContainText('24.4');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export profile' }).click();
  expect((await download).suggestedFilename()).toMatch(/^sit-sizing-e2e-.+-v1\.json$/);

  await page.getByRole('button', { name: 'Save version' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Note (optional)').fill('Synthetic E2E note');
  await dialog.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByText(/Version 1 is saved and cannot change/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit in a new draft' })).toBeVisible();
});

test('content pages, the API reference and the language switch', async ({ page }) => {
  for (const [path, heading] of [
    ['/en/guide', 'How to use this tool'],
    ['/en/method', 'How the estimate is calculated'],
    ['/en/standards', 'Standards and rationale'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expectNoAxeViolations(page);
  }
  await page.goto('/en/guide');
  await page.getByRole('button', { name: 'VI Tiếng Việt' }).click();
  await expect(page).toHaveURL(/\/vi\/guide$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cách sử dụng công cụ' })).toBeVisible();
  await page.getByRole('button', { name: 'EN English' }).click();
  await expect(page).toHaveURL(/\/en\/guide$/);

  const docs = await page.goto('/api/v1/docs');
  expect(docs?.headers()['content-security-policy']).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
  await expect(page).toHaveTitle('SIT Sizing API');
});
