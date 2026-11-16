// @vitest-environment jsdom
import { ApiClientError } from '@/lib/http';
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

/** Opens the size editor side panel of a draft profile (two-column layout). */
function openSizes() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit sizes' }));
  return screen.getByRole('dialog', { name: 'Feature sizes' });
}
function closeSizes(sheet: HTMLElement) {
  fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
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

describe('feature sizes in a profile (ADR-0021)', () => {
  it('lists a custom row total in the profile list', () => {
    hooks.useProfiles.mockReturnValue(
      ok({ items: [profile({ uncalibrated: 161, assumptionRows: 163 })] }),
    );
    renderWithIntl(<ProfileList />);
    expect(screen.getByText('161 / 163')).toBeTruthy();
  });

  it('adds a size copied from another and removes one, then saves', async () => {
    hooks.useProfile.mockReturnValue(ok(profile()));
    const { container } = renderWithIntl(<ProfileEditor profileId="pr1" />);
    const sizes = openSizes();
    fireEvent.change(within(sizes).getByRole('textbox', { name: 'Size name' }), {
      target: { value: 'XS2' },
    });
    fireEvent.change(within(sizes).getByRole('combobox', { name: 'Copy from' }), {
      target: { value: 'S' },
    });
    fireEvent.click(within(sizes).getByRole('button', { name: 'Add size' }));
    fireEvent.click(within(sizes).getByRole('button', { name: 'Remove XXL' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Remove size XXL?' })).getByRole('button', {
        name: 'Remove',
      }),
    );
    closeSizes(sizes);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const body = save.mutate.mock.calls[0]![0];
    expect(body.values.sizes).toContain('XS2');
    expect(body.values.sizes).not.toContain('XXL');
    expect(body.values.proxies.XS2).toEqual(DEFAULTS.proxies.S);
    await expectNoAxeViolations(container);
  });

  it('explains a name it cannot take', () => {
    hooks.useProfile.mockReturnValue(ok(profile()));
    renderWithIntl(<ProfileEditor profileId="pr1" />);
    const sizes = openSizes();
    fireEvent.change(within(sizes).getByRole('textbox', { name: 'Size name' }), {
      target: { value: 'M' },
    });
    fireEvent.click(within(sizes).getByRole('button', { name: 'Add size' }));
    expect(within(sizes).getByText('That size already exists.')).toBeTruthy();
  });

  it('renames a size and moves it', () => {
    hooks.useProfile.mockReturnValue(ok(profile()));
    renderWithIntl(<ProfileEditor profileId="pr1" />);
    const sizes = openSizes();
    fireEvent.click(within(sizes).getByRole('button', { name: 'Rename M' }));
    fireEvent.change(within(sizes).getByRole('textbox', { name: 'New name for M' }), {
      target: { value: 'Med' },
    });
    fireEvent.click(within(sizes).getByRole('button', { name: 'Save name' }));
    fireEvent.click(within(sizes).getByRole('button', { name: 'Move Med up' }));
    closeSizes(sizes);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const body = save.mutate.mock.calls[0]![0];
    expect(body.values.sizes.slice(2, 5)).toEqual(['S', 'Med', 'M-']);
  });

  it('shows the sizes of a published profile without edit buttons', () => {
    hooks.useProfile.mockReturnValue(ok(profile({ status: 'PUBLISHED', publishedAt: NOW })));
    hooks.useProfiles.mockReturnValue(ok({ items: [] }));
    renderWithIntl(<ProfileEditor profileId="pr1" />);
    const sizes = screen.getByRole('region', { name: 'Feature sizes' });
    expect(within(sizes).getByText('XXXL')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit sizes' })).toBeNull();
  });

  function renderBlocked(sizes: string[]) {
    hooks.useApplyProfile.mockReturnValue({
      ...apply,
      isError: true,
      error: new ApiClientError(
        409,
        {
          error: {
            code: 'CONFLICT',
            message: 'Some features use a size this profile does not have.',
            details: [{ reason: 'SIZE_NOT_IN_PROFILE', size: 'XXL', features: 3 }],
          },
        } as never,
        'x',
      ),
    });
    hooks.useProfiles.mockReturnValue(ok({ items: [profile({ status: 'PUBLISHED' })] }));
    const inputs = structuredClone(EXAMPLE_INPUTS) as EstimateInputs;
    inputs.features = sizes.map((size, i) => ({ ...inputs.features[0]!, name: `F${i}`, size }));
    renderWithIntl(
      <EditorProvider
        initial={{ inputs, assumptions: structuredClone(DEFAULTS), rowVersion: 4 }}
        editable
      >
        <ApplyProfile estimateId="e1" projectId="p1" profileId="g" />
      </EditorProvider>,
    );
  }

  it('explains which features block applying a profile', () => {
    renderBlocked(['XXL', 'M', 'XXL', 'XXL']);
    expect(
      screen.getByText("3 features use XXL, which this profile doesn't have. Resize them first."),
    ).toBeTruthy();
  });

  it('counts the features as they are now', () => {
    renderBlocked(['XXL', 'M']);
    expect(
      screen.getByText("1 feature uses XXL, which this profile doesn't have. Resize them first."),
    ).toBeTruthy();
  });

  it('shows no message once the features are resized', () => {
    renderBlocked(['M', 'L']);
    expect(screen.queryByText(/which this profile doesn't have/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('size editor details (ADR-0021 follow-up)', () => {
  const open = () => {
    hooks.useProfile.mockReturnValue(ok(profile()));
    renderWithIntl(<ProfileEditor profileId="pr1" />);
    return openSizes();
  };

  it('closes a rename that keeps the same name, without an error', () => {
    const sizes = open();
    fireEvent.click(within(sizes).getByRole('button', { name: 'Rename M' }));
    fireEvent.click(within(sizes).getByRole('button', { name: 'Save name' }));
    expect(within(sizes).queryByRole('textbox', { name: 'New name for M' })).toBeNull();
    expect(within(sizes).queryByRole('alert')).toBeNull();
  });

  it('limits names to 6 characters', () => {
    const sizes = open();
    expect(
      within(sizes).getByRole('textbox', { name: 'Size name' }).getAttribute('maxlength'),
    ).toBe('6');
    fireEvent.click(within(sizes).getByRole('button', { name: 'Rename M' }));
    expect(
      within(sizes).getByRole('textbox', { name: 'New name for M' }).getAttribute('maxlength'),
    ).toBe('6');
  });

  it('asks before removing a size', () => {
    const sizes = open();
    fireEvent.click(within(sizes).getByRole('button', { name: 'Remove XXL' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove size XXL?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(within(sizes).getByRole('button', { name: 'Remove XXL' })).toBeTruthy();
    fireEvent.click(within(sizes).getByRole('button', { name: 'Remove XXL' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Remove size XXL?' })).getByRole('button', {
        name: 'Remove',
      }),
    );
    expect(within(sizes).queryByRole('button', { name: 'Remove XXL' })).toBeNull();
  });

  it('focuses the rename field, saves on Enter and gives focus back', () => {
    const sizes = open();
    fireEvent.click(within(sizes).getByRole('button', { name: 'Rename M' }));
    const input = within(sizes).getByRole('textbox', { name: 'New name for M' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Med' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.activeElement).toBe(within(sizes).getByRole('button', { name: 'Rename Med' }));
  });

  it('links an error to the name field', () => {
    const sizes = open();
    const name = within(sizes).getByRole('textbox', { name: 'Size name' });
    fireEvent.change(name, { target: { value: 'M' } });
    fireEvent.click(within(sizes).getByRole('button', { name: 'Add size' }));
    expect(name.getAttribute('aria-invalid')).toBe('true');
    const described = name.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(described)?.textContent).toBe('That size already exists.');
  });
});

describe('two-column profile page', () => {
  it('shows status, calibration and sizes in the side panel', async () => {
    hooks.useProfile.mockReturnValue(
      ok(profile({ status: 'PUBLISHED', publishedAt: NOW, uncalibrated: 159 })),
    );
    hooks.useProfiles.mockReturnValue(ok({ items: [] }));
    const { container } = renderWithIntl(<ProfileEditor profileId="pr1" />);
    const sizes = screen.getByRole('region', { name: 'Feature sizes' });
    expect(within(sizes).getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('0 of 160 rows calibrated')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit sizes' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Assumption values' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('edits sizes in a side panel and counts the new rows', () => {
    hooks.useProfile.mockReturnValue(ok(profile()));
    renderWithIntl(<ProfileEditor profileId="pr1" />);
    expect(screen.getByText('0 of 160 rows calibrated')).toBeTruthy();
    const sheet = openSizes();
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Size name' }), {
      target: { value: 'XS2' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add size' }));
    closeSizes(sheet);
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(screen.getByText('0 of 163 rows calibrated')).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Feature sizes' })).getByText('XS2'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(save.mutate.mock.calls[0]![0].values.sizes).toContain('XS2');
  });
});
