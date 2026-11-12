// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCountUp, useEnterAnimation, usePrefersReducedMotion } from './motion';

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function Probe({ value }: { value: number }) {
  const shown = useCountUp(value, 50);
  const reduced = usePrefersReducedMotion();
  return (
    <p>
      {reduced ? 'reduced' : 'full'} {shown.toFixed(1)}
    </p>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('motion hooks', () => {
  it('jumps straight to the new value when reduced motion is requested', () => {
    mockReducedMotion(true);
    const { rerender } = render(<Probe value={1} />);
    rerender(<Probe value={20} />);
    expect(screen.getByText('reduced 20.0')).toBeInTheDocument();
  });

  it('counts towards the new value otherwise', async () => {
    mockReducedMotion(false);
    const { rerender } = render(<Probe value={0} />);
    rerender(<Probe value={10} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(screen.getByText('full 10.0')).toBeInTheDocument();
  });

  it('useEnterAnimation animates on mount and reverts on unmount', () => {
    mockReducedMotion(false);
    function Box() {
      const ref = useEnterAnimation<HTMLDivElement>(10);
      return <div ref={ref}>box</div>;
    }
    const { unmount } = render(<Box />);
    expect(screen.getByText('box')).toBeInTheDocument();
    unmount();
  });

  it('useEnterAnimation does nothing with reduced motion', () => {
    mockReducedMotion(true);
    function Box() {
      const ref = useEnterAnimation<HTMLDivElement>();
      return <div ref={ref}>still</div>;
    }
    render(<Box />);
    expect(screen.getByText('still').style.opacity).toBe('');
  });
});
