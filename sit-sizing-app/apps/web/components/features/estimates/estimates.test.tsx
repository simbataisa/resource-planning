// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { router } from '@/tests/support/navigation-mock';
import { ProjectList } from '../projects/project-list';
import { EstimateList } from './estimate-list';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);

const ok = <T,>(data: T) => ({ status: 'success' as const, data, error: null, refetch: vi.fn() });
const user = { id: 'u1', displayName: 'Synthetic Estimator', email: 'estimator@example.invalid' };
const summary = {
  id: 'v1',
  number: 2,
  status: 'SAVED' as const,
  engineVersion: '1.0.0',
  roughFte: 20.4567,
  detailedFte: 21.5253,
  totalCasesDetailed: 3511,
  uncalibrated: 40,
  note: null,
  createdBy: user,
  createdAt: '2026-11-12T07:00:00.000Z',
  updatedAt: '2026-11-12T07:05:00.000Z',
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
};

const hooks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useProjects: vi.fn(),
  useProject: vi.fn(),
  useEstimates: vi.fn(),
  useCreateEstimate: vi.fn(),
}));
vi.mock('@/lib/query/hooks', () => hooks);

function me(role: 'VIEWER' | 'ESTIMATOR', globalRole: 'USER' | 'ADMIN' = 'USER') {
  return ok({
    ...user,
    globalRole,
    locale: 'en',
    memberships: [{ projectId: 'p1', projectKey: 'DEMO', projectName: 'Synthetic', role }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useProject.mockReturnValue(
    ok({
      id: 'p1',
      key: 'DEMO',
      name: 'Synthetic · Demo',
      description: null,
      archived: false,
      createdAt: summary.createdAt,
      myRole: 'ESTIMATOR',
      members: [],
    }),
  );
  hooks.useCreateEstimate.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
});

describe('ProjectList', () => {
  it('lists projects with the caller role and links to each', async () => {
    hooks.useMe.mockReturnValue(me('ESTIMATOR'));
    hooks.useProjects.mockReturnValue(
      ok({
        items: [
          {
            id: 'p1',
            key: 'DEMO',
            name: 'Synthetic · Demo',
            description: null,
            archived: false,
            createdAt: summary.createdAt,
            myRole: 'ESTIMATOR',
          },
          {
            id: 'p2',
            key: 'OLD',
            name: 'Synthetic · Old',
            description: null,
            archived: true,
            createdAt: summary.createdAt,
            myRole: null,
          },
        ],
        nextCursor: null,
      }),
    );
    const { container } = renderWithIntl(<ProjectList />);
    expect(screen.getByRole('link', { name: 'Synthetic · Demo' })).toHaveAttribute(
      'href',
      '/en/projects/p1',
    );
    expect(screen.getByText('Estimator')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Not a member')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('shows the empty state, the admin description, loading and errors', () => {
    hooks.useMe.mockReturnValue(me('VIEWER', 'ADMIN'));
    hooks.useProjects.mockReturnValue(ok({ items: [], nextCursor: null }));
    const { rerender } = renderWithIntl(<ProjectList />);
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText(/You see every project as an Admin/)).toBeInTheDocument();

    hooks.useProjects.mockReturnValue({
      status: 'pending',
      data: undefined,
      error: null,
      refetch: vi.fn(),
    });
    rerender(<ProjectList />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');

    const refetch = vi.fn();
    hooks.useProjects.mockReturnValue({
      status: 'error',
      data: undefined,
      error: new Error('x'),
      refetch,
    });
    rerender(<ProjectList />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });
});

describe('EstimateList', () => {
  it('shows versions, FTE in the prototype number style and the draft marker', async () => {
    hooks.useMe.mockReturnValue(me('ESTIMATOR'));
    hooks.useEstimates.mockReturnValue(
      ok({
        items: [
          {
            id: 'e1',
            projectId: 'p1',
            name: 'Synthetic · Onboarding',
            description: null,
            archived: false,
            createdBy: user,
            createdAt: summary.createdAt,
            latest: summary,
            hasDraft: true,
          },
          {
            id: 'e2',
            projectId: 'p1',
            name: 'Synthetic · Empty',
            description: null,
            archived: false,
            createdBy: user,
            createdAt: summary.createdAt,
            latest: null,
            hasDraft: false,
          },
        ],
        nextCursor: null,
      }),
    );
    const { container } = renderWithIntl(<EstimateList projectId="p1" />);
    const row = screen.getByRole('row', { name: /Onboarding/ });
    expect(within(row).getByText('v2 · Saved')).toBeInTheDocument();
    expect(within(row).getByText('20.5')).toBeInTheDocument();
    expect(within(row).getByText('21.5')).toBeInTheDocument();
    expect(within(row).getByText('Draft open')).toBeInTheDocument();
    expect(screen.getByText('No version yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New estimate' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('hides "New estimate" from viewers and explains who can create', () => {
    hooks.useMe.mockReturnValue(me('VIEWER'));
    hooks.useEstimates.mockReturnValue(ok({ items: [], nextCursor: null }));
    renderWithIntl(<EstimateList projectId="p1" />);
    expect(screen.queryByRole('button', { name: 'New estimate' })).toBeNull();
    expect(screen.getByText('Estimators of this project can create one.')).toBeInTheDocument();
  });

  it('creates an estimate and opens it', async () => {
    const u = userEvent.setup();
    const mutate = vi.fn((_body, opts: { onSuccess: (e: { id: string }) => void }) =>
      opts.onSuccess({ id: 'e9' }),
    );
    hooks.useCreateEstimate.mockReturnValue({ mutate, isPending: false, isError: false });
    hooks.useMe.mockReturnValue(me('ESTIMATOR'));
    hooks.useEstimates.mockReturnValue(ok({ items: [], nextCursor: null }));
    renderWithIntl(<EstimateList projectId="p1" />);

    await u.click(screen.getByRole('button', { name: 'New estimate' }));
    const dialog = screen.getByRole('dialog', { name: 'New estimate' });
    await u.click(within(dialog).getByRole('button', { name: 'Create estimate' }));
    expect(within(dialog).getByText('Enter a name.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    await u.type(within(dialog).getByLabelText('Name'), '  Synthetic · R3  ');
    await u.click(within(dialog).getByLabelText(/A blank scope/));
    await u.click(within(dialog).getByRole('button', { name: 'Create estimate' }));
    expect(mutate).toHaveBeenCalledWith(
      { name: 'Synthetic · R3', description: undefined, template: 'blank' },
      expect.anything(),
    );
    expect(router.push).toHaveBeenCalledWith('/estimates/e9');
  });

  it('reports a failed create and a missing project', async () => {
    const u = userEvent.setup();
    hooks.useCreateEstimate.mockReturnValue({ mutate: vi.fn(), isPending: true, isError: true });
    hooks.useMe.mockReturnValue(me('ESTIMATOR'));
    hooks.useEstimates.mockReturnValue(ok({ items: [], nextCursor: null }));
    const { rerender } = renderWithIntl(<EstimateList projectId="p1" />);
    await u.click(screen.getByRole('button', { name: 'New estimate' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Something went wrong');
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    const { ApiClientError } = await import('@/lib/http');
    hooks.useProject.mockReturnValue({
      status: 'error',
      data: undefined,
      error: new ApiClientError(404, null, 'nf'),
      refetch: vi.fn(),
    });
    rerender(<EstimateList projectId="p1" />);
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });
});
