import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  asLead,
  createExampleEstimate,
  expectNoAxeViolations,
  openAssumptionGroup,
  saveVersion,
  submitAndApprove,
  versionRow,
} from './helpers';

/**
 * Release 3 exit criteria (design 14) through the browser:
 * - actuals from one SIT cycle are recorded and used to publish a calibrated profile (P-02);
 * - the portfolio totals match the underlying versions (R-01);
 * plus the audit log and project members screens (H-01).
 * The engine flag (E-08) needs a version stored by an older engine; the integration suite
 * covers it by editing the database, which this production-build stack does not expose.
 */
const fte = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

test('actuals from one SIT cycle calibrate a published profile', async ({ page, browser }) => {
  await createExampleEstimate(page, 'actuals');
  await saveVersion(page, 'Synthetic E2E · for actuals');
  await submitAndApprove(page, browser);

  // The Estimator records what the cycle measured.
  const cycle = `Synthetic cycle · ${new Date().toISOString().slice(0, 19)}`;
  await versionRow(page, 1).getByRole('link', { name: 'Actuals' }).click();
  const form = page.getByRole('form', { name: 'Record a cycle' });
  await form.getByLabel('Cycle name').fill(cycle);
  await form.getByLabel('Test cases executed').fill('3900');
  await form.getByLabel('Total SIT hours').fill('3800');
  await form.getByLabel('Execution hours (optional)').fill('1300');
  await form.getByLabel('Cases retested after fixes (optional)').fill('975');
  await form.getByRole('button', { name: 'Record cycle' }).click();
  const card = page.getByRole('region', { name: cycle });
  // The worked example estimates 4,047 detailed cases: 3,900 is 4% fewer.
  await expect(card.getByRole('row', { name: /^Test cases 4,047 3,900 -4%$/ })).toBeVisible();
  // 975 / 3,900 = 25% retests, against the 20% this version assumed.
  await expect(card.getByRole('row', { name: /^Retest rate .*\(retest\) 20% 25%$/ })).toBeVisible();
  await expect(card.getByRole('row', { name: /^Execution minutes per case .* 20$/ })).toBeVisible();
  await expectNoAxeViolations(page);

  // The QE Lead puts the measured rate in a project profile, citing the cycle, and publishes.
  const profile = `E2E · calibrated · ${new Date().toISOString().slice(0, 19)}`;
  await asLead(browser, async (lead) => {
    await lead.goto('/en/profiles');
    await lead.getByRole('button', { name: 'New profile' }).click();
    const dialog = lead.getByRole('dialog');
    await dialog.getByLabel('Name').fill(profile);
    await dialog.getByRole('button', { name: 'Create profile' }).click();
    await expect(lead.getByRole('heading', { level: 1, name: profile })).toBeVisible();
    await openAssumptionGroup(lead, 'effort');
    const retest = lead.getByRole('spinbutton', { name: 'Defect retest rate', exact: true });
    await retest.fill('25');
    await retest.press('Tab');
    await lead
      .getByRole('textbox', { name: 'Calibration source for Defect retest rate', exact: true })
      .fill(cycle);
    await lead.getByRole('button', { name: 'Save changes' }).click();
    await expect(lead.getByRole('button', { name: 'Publish' })).toBeEnabled();
    await lead.getByRole('button', { name: 'Publish' }).click();
    await lead.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(lead.getByText('Published', { exact: true })).toBeVisible();
    // The source stays with the value.
    await openAssumptionGroup(lead, 'effort');
    await expect(
      lead.getByRole('textbox', { name: 'Calibration source for Defect retest rate', exact: true }),
    ).toHaveValue(cycle);
    await lead.goto('/en/profiles');
    await lead.getByLabel('Show').selectOption({ label: 'Global and Synthetic · Retail lending' });
    await expect(
      lead.getByRole('row', { name: new RegExp(`${profile} .* 141 / 142`) }),
    ).toBeVisible();
  });
});

test('the portfolio totals match the underlying versions, on screen and in CSV', async ({
  browser,
}) => {
  await asLead(browser, async (lead) => {
    await lead.goto('/en/portfolio');
    await expect(lead.getByRole('heading', { level: 1, name: 'Portfolio' })).toBeVisible();
    const res = await lead.request.get('/api/v1/portfolio?status=approved');
    expect(res.ok()).toBe(true);
    const p = (await res.json()) as {
      projects: {
        rows: { estimateId: string; versionNumber: number; fte: number; cases: number }[];
      }[];
      total: { estimates: number; fte: number; cases: number };
    };
    const rows = p.projects.flatMap((g) => g.rows);
    expect(rows.length).toBe(p.total.estimates);
    expect(rows.length).toBeGreaterThan(0);
    // Each row is the stored result of that very version…
    for (const r of rows.slice(0, 10)) {
      const v = await (
        await lead.request.get(`/api/v1/estimates/${r.estimateId}/versions/${r.versionNumber}`)
      ).json();
      expect(v.status).toBe('APPROVED');
      expect(v.result.detailed.fte).toBe(r.fte);
      expect(v.result.detailed.cases).toBe(r.cases);
    }
    // …and the total is their sum.
    expect(rows.reduce((s, r) => s + r.fte, 0)).toBeCloseTo(p.total.fte, 9);
    expect(rows.reduce((s, r) => s + r.cases, 0)).toBe(p.total.cases);
    await expect(
      lead.getByRole('row', {
        name: new RegExp(`^Total ${fte(p.total.fte).replace('.', '\\.')} `),
      }),
    ).toBeVisible();
    await expectNoAxeViolations(lead);

    const download = lead.waitForEvent('download');
    await lead.getByRole('link', { name: 'Download CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('sit-sizing-portfolio-approved.csv');
    const lines = readFileSync((await file.path())!, 'utf8')
      .trimEnd()
      .split('\r\n');
    const total = lines.at(-1)!.split(',');
    expect(total[0]).toBe('Total');
    expect(Number(total[9])).toBe(p.total.cases);
  });
});

test('the audit log and project members, for a QE Lead', async ({ browser }) => {
  await asLead(browser, async (lead) => {
    await lead.goto('/en/audit');
    await expect(lead.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
    await lead.getByLabel('Action').selectOption({ label: 'Versions and approvals' });
    await expect(
      lead.getByRole('row', { name: /Synthetic QE Lead estimate\.version\.approve/ }).first(),
    ).toBeVisible();
    await expectNoAxeViolations(lead);

    await lead.goto('/en/projects');
    await lead.getByRole('link', { name: /Retail lending/ }).click();
    const members = lead.getByRole('region', { name: 'Members' });
    await expect(members.getByText('Synthetic QE Lead')).toBeVisible();
    await expect(members.getByRole('button', { name: 'Save members' })).toBeDisabled();
    await expectNoAxeViolations(lead);
  });
});
