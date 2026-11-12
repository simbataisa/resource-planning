// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useScrollTabStop } from './use-scroll-tab-stop';

function setWidths(scroll: number, client: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => scroll,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => client,
  });
}

afterEach(() => {
  delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
});

function Box() {
  const { ref, tabIndex } = useScrollTabStop<HTMLDivElement>();
  return (
    <div ref={ref} tabIndex={tabIndex} data-testid="box">
      wide
    </div>
  );
}

describe('useScrollTabStop', () => {
  it('adds no tab stop while the content fits', () => {
    setWidths(400, 400);
    render(<Box />);
    expect(screen.getByTestId('box')).not.toHaveAttribute('tabindex');
  });

  it('makes an overflowing box a tab stop', () => {
    setWidths(900, 400);
    render(<Box />);
    expect(screen.getByTestId('box')).toHaveAttribute('tabindex', '0');
  });

  it('counts only enabled controls: a read-only box with disabled inputs is still a tab stop', () => {
    setWidths(900, 400);
    render(
      <BoxWith>
        <input aria-label="APIs" disabled />
        <button type="button" disabled>
          Remove
        </button>
      </BoxWith>,
    );
    expect(screen.getByTestId('box')).toHaveAttribute('tabindex', '0');
  });

  it('rechecks when its controls become disabled', async () => {
    setWidths(900, 400);
    const { rerender } = render(
      <BoxWith>
        <input aria-label="APIs" />
      </BoxWith>,
    );
    expect(screen.getByTestId('box')).not.toHaveAttribute('tabindex');
    rerender(
      <BoxWith>
        <input aria-label="APIs" disabled />
      </BoxWith>,
    );
    await waitFor(() => expect(screen.getByTestId('box')).toHaveAttribute('tabindex', '0'));
  });

  it('adds no stop when an enabled control can take focus', () => {
    setWidths(900, 400);
    render(
      <BoxWith>
        <input aria-label="APIs" />
      </BoxWith>,
    );
    expect(screen.getByTestId('box')).not.toHaveAttribute('tabindex');
  });
});

function BoxWith({ children }: { children: ReactNode }) {
  const { ref, tabIndex } = useScrollTabStop<HTMLDivElement>();
  return (
    <div ref={ref} tabIndex={tabIndex} data-testid="box">
      {children}
    </div>
  );
}
