// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_BREAKPOINT, useIsMobile } from './use-mobile';

const original = window.matchMedia;

afterEach(() => {
  window.matchMedia = original;
});

describe('useIsMobile', () => {
  it('useIsMobile is false without matchMedia', () => {
    // @ts-expect-error -- simulate a browser (or jsdom) without matchMedia
    delete window.matchMedia;
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('follows (max-width: 767px)', () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  });
});
