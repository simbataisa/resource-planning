// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@sit/schemas';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { NotificationBell } from './notification-bell';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);

const hooks = vi.hoisted(() => ({ useNotifications: vi.fn(), useMarkNotifications: vi.fn() }));
vi.mock('@/lib/query/hooks', () => hooks);

const NOW = '2026-11-12T07:00:00.000Z';
const items: NotificationItem[] = [
  {
    id: 'n1',
    kind: 'RETURNED',
    payload: {
      actorName: 'Synthetic Lead',
      projectName: 'Synthetic',
      estimateId: 'e1',
      estimateName: 'Onboarding',
      versionNumber: 2,
      note: 'Add the batch interfaces',
    },
    createdAt: NOW,
    readAt: null,
  },
  {
    id: 'n2',
    kind: 'PROFILE_PUBLISHED',
    payload: {
      actorName: 'Synthetic Admin',
      projectName: null,
      profileId: 'pr1',
      profileName: 'Default 2027',
    },
    createdAt: NOW,
    readAt: NOW,
  },
];

let read: { mutate: ReturnType<typeof vi.fn> };
let readAll: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };
beforeEach(() => {
  vi.clearAllMocks();
  read = { mutate: vi.fn() };
  readAll = { mutate: vi.fn(), isPending: false };
  hooks.useMarkNotifications.mockReturnValue({ read, readAll });
});

describe('NotificationBell (N-01)', () => {
  it('shows the unread count and the newest notices', async () => {
    hooks.useNotifications.mockReturnValue({ data: { items, unread: 1 } });
    const { baseElement } = renderWithIntl(<NotificationBell />);
    const bell = screen.getByRole('button', { name: 'Notifications, 1 unread' });
    fireEvent.click(bell);
    const link = screen.getByRole('link', { name: /Synthetic Lead returned Onboarding v2/ });
    expect(link.getAttribute('href')).toBe('/en/estimates/e1');
    expect(link.textContent).toContain('Unread:');
    expect(screen.getByText('Add the batch interfaces')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /published the assumption profile Default 2027 \(global\)/ })
        .getAttribute('href'),
    ).toBe('/en/profiles/pr1');
    await expectNoAxeViolations(baseElement);
  });

  it('marks a notice read when opened, and all read on request', () => {
    hooks.useNotifications.mockReturnValue({ data: { items, unread: 1 } });
    renderWithIntl(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(readAll.mutate).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: /returned Onboarding/ }));
    expect(read.mutate).toHaveBeenCalledWith('n1');
  });

  it('says when there is nothing', () => {
    hooks.useNotifications.mockReturnValue({ data: { items: [], unread: 0 } });
    renderWithIntl(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('No notifications yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
  });
});
