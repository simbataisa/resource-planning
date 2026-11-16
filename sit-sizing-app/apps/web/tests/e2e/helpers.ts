import AxeBuilder from '@axe-core/playwright';
import { expect, type Browser, type Page } from '@playwright/test';
import { LEAD_STATE } from '../../playwright.config';

/** Creates an estimate from the worked example and waits for the editor to take the lock. */
export async function createExampleEstimate(page: Page, label: string): Promise<string> {
  const name = `E2E · ${label} · ${new Date().toISOString().slice(0, 19)}`;
  await page.goto('/en/projects');
  await page.getByRole('link', { name: /Retail lending/ }).click();
  await page.getByRole('button', { name: 'New estimate' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByRole('button', { name: 'Create estimate' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText('All changes saved')).toBeVisible();
  return name;
}

/**
 * axe on the whole page. Colour contrast is checked on the tokens instead (packages/tokens
 * tests), including the approved exception for the TCB-DS red (ADR-0005).
 */
export async function expectNoAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

/** Runs `fn` in a separate browser context signed in as the synthetic QE Lead. */
export async function asLead<T>(browser: Browser, fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ storageState: LEAD_STATE, locale: 'en-GB' });
  try {
    return await fn(await context.newPage());
  } finally {
    await context.close();
  }
}

/** The Version history row of version n. */
export const versionRow = (page: Page, n: number) =>
  page.getByRole('listitem').filter({ has: page.getByText(`v${n}`, { exact: true }) });

/** Saves the open draft as version 1, with a note. */
export async function saveVersion(page: Page, note: string) {
  await page.getByRole('button', { name: 'Save version' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Note (optional)').fill(note);
  await dialog.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByText(/Version 1 is saved and cannot change/)).toBeVisible();
}

/** Estimator submits v1, then the QE Lead approves it from the estimate page. */
export async function submitAndApprove(page: Page, browser: Browser) {
  const url = page.url();
  await versionRow(page, 1).getByRole('button', { name: 'Submit for approval' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(versionRow(page, 1).getByText('Submitted', { exact: true })).toBeVisible();
  await asLead(browser, async (lead) => {
    await lead.goto(url);
    await versionRow(lead, 1).getByRole('button', { name: 'Approve' }).click();
    await lead.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(versionRow(lead, 1).getByText('Approved', { exact: true })).toBeVisible();
  });
  await page.reload();
  await expect(versionRow(page, 1).getByText('Approved', { exact: true })).toBeVisible();
}

/** Assumption groups start collapsed: opens one (e.g. 'effort', 'rules') unless it is open already. */
export async function openAssumptionGroup(page: Page, group: string): Promise<void> {
  const details = page.locator(`#asm-${group}`);
  if ((await details.getAttribute('open')) === null) await details.locator('> summary').click();
  await expect(details).toHaveAttribute('open', '');
}
