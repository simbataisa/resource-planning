// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actuals } from '@sit/schemas';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { ActualsPage } from './actuals-page';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);

const hooks = vi.hoisted(() => ({
  useActuals: vi.fn(),
  useEstimate: vi.fn(),
  useMe: vi.fn(),
  useRecordActuals: vi.fn(),
}));
vi.mock('@/lib/query/hooks', () => hooks);

const ok = <T,>(data: T) => ({ status: 'success' as const, data, error: null, refetch: vi.fn() });
const est = { id: 'u1', displayName: 'Synthetic Estimator', email: 'estimator@example.invalid' };
const NOW = '2026-11-13T07:00:00.000Z';

const cycle: Actuals = {
  id: 'a1',
  versionNumber: 1,
  cycleLabel: 'Synthetic cycle 1',
  data: {
    executedCases: 3900,
    totalHours: 3800,
    executionHours: 1300,
    retestedCases: 780,
    groups: [],
  },
  note: 'Synthetic data',
  recordedBy: est,
  recordedAt: NOW,
  variance: {
    totals: [
      { key: 'cases', estimate: 4047, actual: 3900, delta: -147, pct: -147 / 4047 },
      { key: 'hours', estimate: 3000, actual: 3800, delta: 800, pct: 800 / 3000 },
    ],
    groups: [{ key: 'api.cases', estimate: 196, actual: 180, delta: -16, pct: -16 / 196 }],
    rates: [
      { key: 'minutesPerCase', path: 'minutes', assumption: [10, 20, 40], actual: 20 },
      { key: 'designMinutesPerCase', path: 'designFSD', assumption: 15, actual: null },
      { key: 'retestRate', path: 'retest', assumption: 0.2, actual: 0.2 },
      { key: 'productiveHoursPerDay', path: 'hoursPerDay', assumption: 6, actual: null },
    ],
  },
};

let record: { mutate: ReturnType<typeof vi.fn>; isPending: boolean; isError: boolean; error: null };
let remove: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };

function setup(status: 'APPROVED' | 'SAVED', role: 'ESTIMATOR' | 'VIEWER', items = [cycle]) {
  hooks.useEstimate.mockReturnValue(
    ok({
      id: 'e1',
      projectId: 'p1',
      name: 'Synthetic · Onboarding',
      versions: [{ number: 1, status }],
    }),
  );
  hooks.useMe.mockReturnValue(
    ok({
      ...est,
      globalRole: 'USER',
      locale: 'en',
      memberships: [{ projectId: 'p1', projectKey: 'DEMO', projectName: 'Synthetic', role }],
    }),
  );
  hooks.useActuals.mockReturnValue(ok({ items }));
  return renderWithIntl(<ActualsPage estimateId="e1" number={1} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  record = { mutate: vi.fn(), isPending: false, isError: false, error: null };
  remove = { mutate: vi.fn(), isPending: false };
  hooks.useRecordActuals.mockReturnValue({ record, remove });
});

describe('ActualsPage (P-02)', () => {
  it('shows the variance and the measured rates beside their assumptions', async () => {
    const { container } = setup('APPROVED', 'ESTIMATOR');
    const card = screen.getByRole('region', { name: 'Synthetic cycle 1' });
    expect(within(card).getByRole('row', { name: /^Test cases 4,047 3,900 -4%$/ })).toBeTruthy();
    expect(within(card).getByRole('row', { name: /^Hours 3,000 3,800 \+27%$/ })).toBeTruthy();
    expect(
      within(card).getByRole('row', { name: /API endpoints · Test cases 196 180 -8%/ }),
    ).toBeTruthy();
    expect(
      within(card).getByRole('row', {
        name: /^Execution minutes per case Execution minutes per case.*\(minutes\) 10 \/ 20 \/ 40 20$/,
      }),
    ).toBeTruthy();
    expect(
      within(card).getByRole('row', { name: /^Retest rate .*\(retest\) 20% 20%$/ }),
    ).toBeTruthy();
    expect(within(card).getAllByText('Not measured')).toHaveLength(2);
    await expectNoAxeViolations(container);
  });

  it('records a cycle with the required totals and optional rates and groups', () => {
    setup('APPROVED', 'ESTIMATOR', []);
    const form = screen.getByRole('form', { name: 'Record a cycle' });
    fireEvent.click(within(form).getByRole('button', { name: 'Record cycle' }));
    expect(within(form).getByText('Enter a name for the cycle.')).toBeTruthy();
    fireEvent.change(within(form).getByLabelText('Cycle name'), { target: { value: 'Cycle 2' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Record cycle' }));
    expect(within(form).getByText(/Enter the test cases executed/)).toBeTruthy();
    fireEvent.change(within(form).getByLabelText('Test cases executed'), {
      target: { value: '100' },
    });
    fireEvent.change(within(form).getByLabelText('Total SIT hours'), { target: { value: '90' } });
    fireEvent.change(within(form).getByLabelText('Execution hours (optional)'), {
      target: { value: '30' },
    });
    fireEvent.change(within(form).getByLabelText('Add a group'), { target: { value: 'api' } });
    fireEvent.change(within(form).getByLabelText('Cases'), { target: { value: '12' } });
    fireEvent.change(within(form).getByLabelText('Hours'), { target: { value: '8' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Record cycle' }));
    expect(record.mutate).toHaveBeenCalledWith(
      {
        cycleLabel: 'Cycle 2',
        note: undefined,
        data: {
          executedCases: 100,
          totalHours: 90,
          executionHours: 30,
          groups: [{ group: 'api', cases: 12, hours: 8 }],
        },
      },
      expect.anything(),
    );
  });

  it('asks before removing, and hides recording from Viewers and for unapproved versions', () => {
    const first = setup('APPROVED', 'ESTIMATOR');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove this record' }));
    expect(remove.mutate).toHaveBeenCalledWith('a1');
    first.unmount();

    setup('APPROVED', 'VIEWER');
    expect(screen.queryByRole('form', { name: 'Record a cycle' })).toBeNull();
  });

  it('explains that actuals need an approved version', () => {
    setup('SAVED', 'ESTIMATOR', []);
    expect(screen.getByText(/recorded against an approved version/)).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Record a cycle' })).toBeNull();
  });
});
