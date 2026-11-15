// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { router } from '@/tests/support/navigation-mock';
import { AppShell } from './app-shell';
import { NAV_ICONS } from './nav-items';
import { SidebarNavLink } from './sidebar-nav-link';
import { SidebarProvider } from '@/components/ui/sidebar';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);
const updateLocale = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('@/lib/query/hooks', () => ({
  useUpdateLocale: () => updateLocale,
  useNotifications: () => ({ data: { items: [], unread: 0 } }),
  useMe: () => ({
    data: {
      id: 'u1',
      displayName: 'Synthetic Estimator',
      email: 'estimator@example.test',
      globalRole: 'USER',
      locale: 'en',
      memberships: [
        { projectId: 'p1', projectKey: 'DEMO', projectName: 'Demo', role: 'ESTIMATOR' },
      ],
      tours: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: null,
    },
  }),
  useMarkNotifications: () => ({ read: { mutate: vi.fn() }, readAll: { mutate: vi.fn() } }),
}));

// The phone sheet focuses the first button, which opens its tooltip; Radix measures the arrow.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe('AppShell (U-04)', () => {
  it('shows grouped navigation, the account menu and a skip link', async () => {
    const user = userEvent.setup();
    const { container } = renderWithIntl(
      <AppShell userName="Synthetic Estimator">
        <h1>Body</h1>
      </AppShell>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Projects', 'Profiles', 'Guide', 'Method', 'Standards']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('link', { name: 'API reference' })).toHaveAttribute(
      'href',
      '/api/v1/docs',
    );
    expect(within(nav).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByText('Work')).toBeInTheDocument();
    expect(within(nav).getByText('Reference')).toBeInTheDocument();
    // No bar above the page: the toggle and the bell live in the sidebar.
    expect(screen.queryByRole('banner')).toBeNull();
    const sidebar = screen.getByRole('complementary', { name: 'Navigation and account' });
    expect(within(sidebar).getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Tours' })).toHaveAttribute(
      'data-tour',
      'tour-menu',
    );
    // The title is the short brand only.
    expect(within(sidebar).getByRole('link', { name: 'Quality engineering' })).toHaveAttribute(
      'href',
      '/en/projects',
    );
    expect(within(sidebar).queryByText(/SIT Sizing|SIT planning/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    await expectNoAxeViolations(container);
    const account = screen.getByRole('button', { name: 'Account menu for Synthetic Estimator' });
    // Visible text must be part of the accessible name (WCAG 2.5.3): the initial is decorative.
    expect(within(account).getByText('S')).toHaveAttribute('aria-hidden', 'true');
    // Named by its content, not aria-label, so axe's label-content-name-mismatch cannot fire.
    expect(account).not.toHaveAttribute('aria-label');
    expect(sidebar).toContainElement(account);
    await user.click(account);
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveAttribute(
      'href',
      '/api/auth/signout',
    );
  });

  it('signed out shows sign-in and no account menu', () => {
    renderWithIntl(<AppShell userName={null}>x</AppShell>);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/api/auth/signin',
    );
    expect(screen.queryByRole('button', { name: /Account menu/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Notifications/ })).toBeNull();
  });

  it('offers sign-in when nobody is signed in, in Vietnamese', () => {
    renderWithIntl(<AppShell userName={null}>x</AppShell>, { locale: 'vi' });
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
      'href',
      '/api/auth/signin',
    );
  });

  it('choosing a link closes the mobile sheet', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    try {
      const user = userEvent.setup();
      renderWithIntl(<AppShell userName="Synthetic Estimator">x</AppShell>);
      // On a phone the sidebar is hidden, so a slim bar keeps its toggle in reach.
      await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
      const sheet = screen.getByRole('dialog', { name: 'Main' });
      expect(within(sheet).getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
      // The sheet has its own close button, so no second toggle inside it.
      expect(within(sheet).queryByRole('button', { name: 'Toggle sidebar' })).toBeNull();
      await user.click(within(sheet).getByRole('link', { name: 'Profiles' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // The brand link is a link too: choosing it also closes the sheet.
      await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
      await user.click(
        within(screen.getByRole('dialog', { name: 'Main' })).getByRole('link', {
          name: 'Quality engineering',
        }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('switches language, remembering the choice', async () => {
    const user = userEvent.setup();
    renderWithIntl(<AppShell userName="Synthetic Viewer">x</AppShell>);
    expect(screen.getByRole('button', { name: 'EN English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'EN English' }));
    expect(router.replace).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'VI Tiếng Việt' }));
    expect(router.replace).toHaveBeenCalledWith('/projects', { locale: 'vi' });
    expect(document.cookie).toContain('sit-locale=vi');
    expect(updateLocale.mutate).toHaveBeenCalledWith('vi');
  });

  it('opens in the profile language when this browser has not chosen one', () => {
    router.replace.mockClear();
    renderWithIntl(
      <AppShell userName="Synthetic Viewer" profileLocale="vi" localeChosen={false}>
        x
      </AppShell>,
    );
    expect(router.replace).toHaveBeenCalledWith('/projects', { locale: 'vi' });
  });

  it('keeps the browser choice over the profile language', () => {
    router.replace.mockClear();
    renderWithIntl(
      <AppShell userName="Synthetic Viewer" profileLocale="vi" localeChosen>
        x
      </AppShell>,
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('SidebarNavLink tour target', () => {
  it('renders the tour name as data-tour on the link', () => {
    renderWithIntl(
      <SidebarProvider>
        <ul>
          <SidebarNavLink
            href="/projects"
            label="Projects"
            icon={NAV_ICONS.projects}
            active={false}
            tour="nav-projects"
          />
        </ul>
      </SidebarProvider>,
    );
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'data-tour',
      'nav-projects',
    );
  });
});
