// @vitest-environment jsdom
import { screen } from '@testing-library/react';
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

describe('AppShell (U-04)', () => {
  it('shows navigation, the user and sign-out, with a skip link', async () => {
    const { container } = renderWithIntl(
      <AppShell userName="Synthetic Estimator">
        <h1>Body</h1>
      </AppShell>,
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByText('Signed in as Synthetic Estimator')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign out' })).toHaveAttribute(
      'href',
      '/api/auth/signout',
    );
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    await expectNoAxeViolations(container);
  });

  it('offers sign-in when nobody is signed in, in Vietnamese', () => {
    renderWithIntl(<AppShell userName={null}>x</AppShell>, { locale: 'vi' });
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
      'href',
      '/api/auth/signin',
    );
  });

  it('switches language, remembering the choice', async () => {
    const user = userEvent.setup();
    renderWithIntl(<AppShell userName="Synthetic Viewer">x</AppShell>);
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(router.replace).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Tiếng Việt' }));
    expect(router.replace).toHaveBeenCalledWith('/projects', { locale: 'vi' });
    expect(document.cookie).toContain('sit-locale=vi');
  });
});
