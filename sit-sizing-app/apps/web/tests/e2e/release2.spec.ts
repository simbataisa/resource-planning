import ExcelJS from 'exceljs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { LEAD_STATE } from '../../playwright.config';
import { createExampleEstimate, expectNoAxeViolations } from './helpers';

/**
 * Release 2 exit criteria (design 14) through the browser, as two synthetic users:
 * - a QE Lead approves an estimate end to end (V-01), with notices and email (N-01);
 * - a published profile is applied to a new estimate (P-01);
 * - the Excel export matches the on-screen numbers (X-02).
 * Mail is read from the local mail catcher (Mailpit) at E2E_MAILPIT_URL.
 */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

async function asLead<T>(browser: Browser, fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ storageState: LEAD_STATE, locale: 'en-GB' });
  try {
    return await fn(await context.newPage());
  } finally {
    await context.close();
  }
}

/** The Version history row of version n. */
const versionRow = (page: Page, n: number) =>
  page.getByRole('listitem').filter({ has: page.getByText(`v${n}`, { exact: true }) });

async function saveVersion(page: Page, note: string) {
  await page.getByRole('button', { name: 'Save version' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Note (optional)').fill(note);
  await dialog.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByText(/Version 1 is saved and cannot change/)).toBeVisible();
}

test('a QE Lead approves an estimate end to end, with in-app notices and email', async ({
  page,
  browser,
  request,
}) => {
  const name = await createExampleEstimate(page, 'approval');
  const url = page.url();
  await saveVersion(page, 'Synthetic E2E · ready for review');

  // Estimator submits; an Estimator never sees Approve.
  await versionRow(page, 1).getByRole('button', { name: 'Submit for approval' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Note (optional)').fill('Please review the batch interfaces');
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(versionRow(page, 1).getByText('Submitted', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);

  await asLead(browser, async (lead) => {
    // The QE Lead finds the request in the bell and opens it.
    await lead.goto('/en/projects');
    await lead.getByRole('button', { name: /^Notifications, \d+ unread$/ }).click();
    await lead.getByRole('link', { name: new RegExp(`submitted ${escape(name)} v1`) }).click();
    await expect(lead).toHaveURL(url);
    // Wait for the estimate to load before checking the page (the skeleton has no h1).
    await expect(lead.getByRole('heading', { level: 1, name })).toBeVisible();
    await expectNoAxeViolations(lead);
    await versionRow(lead, 1).getByRole('button', { name: 'Approve' }).click();
    dialog = lead.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(versionRow(lead, 1).getByText('Approved', { exact: true })).toBeVisible();
    await expect(versionRow(lead, 1)).toContainText('Approved by Synthetic QE Lead');
  });

  // The author hears back in the app…
  await page.reload();
  await expect(versionRow(page, 1).getByText('Approved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Notifications, \d+ unread$/ }).click();
  await expect(
    page.getByRole('link', { name: new RegExp(`approved ${escape(name)} v1`) }),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  // …and the QE Lead got an email from the worker.
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT}/api/v1/messages`).catch(() => null);
        if (!res?.ok()) return [];
        const box = (await res.json()) as {
          messages: { Subject: string; To: { Address: string }[] }[];
        };
        return box.messages
          .filter((m) => m.Subject === `Approval needed: ${name} v1`)
          .map((m) => m.To[0]?.Address);
      },
      { timeout: 30_000, intervals: [1_000, 2_000] },
    )
    .toEqual(['lead@example.invalid']);
});

test('a published profile is applied to a new estimate', async ({ page, browser }) => {
  const profile = `E2E · profile · ${new Date().toISOString().slice(0, 19)}`;
  await asLead(browser, async (lead) => {
    await lead.goto('/en/profiles');
    await lead.getByRole('button', { name: 'New profile' }).click();
    const dialog = lead.getByRole('dialog');
    await dialog.getByLabel('Name').fill(profile);
    await dialog.getByRole('button', { name: 'Create profile' }).click();
    await expect(lead.getByRole('heading', { level: 1, name: profile })).toBeVisible();
    // Calibrate one value, with its source, then publish.
    const share = lead.getByRole('spinbutton', { name: /^Critical-rule share, rough/ });
    await share.fill('35');
    await share.press('Tab');
    await lead
      .getByRole('textbox', { name: /^Calibration source for Critical-rule share, rough/ })
      .fill('Synthetic SIT cycle 2026-Q3');
    await lead.getByRole('button', { name: 'Save changes' }).click();
    await expect(lead.getByRole('button', { name: 'Publish' })).toBeEnabled();
    await lead.getByRole('button', { name: 'Publish' }).click();
    await lead.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(lead.getByText('Published', { exact: true })).toBeVisible();
    await expectNoAxeViolations(lead);
  });

  // The Estimator starts a new estimate from it.
  const name = `E2E · from profile · ${new Date().toISOString().slice(0, 19)}`;
  await page.goto('/en/projects');
  await page.getByRole('link', { name: /Retail lending/ }).click();
  await page.getByRole('button', { name: 'New estimate' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Assumption profile').selectOption({ label: `${profile} · Project` });
  await dialog.getByRole('button', { name: 'Create estimate' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Summary' })).toContainText('141');
  await page.getByRole('tab', { name: /^Assumptions/ }).click();
  await expect(page.getByText(`Assumptions come from the profile ${profile}.`)).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: /^Critical-rule share, rough/ })).toHaveValue(
    '35',
  );
});

test('the Excel export matches the on-screen numbers', async ({ page }) => {
  await createExampleEstimate(page, 'export');
  const cards = page.getByRole('region', { name: 'Summary' });
  // The worked example (golden-example.json): 20.5 and 21.5 FTE, 3,511 and 4,047 cases.
  await expect(cards).toContainText('21.5');
  await expect(cards).toContainText('4,047 cases');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Excel workbook' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^sit-sizing-e2e-export-.+-v1\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await file.path())!);

  const rows = new Map<string, unknown[]>();
  wb.getWorksheet('Summary')!.eachRow((r) => {
    rows.set(String(r.getCell(1).value), [r.getCell(2).value, r.getCell(3).value]);
  });
  const [roughFte, detailedFte] = rows.get('FTE') as number[];
  expect(roughFte!.toFixed(1)).toBe('20.5');
  expect(detailedFte!.toFixed(1)).toBe('21.5');
  expect(rows.get('Test cases')).toEqual([3511, 4047]);

  const gap = wb.getWorksheet('Gap by group')!;
  const total = gap.getRow(gap.rowCount);
  expect(total.getCell(1).value).toBe('Total');
  expect((total.getCell(2).value as { result: number }).result).toBe(3511);
  expect((total.getCell(3).value as { result: number }).result).toBe(4047);
  // The editor's gap table shows the same totals.
  await expect(page.getByRole('row', { name: /^Total 3,511 4,047/ })).toBeVisible();
});

/** Escapes a name for use inside a RegExp. */
function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
