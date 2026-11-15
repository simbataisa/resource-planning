// @vitest-environment jsdom
import type { Me } from '@sit/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';
import type { TourDefinition, TourEvent, TourStep } from '@/lib/tours/types';
import { joyrideOptions, TourProvider, useTours } from './tour-provider';
import { useTourEvent } from './use-tour-event';

const nav = vi.hoisted(() => ({ pathname: '/projects', push: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));
const api = vi.hoisted(() => ({ me: vi.fn(), updateMe: vi.fn() }));
vi.mock('@/lib/api', () => ({ api }));

const USER = 'u-synthetic-1';
const ME: Me = {
  id: USER,
  displayName: 'Synthetic Estimator',
  email: 'estimator@example.test',
  globalRole: 'USER',
  locale: 'en',
  memberships: [{ projectId: 'p1', projectKey: 'DEMO', projectName: 'Demo', role: 'ESTIMATOR' }],
  tours: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-06-01T00:00:00.000Z',
};

const COPY = {
  en: ['Welcome', 'The list', 'New estimate', 'Save a version', 'All done'],
  vi: ['Chào mừng', 'Danh sách', 'Ước tính mới', 'Lưu phiên bản', 'Xong rồi'],
};
const NAMES = ['one', 'two', 'three', 'four', 'done'];
function messages(locale: 'en' | 'vi') {
  const base = locale === 'vi' ? viMessages : enMessages;
  const test = Object.fromEntries(
    NAMES.map((n, i) => [n, { title: COPY[locale][i], body: `${COPY[locale][i]} body` }]),
  );
  return { ...base, tours: { ...base.tours, test } };
}

const route = /^\/projects$/;
const step = (name: string, over: Partial<TourStep> = {}): TourStep => ({
  route,
  target: 'center',
  messageKey: `tours.test.${name}`,
  advance: 'next',
  ...over,
});
const tour = (id: string, steps: TourStep[]): TourDefinition => ({
  id,
  kind: 'onboarding',
  since: '2025-12-01T00:00:00.000Z',
  audience: () => true,
  steps,
});

const DEMO = tour('demo@1', [
  step('one'),
  step('two', { target: '[data-tour="list"]' }),
  step('three', { target: '[data-tour="new"]', advance: 'click' }),
  step('four', { target: '[data-tour="save"]', advance: { event: 'version-saved' } }),
  step('done'),
]);
const SHORT = tour('short@1', [step('one'), step('two', { target: '[data-tour="list"]' })]);
const NO_PROJECT = tour('no-project@1', [step('one')]);
const MISSING = tour('missing@1', [step('one'), step('two', { target: '[data-tour="gone"]' })]);

const probe: { tours?: ReturnType<typeof useTours>; emit?: (e: TourEvent) => void } = {};
function Probe() {
  const tours = useTours();
  const emit = useTourEvent();
  useEffect(() => {
    probe.tours = tours;
    probe.emit = emit;
  });
  return null;
}

function Page() {
  return (
    <main>
      <button type="button">Page button</button>
      <ul data-tour="list">
        <li>Item</li>
      </ul>
      <button type="button" data-tour="new">
        New estimate
      </button>
      <button type="button" data-tour="save">
        Save version
      </button>
      <Probe />
    </main>
  );
}

function makeClient(me: Me | null = ME) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } },
  });
  if (me) client.setQueryData(['me'], me);
  return client;
}

function Harness({
  client,
  registry,
  locale = 'en',
  children = <Page />,
}: {
  client: QueryClient;
  registry: TourDefinition[];
  locale?: 'en' | 'vi';
  children?: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages(locale)} timeZone="UTC">
      <QueryClientProvider client={client}>
        <TourProvider registry={registry}>{children}</TourProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function setup(registry: TourDefinition[], client = makeClient()) {
  const utils = render(<Harness client={client} registry={registry} />);
  return { client, ...utils };
}

const dialog = () => screen.findByRole('dialog');
const meIn = (client: QueryClient) => client.getQueryData<Me>(['me'])!;
const local = () => JSON.parse(window.localStorage.getItem(`sit-tours:${USER}`) ?? '{}');
const startAt = (id: string, stepIndex: number) =>
  window.sessionStorage.setItem(
    'sit-tour-progress',
    JSON.stringify({ id, stepIndex, paused: false, path: '/projects' }),
  );

beforeEach(() => {
  nav.pathname = '/projects';
  nav.push.mockReset();
  api.updateMe.mockReset();
  api.updateMe.mockImplementation(async (body: { tours: Record<string, { status: string }> }) => ({
    ...ME,
    tours: Object.fromEntries(
      Object.entries(body.tours).map(([k, v]) => [
        k,
        { status: v.status, at: '2026-11-15T00:00:00.000Z' },
      ]),
    ),
  }));
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TourProvider', () => {
  it('opens the first step in a dialog on a matching page; Next moves to step 2', async () => {
    const user = userEvent.setup();
    setup([DEMO]);
    const d = await dialog();
    expect(within(d).getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
    expect(d).toHaveAccessibleName('Welcome');
    expect(within(d).getByText('1 of 5')).toBeInTheDocument();
    await user.click(within(d).getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: 'The list' })).toBeInTheDocument();
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });

  it('starts no tour before /me has loaded, or when the page does not match', async () => {
    api.me.mockReturnValue(new Promise(() => {}));
    setup([DEMO], makeClient(null));
    nav.pathname = '/admin';
    const other = render(<Harness client={makeClient()} registry={[DEMO]} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
    other.unmount();
  });

  it('advances a click step when its target is clicked', async () => {
    const user = userEvent.setup();
    startAt('demo@1', 2);
    setup([DEMO]);
    expect(await screen.findByRole('heading', { name: 'New estimate' })).toBeInTheDocument();
    // No Next button: the step waits for the click.
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'New estimate' }));
    expect(await screen.findByRole('heading', { name: 'Save a version' })).toBeInTheDocument();
  });

  it('gives keyboard users a path from a click step to its target (no focus trap)', async () => {
    const user = userEvent.setup();
    startAt('demo@1', 2);
    setup([DEMO]);
    const d = await dialog();
    await waitFor(() => expect(d).toContainElement(document.activeElement as HTMLElement));
    const target = screen.getByRole('button', { name: 'New estimate' });
    for (let i = 0; i < 6 && document.activeElement !== target; i++) await user.tab();
    expect(document.activeElement).toBe(target);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Save a version' })).toBeInTheDocument();
  });

  it('gives keyboard users a path from an event step to its target', async () => {
    const user = userEvent.setup();
    startAt('demo@1', 3);
    setup([DEMO]);
    const d = await dialog();
    await waitFor(() => expect(d).toContainElement(document.activeElement as HTMLElement));
    const target = screen.getByRole('button', { name: 'Save version' });
    for (let i = 0; i < 6 && document.activeElement !== target; i++) await user.tab();
    expect(document.activeElement).toBe(target);
  });

  it('on version-saved records completed first, then shows the Done card; closing it records nothing more', async () => {
    const user = userEvent.setup();
    startAt('demo@1', 3);
    const { client } = setup([DEMO]);
    expect(await screen.findByRole('heading', { name: 'Save a version' })).toBeInTheDocument();
    act(() => probe.emit!('estimate-created'));
    expect(screen.getByRole('heading', { name: 'Save a version' })).toBeInTheDocument();
    act(() => probe.emit!('version-saved'));
    expect(meIn(client).tours['demo@1']?.status).toBe('completed');
    expect(local()['demo@1'].status).toBe('completed');
    await waitFor(() =>
      expect(api.updateMe).toHaveBeenCalledWith({ tours: { 'demo@1': { status: 'completed' } } }),
    );
    const d = await dialog();
    expect(within(d).getByRole('heading', { name: 'All done' })).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Back' })).toBeNull();
    await user.click(within(d).getByRole('button', { name: 'Close tour' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.updateMe).toHaveBeenCalledTimes(1);
    expect(meIn(client).tours['demo@1']?.status).toBe('completed');
  });

  it('Skip records skipped at once in the cache, the browser copy and PATCH /me', async () => {
    const user = userEvent.setup();
    let resolve!: (v: Me) => void;
    api.updateMe.mockReturnValue(new Promise<Me>((r) => (resolve = r)));
    const { client } = setup([DEMO]);
    await user.click(within(await dialog()).getByRole('button', { name: 'Skip tour' }));
    expect(meIn(client).tours['demo@1']?.status).toBe('skipped');
    expect(local()['demo@1'].status).toBe('skipped');
    expect(api.updateMe).toHaveBeenCalledWith({ tours: { 'demo@1': { status: 'skipped' } } });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    resolve({ ...ME, tours: { 'demo@1': { status: 'skipped', at: '2026-11-15T00:00:00.000Z' } } });
  });

  it('keeps the tour closed and the cache skipped when PATCH /me fails (no rollback)', async () => {
    const user = userEvent.setup();
    api.updateMe.mockRejectedValue(new Error('offline'));
    const { client } = setup([DEMO]);
    await user.click(within(await dialog()).getByRole('button', { name: 'Skip tour' }));
    await waitFor(() => expect(api.updateMe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(meIn(client).tours['demo@1']?.status).toBe('skipped');
    expect(local()['demo@1'].status).toBe('skipped');
  });

  it('keeps both entries when an earlier PATCH resolves after a later close (no stale overwrite)', async () => {
    const user = userEvent.setup();
    const pending: Array<(v: Me) => void> = [];
    api.updateMe.mockImplementation(() => new Promise<Me>((r) => pending.push(r)));
    const at = '2026-11-15T00:00:00.000Z';
    const { client } = setup([DEMO, SHORT]);
    await user.click(within(await dialog()).getByRole('button', { name: 'Skip tour' }));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => probe.tours!.start('short@1'));
    await user.click(within(await dialog()).getByRole('button', { name: 'Skip tour' }));
    await waitFor(() => expect(pending).toHaveLength(2));
    // The first response knows only the first close.
    await act(async () => pending[0]!({ ...ME, tours: { 'demo@1': { status: 'skipped', at } } }));
    expect(meIn(client).tours['demo@1']?.status).toBe('skipped');
    expect(meIn(client).tours['short@1']?.status).toBe('skipped');
    await act(async () =>
      pending[1]!({
        ...ME,
        tours: { 'demo@1': { status: 'skipped', at }, 'short@1': { status: 'skipped', at } },
      }),
    );
    expect(Object.keys(meIn(client).tours).sort()).toEqual(['demo@1', 'short@1']);
  });

  it('Esc records dismissed the same way', async () => {
    const user = userEvent.setup();
    const { client } = setup([DEMO]);
    await dialog();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(meIn(client).tours['demo@1']?.status).toBe('dismissed');
    expect(local()['demo@1'].status).toBe('dismissed');
    expect(api.updateMe).toHaveBeenCalledWith({ tours: { 'demo@1': { status: 'dismissed' } } });
  });

  it('Finish on the last step records completed', async () => {
    const user = userEvent.setup();
    const { client } = setup([SHORT]);
    await user.click(within(await dialog()).getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(meIn(client).tours['short@1']?.status).toBe('completed');
  });

  it('resends browser-copy entries missing from me.tours once on load', async () => {
    window.localStorage.setItem(
      `sit-tours:${USER}`,
      JSON.stringify({ 'demo@1': { status: 'skipped', at: '2026-11-01T00:00:00.000Z' } }),
    );
    const { rerender, client } = setup([DEMO]);
    rerender(<Harness client={client} registry={[DEMO]} />);
    await waitFor(() => expect(api.updateMe).toHaveBeenCalledTimes(1));
    expect(api.updateMe).toHaveBeenCalledWith({ tours: { 'demo@1': { status: 'skipped' } } });
    // The browser copy keeps its original time; the tour does not start (seen locally).
    expect(local()['demo@1'].at).toBe('2026-11-01T00:00:00.000Z');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pauses after 5 s when a step target never appears, and records nothing (RF4)', async () => {
    const { client } = setup([MISSING]);
    const d = await dialog();
    vi.useFakeTimers();
    fireEvent.click(within(d).getByRole('button', { name: 'Next' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(probe.tours!.paused).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(probe.tours!.paused).toBe(true);
    expect(probe.tours!.active?.id).toBe('missing@1');
    expect(api.updateMe).not.toHaveBeenCalled();
    expect(meIn(client).tours).toEqual({});
    expect(local()).toEqual({});
    vi.useRealTimers();
    // Resume shows the step again (and pauses again later if it is still missing).
    act(() => probe.tours!.resume());
    expect(probe.tours!.paused).toBe(false);
  });

  it('re-renders the open step in Vietnamese without changing the step (RF5)', async () => {
    const user = userEvent.setup();
    const client = makeClient();
    const { rerender } = render(<Harness client={client} registry={[DEMO]} />);
    await user.click(within(await dialog()).getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: 'The list' })).toBeInTheDocument();
    rerender(<Harness client={client} registry={[DEMO]} locale="vi" />);
    expect(await screen.findByRole('heading', { name: 'Danh sách' })).toBeInTheDocument();
    expect(screen.getByText('2 trên 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tiếp' })).toBeInTheDocument();
  });

  it('turns off scroll and spotlight animation under prefers-reduced-motion', async () => {
    expect(joyrideOptions(true).scrollDuration).toBe(0);
    expect(joyrideOptions(false).scrollDuration).toBeGreaterThan(0);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    setup([SHORT]);
    const d = await dialog();
    expect(d.closest('.react-joyride__floater')).toHaveStyle({ transition: 'none' });
    expect(document.querySelector('.react-joyride__overlay')).toHaveStyle({ transition: 'none' });
  });

  it('moves focus into the dialog, and back to the page after Finish', async () => {
    const user = userEvent.setup();
    setup([SHORT]);
    const d = await dialog();
    await waitFor(() => expect(d).toContainElement(document.activeElement as HTMLElement));
    await user.click(within(d).getByRole('button', { name: 'Next' }));
    const finish = await screen.findByRole('button', { name: 'Finish' });
    await user.click(finish);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.contains(document.activeElement)).toBe(true);
  });

  it('moves focus back to the page after Esc', async () => {
    const user = userEvent.setup();
    setup([SHORT]);
    const d = await dialog();
    await waitFor(() => expect(d).toContainElement(document.activeElement as HTMLElement));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.contains(document.activeElement)).toBe(true);
  });

  it.each([
    ['Skip tour', 'click'],
    ['Finish', 'click'],
    ['Close tour', 'click'],
    ['Escape', 'key'],
  ])('closing no-project@1 with %s records dismissed', async (name, how) => {
    const user = userEvent.setup();
    const { client } = setup([NO_PROJECT]);
    const d = await dialog();
    if (how === 'key') await user.keyboard('{Escape}');
    else await user.click(within(d).getByRole('button', { name }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(meIn(client).tours['no-project@1']?.status).toBe('dismissed');
    expect(api.updateMe).toHaveBeenCalledWith({
      tours: { 'no-project@1': { status: 'dismissed' } },
    });
  });

  it('does not downgrade a completed tour to dismissed when a replay is closed', async () => {
    const user = userEvent.setup();
    const done = {
      ...ME,
      tours: { 'short@1': { status: 'completed' as const, at: ME.createdAt } },
    };
    const { client } = setup([SHORT], makeClient(done));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => probe.tours!.start('short@1'));
    await user.click(within(await dialog()).getByRole('button', { name: 'Close tour' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.updateMe).not.toHaveBeenCalled();
    expect(meIn(client).tours['short@1']?.status).toBe('completed');
    act(() => probe.tours!.start('unknown@1'));
    expect(probe.tours!.active).toBeNull();
  });

  it('pauses when the user leaves the path, and Resume navigates back', async () => {
    const client = makeClient();
    const { rerender } = render(<Harness client={client} registry={[SHORT]} />);
    await dialog();
    nav.pathname = '/profiles';
    rerender(<Harness client={client} registry={[SHORT]} />);
    await waitFor(() => expect(probe.tours!.paused).toBe(true));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem('sit-tour-progress')!)).toMatchObject({
      id: 'short@1',
      paused: true,
    });
    act(() => probe.tours!.resume());
    expect(nav.push).toHaveBeenCalledWith('/projects');
    nav.pathname = '/projects';
    rerender(<Harness client={client} registry={[SHORT]} />);
    expect(await dialog()).toBeInTheDocument();
    expect(api.updateMe).not.toHaveBeenCalled();
  });

  it('moves to the next step when a navigate step reaches the next page', async () => {
    const nav2 = tour('nav@1', [
      step('one', { advance: 'navigate' }),
      step('two', { route: /^\/projects\/\w+$/, target: '[data-tour="list"]' }),
    ]);
    const client = makeClient();
    const { rerender } = render(<Harness client={client} registry={[nav2]} />);
    await dialog();
    nav.pathname = '/projects/p1';
    rerender(<Harness client={client} registry={[nav2]} />);
    expect(await screen.findByRole('heading', { name: 'The list' })).toBeInTheDocument();
    expect(probe.tours!.paused).toBe(false);
  });

  it('continues a tour from sessionStorage after a reload, paused when off its page', async () => {
    window.sessionStorage.setItem(
      'sit-tour-progress',
      JSON.stringify({ id: 'demo@1', stepIndex: 1, paused: false, path: '/projects' }),
    );
    nav.pathname = '/guide';
    setup([DEMO]);
    await waitFor(() => expect(probe.tours!.active?.id).toBe('demo@1'));
    expect(probe.tours!.paused).toBe(true);
  });

  it('works without a provider (no-op hooks) and with blocked sessionStorage', async () => {
    render(<Probe />);
    expect(probe.tours!.active).toBeNull();
    expect(() => probe.tours!.start('x@1')).not.toThrow();
    expect(() => probe.tours!.resume()).not.toThrow();
    expect(() => probe.emit!('version-saved')).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setup([SHORT]);
    expect(await dialog()).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
