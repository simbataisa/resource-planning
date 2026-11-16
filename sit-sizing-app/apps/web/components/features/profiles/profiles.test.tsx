// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from '@sit/engine';
import type { Assumptions, EstimateInputs, ProfileDetail } from '@sit/schemas';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { renderWithIntl } from '@/tests/support/intl';
import { ApplyProfile } from '../estimate-editor/apply-profile';
import { EditorProvider } from '../estimate-editor/store';
import { ProfileEditor } from './profile-editor';
import { ProfileList } from './profile-list';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);

const hooks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useProjects: vi.fn(),
  useProfiles: vi.fn(),
  useProfile: vi.fn(),
  useCreateProfile: vi.fn(),
  useUpdateProfile: vi.fn(),
  useApplyProfile: vi.fn(),
}));
vi.mock('@/lib/query/hooks', () => hooks);

const ok = <T,>(data: T) => ({
  status: 'success' as const,
  data,
  error: null,
  refetch: vi.fn(),
  dataUpdatedAt: 1,
});
const NOW = '2026-11-12T07:00:00.000Z';
const DEFAULTS = DEFAULT_ASSUMPTIONS as Assumptions;

function profile(over: Partial<ProfileDetail> = {}): ProfileDetail {
  return {
    id: 'pr1',
    scope: 'PROJECT',
    projectId: 'p1',
    name: 'Synthetic · Retail 2026',
    status: 'DRAFT',
    uncalibrated: 142,
    assumptionRows: 160,
    basedOnId: null,
    createdAt: NOW,
    publishedAt: null,
    values: structuredClone(DEFAULTS),
    calibration: {},
    ...over,
  };
}

function me(role: 'VIEWER' | 'ESTIMATOR' | 'QE_LEAD') {
  return ok({
    id: 'u1',
    displayName: 'Synthetic Lead',
    email: 'lead@example.invalid',
    globalRole: 'USER',
    locale: 'en',
    memberships: [{ projectId: 'p1', projectKey: 'DEMO', projectName: 'Synthetic', role }],
  });
}

let save: { mutate: ReturnType<typeof vi.fn>; isPending: boolean; error: null };
let setStatus: { mutate: ReturnType<typeof vi.fn>; isPending: boolean; error: null };
let apply: { mutate: ReturnType<typeof vi.fn>; isPending: boolean; isError: boolean };

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useMe.mockReturnValue(me('QE_LEAD'));
  hooks.useProjects.mockReturnValue(
    ok({ items: [{ id: 'p1', key: 'DEMO', name: 'Synthetic', myRole: 'QE_LEAD' }] }),
  );
  save = { mutate: vi.fn(), isPending: false, error: null };
  setStatus = { mutate: vi.fn(), isPending: false, error: null };
  apply = { mutate: vi.fn(), isPending: false, isError: false };
  hooks.useUpdateProfile.mockReturnValue({ save, setStatus });
  hooks.useCreateProfile.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
  hooks.useApplyProfile.mockReturnValue(apply);
});

describe('ProfileList', () => {
  it('lists profiles with status and calibration count', async () => {
    hooks.useProfiles.mockReturnValue(
      ok({
        items: [
          profile({ scope: 'GLOBAL', projectId: null, name: 'Default', status: 'PUBLISHED' }),
          profile({ uncalibrated: 120 }),
        ],
      }),
    );
    const { container } = renderWithIntl(<ProfileList />);
    expect(screen.getByRole('link', { name: 'Default' }).getAttribute('href')).toBe(
      '/en/profiles/pr1',
    );
    expect(screen.getByText('120 / 160')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New profile' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('hides "New profile" from an Estimator', () => {
    hooks.useMe.mockReturnValue(me('ESTIMATOR'));
    hooks.useProfiles.mockReturnValue(ok({ items: [] }));
    renderWithIntl(<ProfileList />);
    expect(screen.queryByRole('button', { name: 'New profile' })).toBeNull();
  });
});

describe('ProfileEditor', () => {
  it('edits a draft, records a calibration source and saves', () => {
    hooks.useProfile.mockReturnValue(ok(profile()));
    renderWithIntl(<ProfileEditor profileId="pr1" />);
    const input = screen.getByRole('spinbutton', { name: /^Critical-rule share, rough/ });
    fireEvent.change(input, { target: { value: '35' } });
    fireEvent.blur(input);
    const source = screen.getByRole('textbox', {
      name: /^Calibration source for Critical-rule share, rough/,
    });
    fireEvent.change(source, { target: { value: 'Synthetic SIT cycle' } });
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const body = save.mutate.mock.calls[0]![0];
    expect(body.values.criticalShare).toBeCloseTo(0.35);
    expect(Object.keys(body.calibration)).toEqual(['criticalShare']);
  });

  it('confirms before publishing', () => {
    hooks.useProfile.mockReturnValue(ok(profile()));
    renderWithIntl(<ProfileEditor profileId="pr1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }));
    expect(setStatus.mutate).toHaveBeenCalledWith('publish', expect.anything());
  });

  it('shows a published profile read-only, with retire and clone', async () => {
    hooks.useProfile.mockReturnValue(ok(profile({ status: 'PUBLISHED', publishedAt: NOW })));
    hooks.useProfiles.mockReturnValue(ok({ items: [] }));
    const { container } = renderWithIntl(<ProfileEditor profileId="pr1" />);
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retire' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clone' })).toBeTruthy();
    expect((screen.getAllByRole('spinbutton')[0] as HTMLInputElement).disabled).toBe(true);
    await expectNoAxeViolations(container);
  });
});

describe('ApplyProfile', () => {
  function render(editable = true) {
    hooks.useProfiles.mockReturnValue(
      ok({
        items: [
          profile({
            id: 'g',
            scope: 'GLOBAL',
            projectId: null,
            name: 'Default',
            status: 'PUBLISHED',
          }),
          profile({ status: 'PUBLISHED' }),
          profile({ id: 'd', name: 'Draft one' }),
        ],
      }),
    );
    return renderWithIntl(
      <EditorProvider
        initial={{
          inputs: EXAMPLE_INPUTS as EstimateInputs,
          assumptions: structuredClone(DEFAULTS),
          rowVersion: 4,
        }}
        editable={editable}
      >
        <ApplyProfile estimateId="e1" projectId="p1" profileId="g" />
      </EditorProvider>,
    );
  }

  it('names the current profile and applies a published one after confirming', () => {
    render();
    expect(screen.getByRole('link', { name: 'Default' })).toBeTruthy();
    const select = screen.getByRole('combobox', { name: 'Apply a published profile' });
    expect(within(select).queryByText('Draft one')).toBeNull();
    fireEvent.change(select, { target: { value: 'pr1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply profile' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply profile' }),
    );
    expect(apply.mutate).toHaveBeenCalledWith(
      { profileId: 'pr1', rowVersion: 4 },
      expect.anything(),
    );
  });

  it('only shows the current profile when read-only', () => {
    render(false);
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
