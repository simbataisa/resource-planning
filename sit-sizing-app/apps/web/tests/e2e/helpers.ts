import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

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
