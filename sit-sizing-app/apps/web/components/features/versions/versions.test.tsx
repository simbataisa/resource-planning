// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EstimateDetail, Version, VersionSummary } from '@sit/schemas';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { VersionComparePage } from './version-compare';
import { VersionHistory } from './version-history';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);

const hooks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useReviewVersion: vi.fn(),
  useCreateDraft: vi.fn(),
  useCompare: vi.fn(),
}));
vi.mock('@/lib/query/hooks', () => hooks);

const ok = <T,>(data: T) => ({ status: 'success' as const, data, error: null, refetch: vi.fn() });
const est = { id: 'u1', displayName: 'Synthetic Estimator', email: 'estimator@example.invalid' };
const lead = { id: 'u2', displayName: 'Synthetic Lead', email: 'lead@example.invalid' };
const NOW = '2026-11-12T07:00:00.000Z';

function summary(number: number, over: Partial<VersionSummary> = {}): VersionSummary {
  return {
    id: `v${number}`,
    number,
    status: 'SAVED',
    engineVersion: '1.0.0',
    roughFte: 20.5,
    detailedFte: 21.5,
    totalCasesDetailed: 4047,
    uncalibrated: 142,
    note: null,
    createdBy: est,
    createdAt: NOW,
    updatedAt: NOW,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    ...over,
  };
}

function render(versions: VersionSummary[], who: typeof est, role: 'ESTIMATOR' | 'QE_LEAD') {
  hooks.useMe.mockReturnValue(
    ok({
      ...who,
      globalRole: 'USER',
      locale: 'en',
      memberships: [{ projectId: 'p1', projectKey: 'DEMO', projectName: 'Synthetic', role }],
    }),
  );
  const estimate = {
    id: 'e1',
    projectId: 'p1',
    name: 'Synthetic · Onboarding',
    description: null,
    archived: false,
    createdBy: est,
    createdAt: NOW,
    latest: versions[0],
    hasDraft: versions.some((v) => v.status === 'DRAFT'),
    versions,
    draftLock: null,
  } as unknown as EstimateDetail;
  const open = { ...versions[0], reviews: [] } as unknown as Version;
  return renderWithIntl(<VersionHistory estimate={estimate} open={open} />);
}

let review: { mutate: ReturnType<typeof vi.fn>; isPending: boolean; isError: boolean };
let createDraft: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };
beforeEach(() => {
  vi.clearAllMocks();
  review = { mutate: vi.fn(), isPending: false, isError: false };
  createDraft = { mutate: vi.fn(), isPending: false };
  hooks.useReviewVersion.mockReturnValue(review);
  hooks.useCreateDraft.mockReturnValue(createDraft);
});

describe('VersionHistory', () => {
  it('lets an Estimator submit a saved version with an optional note', () => {
    render([summary(2), summary(1, { status: 'APPROVED' })], est, 'ESTIMATOR');
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Ready' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(review.mutate).toHaveBeenCalledWith(
      { number: 2, action: 'submit', note: 'Ready' },
      expect.anything(),
    );
  });

  it('requires a note to return a version', () => {
    render(
      [summary(1, { status: 'SUBMITTED', submittedBy: est, submittedAt: NOW })],
      lead,
      'QE_LEAD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Return with a note' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(review.mutate).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Enter what should change.')).toBeTruthy();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Fix counts' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(review.mutate).toHaveBeenCalledWith(
      { number: 1, action: 'return', note: 'Fix counts' },
      expect.anything(),
    );
  });

  it('disables Approve for the author or submitter and says why', () => {
    render(
      [summary(1, { status: 'SUBMITTED', createdBy: lead, submittedBy: lead, submittedAt: NOW })],
      lead,
      'QE_LEAD',
    );
    expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(/another QE Lead must approve/i)).toBeTruthy();
  });

  it('restores an older version as a new draft and links to compare', async () => {
    const { container } = render([summary(2), summary(1)], est, 'ESTIMATOR');
    fireEvent.click(screen.getAllByRole('button', { name: 'Restore as new draft' })[1]!);
    expect(createDraft.mutate).toHaveBeenCalledWith(1);
    expect(screen.getByRole('link', { name: 'Compare' }).getAttribute('href')).toBe(
      '/en/estimates/e1/compare?a=1&b=2',
    );
    await expectNoAxeViolations(container);
  });
});

describe('VersionComparePage', () => {
  it('shows results, groups and changed values', async () => {
    const fig = (fte: number) => ({ fte, cases: 4000, hours: 3000 });
    hooks.useCompare.mockReturnValue(
      ok({
        a: summary(1),
        b: summary(2),
        results: {
          rough: { a: fig(20), b: fig(20) },
          detailed: { a: fig(21), b: fig(22.5) },
        },
        groups: [{ group: 'fieldFE', aCases: 100, bCases: 120, aHours: 10, bHours: 12 }],
        changes: [{ area: 'inputs', path: 'team.weeks', a: 10, b: 12 }],
        truncated: false,
      }),
    );
    const { container } = renderWithIntl(<VersionComparePage estimateId="e1" a={1} b={2} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Version 1 compared with 2');
    expect(screen.getByText('team.weeks')).toBeTruthy();
    expect(screen.getByText('+20')).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
