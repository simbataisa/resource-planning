// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENGINE_VERSION } from '@sit/engine';
import type { EstimateDetail, Version } from '@sit/schemas';
import { router } from '@/tests/support/navigation-mock';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { EngineNotice, staleEngine } from './engine-notice';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);
const hooks = vi.hoisted(() => ({ useCreateDraft: vi.fn() }));
vi.mock('@/lib/query/hooks', () => hooks);

let createDraft: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };
beforeEach(() => {
  vi.clearAllMocks();
  createDraft = {
    mutate: vi.fn((_n: number, o: { onSuccess: (v: { number: number }) => void }) =>
      o.onSuccess({ number: 3 }),
    ),
    isPending: false,
  };
  hooks.useCreateDraft.mockReturnValue(createDraft);
});

const version = (over: Partial<Version>) =>
  ({ number: 2, status: 'APPROVED', engineVersion: '0.9.0', ...over }) as Version;
const estimate = (statuses: string[]) =>
  ({
    id: 'e1',
    archived: false,
    versions: statuses.map((status, i) => ({ number: i + 1, status })),
  }) as unknown as EstimateDetail;

describe('EngineNotice (E-08)', () => {
  it('flags an older engine and recomputes as a new draft, then opens the comparison', async () => {
    const { container } = renderWithIntl(
      <EngineNotice
        estimate={estimate(['SAVED', 'APPROVED'])}
        version={version({})}
        canCreateDraft
      />,
    );
    expect(screen.getByText('Computed with engine 0.9.0')).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`current engine is ${ENGINE_VERSION.replace(/\./g, '\\.')}`)),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recompute as new draft' }));
    expect(createDraft.mutate).toHaveBeenCalledWith(2, expect.anything());
    expect(router.push).toHaveBeenCalledWith('/estimates/e1/compare?a=2&b=3');
    await expectNoAxeViolations(container);
  });

  it('stays quiet for the current engine and for drafts', () => {
    const { container } = renderWithIntl(
      <>
        <EngineNotice
          estimate={estimate(['APPROVED'])}
          version={version({ engineVersion: ENGINE_VERSION })}
          canCreateDraft
        />
        <EngineNotice
          estimate={estimate(['DRAFT'])}
          version={version({ status: 'DRAFT' })}
          canCreateDraft
        />
      </>,
    );
    expect(container.textContent).toBe('');
    expect(staleEngine(ENGINE_VERSION)).toBe(false);
    expect(staleEngine('0.9.0')).toBe(true);
  });

  it('asks to finish the open draft first, and hides the action without the role', () => {
    const { unmount } = renderWithIntl(
      <EngineNotice
        estimate={estimate(['APPROVED', 'DRAFT'])}
        version={version({ number: 1 })}
        canCreateDraft
      />,
    );
    expect(screen.getByText(/Finish or save the open draft first/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    renderWithIntl(
      <EngineNotice
        estimate={estimate(['APPROVED'])}
        version={version({ number: 1 })}
        canCreateDraft={false}
      />,
    );
    expect(screen.getByText('Computed with engine 0.9.0')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
