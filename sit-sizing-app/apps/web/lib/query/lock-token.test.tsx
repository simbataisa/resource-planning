// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetLockToken, lockTokenFor } from '../lock-tokens';
import { useCreateDraft, useCreateEstimate, useSaveVersion } from './hooks';

const api = vi.hoisted(() => ({
  estimates: {
    create: vi.fn(async () => ({ id: 'e1', lockToken: 'tok-new' })),
    createDraft: vi.fn(async () => ({ number: 2, lockToken: 'tok-draft' })),
    saveVersion: vi.fn(async () => ({ number: 2 })),
  },
}));
vi.mock('../api', () => ({ api }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => forgetLockToken('e1'));

describe('Lock token hand-over in this tab', () => {
  it('keeps the token from creating an estimate for the editor', async () => {
    const { result } = renderHook(() => useCreateEstimate('p1'), { wrapper });
    await act(() => result.current.mutateAsync({ name: 'Synthetic' }));
    expect(lockTokenFor('e1')).toBe('tok-new');
  });

  it('keeps the token from starting a draft, and forgets it once the version is saved', async () => {
    const draft = renderHook(() => useCreateDraft('e1'), { wrapper });
    await act(() => draft.result.current.mutateAsync(undefined));
    expect(lockTokenFor('e1')).toBe('tok-draft');
    const save = renderHook(() => useSaveVersion('e1'), { wrapper });
    await act(() => save.result.current.mutateAsync({ lockToken: 'tok-draft' }));
    expect(api.estimates.saveVersion).toHaveBeenCalledWith('e1', {}, 'tok-draft');
    expect(lockTokenFor('e1')).toBeUndefined();
  });
});
