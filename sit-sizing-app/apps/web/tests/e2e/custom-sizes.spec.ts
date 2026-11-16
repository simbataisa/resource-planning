import { expect, test, type Page } from '@playwright/test';
import { asLead, createExampleEstimate, expectNoAxeViolations } from './helpers';

/**
 * Custom feature sizes (ADR-0021) through the browser, as two synthetic users: a QE Lead edits
 * the sizes of a draft profile and publishes it; an Estimator gets those sizes, and applying a
 * profile that lacks a size their features use is refused with an explanation.
 */
const stamp = () => new Date().toISOString().slice(0, 19);

/** As the QE Lead: a new project profile with `edit` applied to its sizes, then published. */
async function publishProfile(
  lead: Page,
  name: string,
  edit: (sizes: ReturnType<Page['getByRole']>) => Promise<void>,
) {
  await lead.goto('/en/profiles');
  await lead.getByRole('button', { name: 'New profile' }).click();
  const dialog = lead.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByRole('button', { name: 'Create profile' }).click();
  await expect(lead.getByRole('heading', { level: 1, name })).toBeVisible();
  const sizes = lead.getByRole('region', { name: 'Feature sizes' });
  await edit(sizes);
  await lead.getByRole('button', { name: 'Save changes' }).click();
  await expect(lead.getByRole('button', { name: 'Publish' })).toBeEnabled();
  await lead.getByRole('button', { name: 'Publish' }).click();
  await lead.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(lead.getByText('Published', { exact: true })).toBeVisible();
}

test('a QE Lead adds a size to a profile and an Estimator gets it', async ({ page, browser }) => {
  const profile = `E2E · sizes · ${stamp()}`;
  await asLead(browser, async (lead) => {
    await publishProfile(lead, profile, async (sizes) => {
      await sizes.getByLabel('Size name').fill('XS2');
      await sizes.getByLabel('Copy from').selectOption('XS');
      await sizes.getByRole('button', { name: 'Add size' }).click();
      // The new size is in the list (it is also offered in "Copy from").
      await expect(sizes.getByRole('listitem').getByText('XS2', { exact: true })).toBeVisible();
    });
    await expectNoAxeViolations(lead);
  });

  const name = `E2E · custom size · ${stamp()}`;
  await page.goto('/en/projects');
  await page.getByRole('link', { name: /Retail lending/ }).click();
  await page.getByRole('button', { name: 'New estimate' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Assumption profile').selectOption({ label: `${profile} · Project` });
  await dialog.getByRole('button', { name: 'Create estimate' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  const picker = page.getByRole('combobox', { name: /Size/ }).first();
  await expect(picker.locator('option', { hasText: /^XS2$/ })).toHaveCount(1);
});

test('applying a profile without a size the features use is refused', async ({ page, browser }) => {
  const profile = `E2E · no L · ${stamp()}`;
  await asLead(browser, (lead) =>
    publishProfile(lead, profile, async (sizes) => {
      await sizes.getByRole('button', { name: 'Remove L', exact: true }).click();
      await lead.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
      await expect(sizes.getByText('L', { exact: true })).toHaveCount(0);
    }),
  );

  // The worked example has two features of size L.
  await createExampleEstimate(page, 'blocked apply');
  await page.getByRole('tab', { name: /^Assumptions/ }).click();
  await page.getByLabel('Apply a published profile').selectOption({ label: profile });
  await page.getByRole('button', { name: 'Apply profile' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Apply profile' }).click();
  await expect(
    page.getByText("2 features use L, which this profile doesn't have. Resize them first."),
  ).toBeVisible();
});
