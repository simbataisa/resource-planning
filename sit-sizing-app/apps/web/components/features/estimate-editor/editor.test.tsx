// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from '@sit/engine';
import type { Assumptions, EstimateInputs, Version } from '@sit/schemas';
import { ApiClientError } from '@/lib/http';
import { renderWithIntl } from '@/tests/support/intl';
import { EstimateEditor } from './estimate-editor';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);

const hooks = vi.hoisted(() => ({
  useEstimate: vi.fn(),
  useVersion: vi.fn(),
  useMe: vi.fn(),
  useProject: vi.fn(),
  useLockDraft: vi.fn(),
  useCreateDraft: vi.fn(),
  usePatchDraft: vi.fn(),
  useSaveVersion: vi.fn(),
}));
vi.mock('@/lib/query/hooks', () => hooks);

const ok = <T,>(data: T) => ({ status: 'success' as const, data, error: null, refetch: vi.fn() });
const user = { id: 'u1', displayName: 'Synthetic Estimator', email: 'estimator@example.invalid' };
const other = { id: 'u2', displayName: 'Synthetic Lead', email: 'lead@example.invalid' };
const NOW = '2026-11-12T07:00:00.000Z';
const LATER = '2099-01-01T00:00:00.000Z';

function version(over: Partial<Version> = {}): Version {
  return {
    id: 'v2',
    number: 2,
    status: 'DRAFT',
    engineVersion: '1.0.0',
    roughFte: 20.5,
    detailedFte: 21.5,
    totalCasesDetailed: 4047,
    uncalibrated: 142,
    note: null,
    createdBy: user,
    createdAt: NOW,
    updatedAt: NOW,
    inputs: structuredClone(EXAMPLE_INPUTS) as EstimateInputs,
    assumptions: structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions,
    result: {} as Version['result'],
    profileId: null,
    schemaVersion: 1,
    rowVersion: 3,
    lock: null,
    ...over,
  };
}

function estimate(v: Version) {
  return {
    id: 'e1',
    projectId: 'p1',
    name: 'Synthetic · Onboarding',
    description: null,
    archived: false,
    createdBy: user,
    createdAt: NOW,
    latest: v,
    hasDraft: v.status === 'DRAFT',
    versions: [v],
    draftLock: v.lock,
  };
}

function me(role: 'VIEWER' | 'ESTIMATOR' | 'QE_LEAD') {
  return ok({
    ...user,
    globalRole: 'USER',
    locale: 'en',
    memberships: [{ projectId: 'p1', projectKey: 'DEMO', projectName: 'Synthetic', role }],
  });
}

let lock: { mutate: ReturnType<typeof vi.fn> };
let patch: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let save: { mutateAsync: ReturnType<typeof vi.fn> };
let createDraft: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };

function setup(v: Version, role: 'VIEWER' | 'ESTIMATOR' | 'QE_LEAD' = 'ESTIMATOR') {
  hooks.useEstimate.mockReturnValue(ok(estimate(v)));
  hooks.useVersion.mockReturnValue(ok(v));
  hooks.useMe.mockReturnValue(me(role));
  const client = new QueryClient();
  return renderWithIntl(
    <QueryClientProvider client={client}>
      <EstimateEditor estimateId="e1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useProject.mockReturnValue(ok({ id: 'p1', name: 'Synthetic · Demo' }));
  lock = {
    mutate: vi.fn((_takeover: boolean, o: { onSuccess: (v: Version) => void }) =>
      o.onSuccess(version({ lock: { holder: user, expiresAt: LATER, mine: true } })),
    ),
  };
  patch = {
    mutateAsync: vi.fn(async () => version({ rowVersion: 4 })),
    isPending: false,
  };
  save = { mutateAsync: vi.fn(async () => version({ status: 'SAVED' })) };
  createDraft = { mutate: vi.fn(), isPending: false };
  hooks.useLockDraft.mockReturnValue(lock);
  hooks.usePatchDraft.mockReturnValue(patch);
  hooks.useSaveVersion.mockReturnValue(save);
  hooks.useCreateDraft.mockReturnValue(createDraft);
});

afterEach(() => {
  vi.useRealTimers();
});

const qtyOf = (row: number) =>
  screen.getAllByRole('spinbutton', { name: 'Quantity' })[row] as HTMLInputElement;

describe('EstimateEditor sessions (U-09)', () => {
  it('offers a new draft on a saved version and keeps inputs read-only', () => {
    setup(version({ status: 'SAVED', number: 1, id: 'v1' }));
    expect(screen.getByText(/Version 1 is saved and cannot change/)).toBeInTheDocument();
    expect(qtyOf(0)).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit in a new draft' }));
    expect(createDraft.mutate).toHaveBeenCalled();
    expect(lock.mutate).not.toHaveBeenCalled();
  });

  it('keeps a draft read-only for viewers', () => {
    setup(version(), 'VIEWER');
    expect(screen.getByText(/Only Estimators and QE Leads/)).toBeInTheDocument();
    expect(lock.mutate).not.toHaveBeenCalled();
    expect(qtyOf(0)).toBeDisabled();
  });

  it('takes the lock, autosaves after a pause and reports the save state', async () => {
    vi.useFakeTimers();
    setup(version());
    expect(lock.mutate).toHaveBeenCalledWith(false, expect.anything());
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('All changes saved');

    fireEvent.change(qtyOf(0), { target: { value: '2' } });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(patch.mutateAsync).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(patch.mutateAsync).toHaveBeenCalledTimes(1);
    const body = patch.mutateAsync.mock.calls[0]![0] as {
      rowVersion: number;
      inputs: EstimateInputs;
    };
    expect(body.rowVersion).toBe(3);
    expect(body.inputs.features[0]!.qty).toBe(2);
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('switches to recovery when a save hits a conflict', async () => {
    vi.useFakeTimers();
    patch.mutateAsync.mockRejectedValue(new ApiClientError(409, null, 'stale'));
    setup(version());
    fireEvent.change(qtyOf(0), { target: { value: '3' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(screen.getByText('Your last changes were not saved')).toBeInTheDocument();
    expect(qtyOf(0)).toBeDisabled();

    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Download my unsaved values (JSON)' }));
    expect(click).toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reload the latest draft' }));
    });
    expect(lock.mutate).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('shows a save failure that is not a conflict and keeps editing', async () => {
    vi.useFakeTimers();
    patch.mutateAsync.mockRejectedValue(new ApiClientError(500, null, 'boom'));
    setup(version());
    fireEvent.change(qtyOf(0), { target: { value: '4' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(screen.getByText(/Could not save/)).toBeInTheDocument();
    expect(qtyOf(0)).not.toBeDisabled();
  });

  it('shows who holds the lock and lets a QE Lead take over', () => {
    const v = version({ lock: { holder: other, expiresAt: LATER, mine: false } });
    setup(v, 'QE_LEAD');
    expect(screen.getByText(/Synthetic Lead is editing this draft/)).toBeInTheDocument();
    expect(lock.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Take over editing' }));
    expect(lock.mutate).toHaveBeenCalledWith(true, expect.anything());
  });

  it('treats a lock refused by the server as held by someone else', () => {
    lock.mutate.mockImplementation((_t: boolean, o: { onError: (e: unknown) => void }) =>
      o.onError(new ApiClientError(409, null, 'held')),
    );
    setup(version({ lock: { holder: other, expiresAt: NOW, mine: false } }));
    // The expired lock looked free; the server says otherwise. No takeover for an Estimator.
    expect(screen.queryByRole('button', { name: 'Take over editing' })).toBeNull();
    expect(qtyOf(0)).toBeDisabled();
  });

  it('saves a version with a note after flushing pending edits', async () => {
    setup(version());
    fireEvent.change(qtyOf(0), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save version' }));
    const dialog = screen.getByRole('dialog', { name: 'Save version 2' });
    fireEvent.change(within(dialog).getByLabelText('Note (optional)'), {
      target: { value: 'Synthetic note' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save version' }));
    });
    expect(patch.mutateAsync).toHaveBeenCalled();
    expect(save.mutateAsync).toHaveBeenCalledWith('Synthetic note');
  });

  it('reports a failed save version', async () => {
    save.mutateAsync.mockRejectedValue(new Error('x'));
    setup(version());
    fireEvent.click(screen.getByRole('button', { name: 'Save version' }));
    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save version' }));
    });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('The version was not saved');
  });
});

describe('Editing the scope', () => {
  it('adds, changes and removes features and updates the cards live', () => {
    setup(version());
    const before = screen.getAllByRole('spinbutton', { name: 'Quantity' }).length;
    fireEvent.click(screen.getByRole('button', { name: 'Add feature' }));
    expect(screen.getAllByRole('spinbutton', { name: 'Quantity' })).toHaveLength(before + 1);
    const last = before;
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Type' })[last]!, {
      target: { value: 'data' },
    });
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Size' })[last]!, {
      target: { value: 'XL' },
    });
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Complexity' })[last]!, {
      target: { value: '2' },
    });
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Feature name' })[last]!, {
      target: { value: 'Synthetic · Extra' },
    });
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Performance-critical' })[last]!);
    expect(screen.getAllByText(/feeds · .* pipelines/, { selector: 'td' }).length).toBeGreaterThan(
      1,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Synthetic · Extra' }));
    expect(screen.getAllByRole('spinbutton', { name: 'Quantity' })).toHaveLength(before);
    fireEvent.change(screen.getByLabelText('Languages'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('User roles'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Product variants'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Second web stack (Angular + React)' }));
  });

  it('switches tabs, and edits detail, team, evidence and assumptions', () => {
    setup(version());
    const tab = (name: RegExp) => {
      const t = screen.getByRole('tab', { name });
      fireEvent.mouseDown(t);
      fireEvent.click(t);
    };

    tab(/Detailed scope/);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole('link', { name: /Performance testing/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'API endpoints Simple' }), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Text' }), { target: { value: '9' } });
    expect(screen.getByText(/Input fields \(total\) is now locked/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Critical business rules'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Data quality rules'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Guardrail categories'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Data-heavy scenarios (production-size data)'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Chatbot intents Medium' }), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Spike' }));

    tab(/Window, team/);
    fireEvent.change(screen.getByLabelText('Environment availability'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('AI-assisted test design'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Regression automated (%)'), {
      target: { value: '150' },
    });
    fireEvent.change(screen.getByLabelText('Junior (%)'), { target: { value: '45' } });
    expect(screen.getByText(/The model normalises it to 100%/)).toBeInTheDocument();
    expect(screen.getByText(/test design time −/)).toBeInTheDocument();

    tab(/Shift-left evidence/);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'L1 mutation score (PIT)' }), {
      target: { value: '10' },
    });
    expect(screen.getAllByText(/Below 70% gate/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('checkbox', { name: /Automated AI evaluation in CI/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /L4 end-to-end journeys/ }));

    tab(/Assumptions/);
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Planning, reporting and coordination overhead' }),
      {
        target: { value: '20' },
      },
    );
    expect(screen.getAllByText('Team value').length).toBe(1);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Reset Planning, reporting and coordination overhead to the default',
      }),
    );
    expect(screen.queryByText('Team value')).toBeNull();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Full SIT cycles' }), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'API endpoint · Simple' }), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getAllByRole('spinbutton', { name: 'Size S · Screens' })[0]!, {
      target: { value: '2' },
    });
  });

  it('changes the sensitivity view', () => {
    setup(version());
    fireEvent.change(screen.getByLabelText('Estimate'), { target: { value: 'rough' } });
    fireEvent.change(screen.getByLabelText('Swing'), { target: { value: '0.5' } });
    expect(screen.getByText(/moved 50% up and down/)).toBeInTheDocument();
    expect(screen.getByText(/Current rough estimate/)).toBeInTheDocument();
  });
});

describe('Export and import (X-01)', () => {
  it('copies the QBR summary, or shows it when copying fails', async () => {
    setup(version());
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy QBR summary' }));
    });
    expect(writeText.mock.calls[0]![0]).toMatch(/^SIT sizing \(planning range, not a commitment\)/);
    expect(screen.getByText('QBR summary copied.')).toBeInTheDocument();

    writeText.mockRejectedValueOnce(new Error('denied'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy QBR summary' }));
    });
    expect(screen.getByRole('textbox', { name: 'QBR summary' })).toHaveValue(
      writeText.mock.calls[0]![0],
    );
  });

  it('exports the profile as a prototype-compatible file', () => {
    setup(version());
    const createObjectURL = vi.fn((_b: Blob) => 'blob:x');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    let name = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      name = this.download;
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export profile' }));
    expect(name).toBe('sit-sizing-synthetic-onboarding-v2.json');
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('imports a profile file, and explains files it cannot use', async () => {
    setup(version());
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const upload = async (text: string) => {
      const file = new File([text], 'p.json', { type: 'application/json' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await act(async () => {
        fireEvent.change(input);
      });
    };
    const assumptions = structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
    assumptions.overhead = 0.3;
    await upload(JSON.stringify({ profile: 'Synthetic team', assumptions }));
    expect(screen.getByText('Profile imported: Synthetic team.')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await upload(JSON.stringify({ assumptions }));
    expect(screen.getByText('Profile imported.')).toBeInTheDocument();
    await upload('{not json');
    expect(screen.getByText(/The text is not valid JSON/)).toBeInTheDocument();
    await upload(JSON.stringify({ scope: {} }));
    expect(screen.getByText(/has no "assumptions" section/)).toBeInTheDocument();
    await upload('42');
    expect(screen.getByText(/Not a profile/)).toBeInTheDocument();
    await upload(JSON.stringify({ assumptions: { overhead: -1 } }));
    expect(screen.getByText(/outside the allowed range/)).toBeInTheDocument();
  });
});
