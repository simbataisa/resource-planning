// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { router } from '@/tests/support/navigation-mock';
import { AppShell } from './app-shell';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);
const updateLocale = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('@/lib/query/hooks', () => ({
  useUpdateLocale: () => updateLocale,
  useNotifications: () => ({ data: { items: [], unread: 0 } }),
  useMe: () => ({ data: undefined }),
  useMarkNotifications: () => ({ read: { mutate: vi.fn() }, readAll: { mutate: vi.fn() } }),
}));

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
    expect(within(screen.getByRole('banner')).getByText('Projects')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Account menu for Synthetic Estimator' }));
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
      await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
      const sheet = screen.getByRole('dialog', { name: 'Main' });
      await user.click(within(sheet).getByRole('link', { name: 'Profiles' }));
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
