// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser, AuditEventItem, ProjectDetail } from '@sit/schemas';
import { ApiClientError } from '@/lib/http';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { AdminNavLinks } from './admin-nav';
import { AuditPage } from './audit-page';
import { MembersPanel } from './members-panel';
import { UsersPage } from './users-page';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);
const hooks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useProjects: vi.fn(),
  useAudit: vi.fn(),
  useUsers: vi.fn(),
  useSetUserActive: vi.fn(),
  usePutMembers: vi.fn(),
}));
vi.mock('@/lib/query/hooks', () => hooks);

const ok = <T,>(data: T) => ({ status: 'success' as const, data, error: null, refetch: vi.fn() });
const infinite = <T,>(items: T[]) => ({
  ...ok({ pages: [{ items, nextCursor: null }] }),
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
});
const NOW = '2026-11-13T07:00:00.000Z';
const lead = { id: 'u2', displayName: 'Synthetic QE Lead', email: 'lead@example.invalid' };
const est = { id: 'u3', displayName: 'Synthetic Estimator', email: 'estimator@example.invalid' };

function me(globalRole: 'USER' | 'ADMIN', role: 'QE_LEAD' | 'ESTIMATOR' = 'QE_LEAD') {
  return ok({
    id: globalRole === 'ADMIN' ? 'u1' : lead.id,
    displayName: 'Synthetic',
    email: 'x@example.invalid',
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
        { id: 'p1', key: 'DEMO', name: 'Synthetic · Retail' },
        { id: 'p2', key: 'PAY', name: 'Synthetic · Payments' },
      ],
    }),
  );
});

describe('AuditPage (H-01)', () => {
  const event: AuditEventItem = {
    id: 'a1',
    at: NOW,
    actor: lead,
    action: 'estimate.version.approve',
    entity: 'EstimateVersion',
    entityId: 'v1',
    project: { id: 'p1', key: 'DEMO', name: 'Synthetic · Retail' },
    detail: { number: 2, to: 'APPROVED' },
    requestId: 'r1',
  };

  it('shows a QE Lead the events of a project they lead, with filters', async () => {
    hooks.useMe.mockReturnValue(me('USER'));
    hooks.useAudit.mockReturnValue(infinite([event]));
    const { container } = renderWithIntl(<AuditPage />);
    expect(hooks.useAudit).toHaveBeenLastCalledWith({
      projectId: 'p1',
      action: undefined,
      from: undefined,
      to: undefined,
    });
    expect(screen.queryByRole('option', { name: 'All projects and global events' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Synthetic · Payments' })).toBeNull();
    expect(
      screen.getByRole('row', { name: /Synthetic QE Lead estimate\.version\.approve DEMO/ }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'actuals.' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } });
    expect(hooks.useAudit).toHaveBeenLastCalledWith({
      projectId: 'p1',
      action: 'actuals.',
      from: '2026-11-01',
      to: undefined,
    });
    await expectNoAxeViolations(container);
  });

  it('lets an Admin see everything, and explains the page to others', () => {
    hooks.useMe.mockReturnValue(me('ADMIN'));
    hooks.useAudit.mockReturnValue(infinite([]));
    const { unmount } = renderWithIntl(<AuditPage />);
    expect(hooks.useAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: undefined }),
    );
    expect(screen.getByText('No events')).toBeTruthy();
    unmount();
    hooks.useMe.mockReturnValue(me('USER', 'ESTIMATOR'));
    renderWithIntl(<AuditPage />);
    expect(screen.getByText(/for QE Leads \(their projects\) and Admins/)).toBeTruthy();
  });
});

describe('UsersPage (H-01)', () => {
  const user = (over: Partial<AdminUser>): AdminUser => ({
    ...est,
    globalRole: 'USER',
    active: true,
    createdAt: NOW,
    lastLoginAt: NOW,
    memberships: [{ projectId: 'p1', projectKey: 'DEMO', role: 'ESTIMATOR' }],
    ...over,
  });
  let setActive: { mutate: ReturnType<typeof vi.fn>; isPending: boolean; isError: boolean };

  beforeEach(() => {
    setActive = { mutate: vi.fn(), isPending: false, isError: false };
    hooks.useSetUserActive.mockReturnValue(setActive);
  });

  it('lists users with roles read-only, and deactivates after confirming', async () => {
    hooks.useMe.mockReturnValue(me('ADMIN'));
    hooks.useUsers.mockReturnValue(
      infinite([user({}), user({ id: 'u1', displayName: 'Synthetic Admin', globalRole: 'ADMIN' })]),
    );
    const { container } = renderWithIntl(<UsersPage />);
    expect(screen.getByText(/the group sit-sizing-admins there/)).toBeTruthy();
    const row = screen.getByRole('row', { name: /Synthetic Estimator/ });
    expect(row.textContent).toContain('DEMO · Estimator');
    expect(
      within(screen.getByRole('row', { name: /Synthetic Admin/ })).getByText('You'),
    ).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Deactivate' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Deactivate Synthetic Estimator' }));
    expect(setActive.mutate).toHaveBeenCalledWith({ id: 'u3', active: false }, expect.anything());
    await expectNoAxeViolations(container);
  });

  it('is for Admins only', () => {
    hooks.useMe.mockReturnValue(me('USER'));
    hooks.useUsers.mockReturnValue(infinite([]));
    renderWithIntl(<UsersPage />);
    expect(screen.getByText('Only Admins can manage users.')).toBeTruthy();
  });
});

describe('MembersPanel (H-01)', () => {
  const project = {
    id: 'p1',
    members: [
      { user: lead, role: 'QE_LEAD', addedAt: NOW },
      { user: est, role: 'ESTIMATOR', addedAt: NOW },
    ],
  } as unknown as ProjectDetail;
  let put: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };
  beforeEach(() => {
    put = { mutate: vi.fn(), isPending: false };
    hooks.usePutMembers.mockReturnValue(put);
  });

  it('changes roles, adds and removes people, then saves the whole list', async () => {
    const { container } = renderWithIntl(<MembersPanel project={project} canManage />);
    fireEvent.change(screen.getByLabelText('Project role for Synthetic Estimator'), {
      target: { value: 'QE_LEAD' },
    });
    fireEvent.change(screen.getByLabelText('Work e-mail'), {
      target: { value: 'Viewer@Example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'VIEWER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Synthetic QE Lead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save members' }));
    expect(put.mutate).toHaveBeenCalledWith(
      [
        { email: 'estimator@example.invalid', role: 'QE_LEAD' },
        { email: 'viewer@example.invalid', role: 'VIEWER' },
      ],
      expect.anything(),
    );
    await expectNoAxeViolations(container);
  });

  it('keeps a QE Lead, rejects bad e-mails and names people who have not signed in', () => {
    put.mutate.mockImplementation((_m, o: { onError: (e: unknown) => void }) =>
      o.onError(
        new ApiClientError(
          422,
          {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Some people have not signed in yet.',
              details: [{ email: 'new@example.invalid' }],
            },
          },
          'x',
        ),
      ),
    );
    renderWithIntl(<MembersPanel project={project} canManage />);
    fireEvent.change(screen.getByLabelText('Work e-mail'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Enter a work e-mail address.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Synthetic QE Lead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save members' }));
    expect(screen.getByText('Keep at least one QE Lead.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    fireEvent.change(screen.getByLabelText('Work e-mail'), {
      target: { value: 'new@example.invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save members' }));
    expect(screen.getByText(/have not signed in yet: new@example\.invalid/)).toBeTruthy();
  });

  it('is read-only without the role', () => {
    renderWithIntl(<MembersPanel project={project} canManage={false} />);
    expect(screen.getByText('Synthetic Estimator')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

describe('AdminNavLinks', () => {
  it('shows the audit log to QE Leads and users to Admins only', () => {
    hooks.useMe.mockReturnValue(me('USER'));
    const { unmount } = renderWithIntl(<AdminNavLinks />);
    expect(screen.getByRole('link', { name: 'Audit log' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
    unmount();
    hooks.useMe.mockReturnValue(me('ADMIN', 'ESTIMATOR'));
    const second = renderWithIntl(<AdminNavLinks />);
    expect(screen.getByRole('link', { name: 'Users' }).getAttribute('href')).toBe(
      '/en/admin/users',
    );
    second.unmount();
    hooks.useMe.mockReturnValue(me('USER', 'ESTIMATOR'));
    renderWithIntl(<AdminNavLinks />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
