// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Portfolio, PortfolioRow } from '@sit/schemas';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { InSidebar } from '@/tests/support/sidebar';
import { PortfolioNavItem, PortfolioPage } from './portfolio-page';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);

const hooks = vi.hoisted(() => ({ useMe: vi.fn(), useProjects: vi.fn(), usePortfolio: vi.fn() }));
vi.mock('@/lib/query/hooks', () => hooks);

const ok = <T,>(data: T) => ({ status: 'success' as const, data, error: null, refetch: vi.fn() });

const row = (over: Partial<PortfolioRow>): PortfolioRow => ({
  projectId: 'p1',
  projectKey: 'DEMO',
  projectName: 'Synthetic · Retail',
  estimateId: 'e1',
  estimateName: 'Onboarding',
  versionNumber: 2,
  status: 'APPROVED',
  approvedAt: '2026-11-13T07:00:00.000Z',
  profileName: 'Default (uncalibrated)',
  engineVersion: '1.0.0',
  fte: 21.53,
  lo: 18.3,
  hi: 24.76,
  cases: 4047,
  hours: 3680.8,
  roughFte: 20.46,
  uncalibrated: 142,
  ...over,
});
const rows = [
  row({}),
  row({
    estimateId: 'e2',
    estimateName: 'Cards',
    fte: 8.2,
    lo: 7,
    hi: 9.4,
    cases: 1200,
    hours: 1400,
    roughFte: 9,
    uncalibrated: 120,
  }),
];
const sum = {
  estimates: 2,
  fte: 29.73,
  lo: 25.3,
  hi: 34.16,
  cases: 5247,
  hours: 5080.8,
  roughFte: 29.46,
  onDefaults: 1,
};
const data: Portfolio = {
  status: 'approved',
  projects: [
    { projectId: 'p1', projectKey: 'DEMO', projectName: 'Synthetic · Retail', rows, subtotal: sum },
  ],
  total: sum,
  assumptionRows: 142,
};

function me(role: 'QE_LEAD' | 'ESTIMATOR', globalRole: 'USER' | 'ADMIN' = 'USER') {
  return ok({
    id: 'u1',
    displayName: 'Synthetic Lead',
    email: 'lead@example.invalid',
    globalRole,
    locale: 'en',
    memberships: [{ projectId: 'p1', projectKey: 'DEMO', projectName: 'Synthetic', role }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useProjects.mockReturnValue(
    ok({
      items: [
        { id: 'p1', key: 'DEMO', name: 'Synthetic · Retail', archived: false },
        { id: 'p2', key: 'PAY', name: 'Synthetic · Payments', archived: false },
      ],
    }),
  );
  hooks.usePortfolio.mockReturnValue(ok(data));
});

describe('PortfolioPage (R-01)', () => {
  it('shows each estimate, the subtotal and the total, with calibration', async () => {
    hooks.useMe.mockReturnValue(me('QE_LEAD'));
    const { container } = renderWithIntl(<PortfolioPage />);
    expect(
      screen.getByRole('row', {
        name: /^Onboarding v2 Approved Default \(uncalibrated\) 142 \/ 142 21\.5 18\.3 – 24\.8 4,047 3,681 20\.5$/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('row', {
        name: /^Subtotal · Synthetic · Retail 29\.7 25\.3 – 34\.2 5,247 5,081 29\.5$/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('row', { name: /^Total 29\.7 25\.3 – 34\.2 5,247 5,081 29\.5$/ }),
    ).toBeTruthy();
    const totals = screen.getByRole('region', { name: 'Portfolio totals' });
    expect(totals.textContent).toContain('Using calibrated values');
    expect(totals.textContent).toContain('of 2');
    expect(screen.getByRole('link', { name: 'Download CSV' }).getAttribute('href')).toBe(
      '/api/v1/portfolio/export?status=approved&lang=en',
    );
    await expectNoAxeViolations(container);
  });

  it('filters by status and project and passes them to the query and the CSV', () => {
    hooks.useMe.mockReturnValue(me('QE_LEAD', 'ADMIN'));
    renderWithIntl(<PortfolioPage />);
    fireEvent.change(screen.getByLabelText('Versions'), { target: { value: 'latest' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic · Payments' }));
    expect(hooks.usePortfolio).toHaveBeenLastCalledWith({ status: 'latest', projectIds: ['p2'] });
    expect(screen.getByRole('link', { name: 'Download CSV' }).getAttribute('href')).toBe(
      '/api/v1/portfolio/export?status=latest&lang=en&projectIds=p2',
    );
  });

  it('explains when there is nothing to roll up', () => {
    hooks.useMe.mockReturnValue(me('QE_LEAD'));
    hooks.usePortfolio.mockReturnValue(
      ok({ ...data, projects: [], total: { ...sum, estimates: 0 } }),
    );
    renderWithIntl(<PortfolioPage />);
    expect(screen.getByText('Nothing to roll up yet')).toBeTruthy();
  });

  it('is for QE Leads and Admins; the sidebar item follows the same rule', () => {
    hooks.useMe.mockReturnValue(me('ESTIMATOR'));
    const { unmount } = renderWithIntl(
      <>
        <PortfolioPage />
        <InSidebar menu>
          <PortfolioNavItem active={false} />
        </InSidebar>
      </>,
    );
    expect(screen.getByText('The portfolio is for QE Leads and Admins.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Portfolio' })).toBeNull();
    unmount();
    hooks.useMe.mockReturnValue(me('QE_LEAD'));
    renderWithIntl(
      <InSidebar menu>
        <PortfolioNavItem active />
      </InSidebar>,
    );
    const link = screen.getByRole('link', { name: 'Portfolio' });
    expect(link.getAttribute('href')).toBe('/en/portfolio');
    expect(link).toHaveAttribute('aria-current', 'page');
  });
});
