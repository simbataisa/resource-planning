// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { GuidePage, MethodPage, StandardsPage } from './content-pages';

describe('content pages (C-02)', () => {
  it.each(['en', 'vi'] as const)('render the guide with every section (%s)', async (locale) => {
    const { container } = renderWithIntl(<GuidePage />, { locale });
    expect(container.querySelectorAll('ol > li')).toHaveLength(7);
    expect(container.querySelectorAll('dt')).toHaveLength(9);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(13);
    await expectNoAxeViolations(container);
  });

  it('renders the method with the formula block', () => {
    renderWithIntl(<MethodPage />);
    expect(
      screen.getByText(/FTE\s+= \(application \+ data \+ AI \+ performance hours\)/),
    ).toBeInTheDocument();
  });

  it('renders standards with footnotes, external references and the cone note', async () => {
    const { container } = renderWithIntl(<StandardsPage />);
    const footnote = container.querySelector('sup a[href="#ref-1"]');
    expect(footnote).not.toBeNull();
    expect(container.querySelector('#ref-9 a')).toHaveAttribute('target', '_blank');
    expect(container.querySelector('#ref-2 a:nth-of-type(2)')).toHaveAttribute(
      'href',
      'https://www.quality.org/article/test-estimation-techniques',
    );
    expect(screen.getByText(/The rough and detailed ranges are narrower/)).toBeInTheDocument();
    expect(screen.getByText('±40%')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('copies the Biz Case wording, or says how when copying is blocked', async () => {
    renderWithIntl(<StandardsPage />, { locale: 'vi' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const button = screen.getByRole('button', { name: 'Sao chép đoạn văn' });
    await act(async () => fireEvent.click(button));
    expect(writeText.mock.calls[0]![0]).toMatch(/ISO\/IEC\/IEEE 29119-4/);
    writeText.mockRejectedValueOnce(new Error('blocked'));
    await act(async () => fireEvent.click(button));
    expect(screen.getByRole('status').textContent).not.toBe('');
  });

  it('the Method formula scrolls by keyboard when it overflows', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    });
    try {
      const { container } = renderWithIntl(<MethodPage />);
      expect(container.querySelector('pre')).toHaveAttribute('tabindex', '0');
    } finally {
      delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    }
  });
});
