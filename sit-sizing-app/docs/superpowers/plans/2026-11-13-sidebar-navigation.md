# Sidebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the signed-in header nav with a shadcn Sidebar (layout A): grouped links, language and user menu in the sidebar, a slim top bar with toggle, section name and bell.

**Architecture:** shadcn's Sidebar source is copied by hand into `components/ui` (with Sheet, DropdownMenu and a `useIsMobile` hook), themed only through new `sidebar-*` tokens. A small nav model (`nav-items.ts`) holds groups, icons and the active-section rule; `AppShell` composes it. Role-gated items reuse today's `can()` checks.

**Tech Stack:** Next.js 16, React 19, `radix-ui` 1.4 (single package), Tailwind v4 `@theme inline`, lucide-react 1.64, next-intl, Vitest + Testing Library + axe, Playwright, Storybook.

**Spec:** `docs/superpowers/specs/2026-11-13-sidebar-navigation-design.md`

## Global Constraints

- Branch: `feature/sidebar-navigation`. Follow `sit-sizing-app/AGENTS.md`; run GitNexus `impact` before editing an existing symbol and `detect_changes` before each commit (root `CLAUDE.md`).
- No new npm dependencies. Primitives import from `radix-ui` (e.g. `import { Dialog as SheetPrimitive } from 'radix-ui'`), never `@radix-ui/*`.
- Components use semantic token utilities only (`bg-sidebar`, `text-muted-foreground`, …); no raw colours. Colour changes live in `packages/tokens/src/tokens.ts`.
- Every user-facing string is in `messages/en.json` and `vi.json` (same keys). No hard-coded text in `components/ui` either: labels come in as props.
- Link with `Link` from `@/i18n/navigation`; API docs stays a plain `<a href="/api/v1/docs">`.
- Link names stay exactly as today: Projects, Profiles, Portfolio, Audit log, Users, Guide, Method, Standards, API reference.
- Keep: skip link to `#main`, the disclaimer footer, the 4px red top bar (already `body { border-top }` in `globals.css`).
- Motion honours `prefers-reduced-motion` (the global rule in `globals.css` already zeroes transitions; do not add JS animation).
- Coverage gate for `components/features/**`: 80% lines and branches. `pnpm check` must pass before every commit.

## Review Focus

1. **Signed-out state** (`userName === null`): footer shows **Sign in**, no user menu, no bell; role items render nothing while `useMe` has no data → Task 5 test `signed out shows sign-in and no account menu`.
2. **Narrow screens:** below 768px the sidebar is a Sheet opened by the trigger, has an accessible title, and closes after a link is chosen → Task 3 test `mobile: trigger opens a titled sheet` and Task 5 test `choosing a link closes the mobile sheet`.
3. **Admin group with nothing in it:** an Estimator sees no "Admin" heading → Task 4 test `admin group is hidden when no admin item is visible`.
4. **Active section on nested routes and in Vietnamese:** `/vi/estimates/abc/compare` marks nothing wrong; `/projects/p1` marks Projects → Task 4 test `sectionFor maps nested and localised paths`.
5. **No `matchMedia`** (jsdom, old browsers): `useIsMobile` returns `false` instead of throwing → Task 2 test `useIsMobile is false without matchMedia`.

---

### Task 1: Sidebar colour tokens

**Files:**

- Modify: `packages/tokens/src/tokens.ts` (both themes; `contrastPairs`, `nonTextPairs`)
- Modify: `packages/tokens/tokens.css` (regenerated, never hand-edited)
- Modify: `apps/web/app/globals.css` (`@theme inline` block)
- Test: `packages/tokens/src/index.test.ts`

**Interfaces:**

- Produces: CSS variables and Tailwind colours `sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`.

- [ ] **Step 1: Write the failing test** in `index.test.ts`:

```ts
it('sidebar tokens exist and are covered by the contrast checks', () => {
  const pairs = contrastPairs.map(([a, b]) => `${a}/${b}`);
  expect(pairs).toContain('sidebar-foreground/sidebar');
  expect(pairs).toContain('sidebar-accent-foreground/sidebar-accent');
  expect(nonTextPairs.map(([a, b]) => `${a}/${b}`)).toContain('sidebar-ring/sidebar');
});
```

- [ ] **Step 2: Run** `pnpm vitest run --project tokens` — expect FAIL (pairs missing; TS error on unknown token names is also a fail).

- [ ] **Step 3: Add the tokens** with these exact values, and add the three pairs above:

| Token                          | light     | dark      |
| ------------------------------ | --------- | --------- |
| `sidebar`                      | `#FFFFFF` | `#1C2629` |
| `sidebar-foreground`           | `#212121` | `#F5F6F8` |
| `sidebar-accent` (active item) | `#FDE8E9` | `#3A1C1E` |
| `sidebar-accent-foreground`    | `#C8141C` | `#FF8A8F` |
| `sidebar-border`               | `#DEDEDE` | `#35424A` |
| `sidebar-ring`                 | `#ED1C24` | `#FF3B42` |

Then `pnpm --filter @sit/tokens build`, and add `--color-sidebar…: var(--sidebar…)` lines for all six to `globals.css`.

- [ ] **Step 4: Run** `pnpm vitest run --project tokens` — expect PASS (including "committed tokens.css is up to date" and the 4.5:1 / 3:1 checks; measured light 16.1, 5.01, ring ≥3).

- [ ] **Step 5: Commit** `Tokens: sidebar colours (sidebar navigation)`.

### Task 2: Sheet, DropdownMenu and `useIsMobile` primitives

**Files:**

- Create: `apps/web/components/ui/sheet.tsx`, `apps/web/components/ui/dropdown-menu.tsx`, `apps/web/lib/use-mobile.ts`
- Modify: `apps/web/components/ui/ui.test.tsx`, `apps/web/components/ui/primitives.stories.tsx`
- Test: `apps/web/lib/use-mobile.test.ts`

**Interfaces:**

- Produces: `Sheet, SheetTrigger, SheetContent({ side?: 'left'|'right' }), SheetHeader, SheetTitle, SheetDescription` (shadcn API; close button takes `closeLabel: string` prop instead of the hard-coded "Close"); `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator`; `useIsMobile(): boolean` with `MOBILE_BREAKPOINT = 768`.

- [ ] **Step 1: Write failing tests.** In `use-mobile.test.ts` (jsdom): `useIsMobile is false without matchMedia` (delete `window.matchMedia`, render hook, expect `false`) and `follows (max-width: 767px)` (stub `matchMedia` returning `matches: true`, expect `true`). In `ui.test.tsx`: `Sheet: opens with its title and closes with the labelled button` (click trigger → `getByRole('dialog', { name: 'Navigation' })`; click `getByRole('button', { name: 'Close' })` → dialog gone; axe clean) and `DropdownMenu: opens on click and runs an item` (`getByRole('menuitem', { name: 'Sign out' })`, `onSelect` called once).
- [ ] **Step 2: Run** `pnpm vitest run --project web components/ui lib/use-mobile.test.ts` — expect FAIL (modules missing).
- [ ] **Step 3: Implement** by copying shadcn's current `sheet.tsx` and `dropdown-menu.tsx` (new-york, `radix-ui` imports), keeping only the exports listed above, tokens only, `cn` from `@/lib/utils`. `useIsMobile` guards `typeof window === 'undefined' || !window.matchMedia` → `false`, as `lib/motion.ts` does.
- [ ] **Step 4: Run** the same command — expect PASS; add a `SheetAndMenu` story to `primitives.stories.tsx`.
- [ ] **Step 5: Commit** `UI: sheet, dropdown menu and useIsMobile primitives`.

### Task 3: Sidebar primitive

**Files:**

- Create: `apps/web/components/ui/sidebar.tsx`
- Test: `apps/web/components/ui/sidebar.test.tsx`; story in `primitives.stories.tsx`

**Interfaces:**

- Consumes: Task 2 primitives and `useIsMobile`; Task 1 colour utilities.
- Produces: `SidebarProvider({ defaultOpen?: boolean })`, `useSidebar(): { state: 'expanded'|'collapsed', open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }`, `Sidebar({ collapsible?: 'icon'|'offcanvas'|'none', mobileTitle: string, mobileCloseLabel: string })`, `SidebarTrigger({ label: string })`, `SidebarInset`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton({ isActive?: boolean, tooltip?: string, asChild?: boolean })`; constants `SIDEBAR_COOKIE_NAME = 'sidebar_state'`, `SIDEBAR_KEYBOARD_SHORTCUT = 'b'`.

- [ ] **Step 1: Write failing tests** in `sidebar.test.tsx` (jsdom, wrap in `TooltipProvider`):
  - `desktop: trigger collapses to icons and writes the cookie` — click `getByRole('button', { name: 'Toggle sidebar' })`; the sidebar element has `data-state="collapsed"` and `document.cookie` contains `sidebar_state=false`.
  - `Ctrl+B toggles the sidebar` — `user.keyboard('{Control>}b{/Control}')` flips `data-state`.
  - `active item is marked for assistive tech` — `<SidebarMenuButton asChild isActive><a href="/x">Projects</a>` → link has `aria-current="page"` and `data-active="true"`.
  - `mobile: trigger opens a titled sheet` — stub `matchMedia` to `matches: true`; click trigger → `getByRole('dialog', { name: 'Navigation' })`.
  - axe clean in expanded state.
- [ ] **Step 2: Run** `pnpm vitest run --project web components/ui/sidebar.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** by copying shadcn's `sidebar.tsx`, keeping only the exports above, with these changes: no hard-coded English (sheet title/close and trigger text come from `mobileTitle`, `mobileCloseLabel`, `label`); drop `SidebarRail`, `SidebarInput`, `SidebarMenuSkeleton`, `SidebarMenuSub*`, `SidebarMenuAction`, `SidebarMenuBadge`; hover uses `hover:bg-accent hover:text-accent-foreground` (neutral), active uses `data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium data-[active=true]:shadow-[inset_2px_0_0_var(--brand)]`; `SidebarMenuButton` sets `aria-current="page"` when `isActive`; `SidebarInset` renders a `<div>`, not shadcn's `<main>` (the shell already has `<main id="main">`). Keep widths `16rem` / icon `3rem` / mobile `18rem`.
- [ ] **Step 4: Run** the same command — expect PASS; add a `Sidebar` story (expanded and collapsed).
- [ ] **Step 5: Commit** `UI: shadcn sidebar primitive themed with tokens`.

### Task 4: Navigation model and role-gated items

**Files:**

- Create: `apps/web/components/features/app-shell/nav-items.ts`, `apps/web/components/features/app-shell/nav-items.test.ts`
- Modify: `apps/web/components/features/admin/admin-nav.tsx` (+ `admin.test.tsx:234-252`), `apps/web/components/features/portfolio/portfolio-page.tsx:259-272` (+ `portfolio.test.tsx:142-158`)

**Interfaces:**

- Consumes: Task 3 `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`.
- Produces:
  - `type NavSection = 'projects'|'profiles'|'portfolio'|'audit'|'users'|'guide'|'method'|'standards'`
  - `sectionFor(pathname: string): NavSection | null` — strips a leading `/en` or `/vi`, takes the first segment; `estimates` → `'projects'`; `admin/users` → `'users'`; unknown → `null`.
  - `NAV_ICONS: Record<NavSection | 'apiDocs', LucideIcon>` — FolderKanban, SlidersHorizontal, ChartColumn, ScrollText, Users, BookOpen, Calculator, ListChecks, FileCode2.
  - `SECTION_LABEL: Record<NavSection, string>` — message keys: `app.projects`, `app.profiles`, `app.portfolio`, `app.audit`, `app.users`, `content.nav.guide`, `content.nav.method`, `content.nav.standards`.
  - `PortfolioNavItem({ active: boolean })` replaces `PortfolioNavLink` (same `can(principal, 'portfolio.read', id)` rule).
  - `AdminNavGroup({ active: NavSection | null })` replaces `AdminNavLinks`: renders a whole `SidebarGroup` labelled `app.navGroups.admin`, or `null` when neither item is visible.

- [ ] **Step 1: Write failing tests.** `nav-items.test.ts`: `sectionFor maps nested and localised paths` — `'/projects/p1'→'projects'`, `'/vi/estimates/abc/compare'→'projects'`, `'/en/admin/users'→'users'`, `'/audit'→'audit'`, `'/'→null`, `'/vi'→null`. Update `admin.test.tsx` (wrap renders in `SidebarProvider` + `TooltipProvider`): same role assertions as today on `AdminNavGroup`, plus `admin group is hidden when no admin item is visible` (Estimator → `queryByText('Admin')` null and no links). Update `portfolio.test.tsx` to `PortfolioNavItem` with the same assertions.
- [ ] **Step 2: Run** `pnpm vitest run --project web components/features/app-shell/nav-items.test.ts components/features/admin components/features/portfolio` — expect FAIL.
- [ ] **Step 3: Implement** the model and the two items (run GitNexus `impact` on `AdminNavLinks` and `PortfolioNavLink` first; the only caller should be `app-shell.tsx`). Add `app.navGroups.{work,admin,reference}` to `en.json` ("Work", "Admin", "Reference") and `vi.json` ("Công việc", "Quản trị", "Tham khảo").
- [ ] **Step 4: Run** the same command plus `pnpm vitest run tests/unit/messages.test.ts` — expect PASS.
- [ ] **Step 5: Commit** `App shell: navigation model and role-gated sidebar items`.

### Task 5: AppShell with the sidebar, ADR-0015

**Files:**

- Modify: `apps/web/components/features/app-shell/app-shell.tsx`, `apps/web/app/[locale]/(app)/layout.tsx`, `apps/web/messages/en.json`, `apps/web/messages/vi.json`
- Modify: `apps/web/components/features/app-shell/app-shell.test.tsx`, `apps/web/tests/e2e/zz-sign-out.spec.ts`
- Create: `docs/adr/0015-sidebar-navigation.md`

**Interfaces:**

- Consumes: everything from Tasks 3–4; `LanguageSwitch`, `AdoptProfileLocale`, `NotificationBell` unchanged.
- Produces: `AppShellProps` gains `sidebarOpen?: boolean` (default `true`); `layout.tsx` passes `store.get(SIDEBAR_COOKIE_NAME)?.value !== 'false'`.

- [ ] **Step 1: Update the failing tests** in `app-shell.test.tsx` (keep the language-switch tests as they are):
  - `shows grouped navigation, the account menu and a skip link` — `getByRole('navigation', { name: 'Main' })`; links Projects, Profiles, Guide, Method, Standards, API reference (href `/api/v1/docs`); Projects has `aria-current="page"` (mock pathname is `/projects`); the slim bar is a `<header>` and `within(getByRole('banner')).getByText('Projects')` finds the section name; `getByRole('button', { name: 'Toggle sidebar' })`; clicking `getByRole('button', { name: 'Account menu for Synthetic Estimator' })` shows `getByRole('menuitem', { name: 'Sign out' })` whose link goes to `/api/auth/signout`; skip link still `#main`; axe clean.
  - `signed out shows sign-in and no account menu` — `userName={null}`: `getByRole('link', { name: 'Sign in' })`, `queryByRole('button', { name: /Account menu/ })` is null, `queryByRole('button', { name: /Notifications/ })` is null.
  - `choosing a link closes the mobile sheet` — stub `matchMedia` `matches: true`; open via trigger; click Profiles; dialog gone.
- [ ] **Step 2: Run** `pnpm vitest run --project web components/features/app-shell` — expect FAIL.
- [ ] **Step 3: Implement.** Structure: `SidebarProvider(defaultOpen=sidebarOpen)` → `Sidebar(collapsible="icon", mobileTitle=t('app.mainNav'), mobileCloseLabel=t('app.closeNav'))` with header (brand link to `/projects`), `<nav aria-label={t('app.mainNav')}>` around Work / `AdminNavGroup` / Reference groups, footer (`LanguageSwitch`, then account `DropdownMenu` whose trigger shows the name and has `aria-label={t('app.accountMenu', { name })}`, and a `Sign out` item rendered as `<a href="/api/auth/signout">`, or the Sign in button when signed out) → `SidebarInset` with the slim bar (`SidebarTrigger label={t('app.toggleNav')}`, section name via `SECTION_LABEL[sectionFor(usePathname())]`, `NotificationBell` when signed in), `<main id="main">`, footer disclaimer. Every `SidebarMenuButton` gets `tooltip={label}` (shown when collapsed) and its `NAV_ICONS` icon with `aria-hidden`; API reference also gets a trailing `ExternalLink` icon (`aria-hidden`). Close the mobile sheet on link click (`setOpenMobile(false)`). New messages: `app.toggleNav` "Toggle sidebar" / "Ẩn hoặc hiện thanh bên", `app.closeNav` "Close navigation" / "Đóng điều hướng", `app.accountMenu` "Account menu for {name}" / "Menu tài khoản của {name}". Remove `app.signedInAs` and `app.sessionMenu` from both files once grep shows no other use. All new VI wording goes through `pnpm i18n:review` before release.
- [ ] **Step 4: Update** `zz-sign-out.spec.ts` to open the account menu first: `page.getByRole('button', { name: /Account menu for/ })` → then `getByRole('menuitem', { name: 'Sign out' })`.
- [ ] **Step 5: Write `docs/adr/0015-sidebar-navigation.md`** from `0000-template.md`: context (header grew to nine links and wrapped), decision (layout A, hand-copied shadcn Sidebar, sidebar tokens, cookie-remembered collapse), consequences (one more set of copied primitives; E2E sign-out goes through the menu), relation to ADR-0005 (theme unchanged, red bar kept).
- [ ] **Step 6: Run** `pnpm check` — expect PASS; then `pnpm vitest run --coverage` and confirm `components/features/**` stays ≥ 80%.
- [ ] **Step 7: Commit** `App shell: sidebar navigation (ADR-0015)` after GitNexus `detect_changes`.

### Task 6: Full verification

- [ ] **Step 1:** `pnpm dev:up`, then `pnpm test:e2e` — expect all suites PASS (release 2 and 3 specs still reach Portfolio, Audit log and Users through the sidebar).
- [ ] **Step 2:** Check by hand at 1280px, 1024px and 375px wide: collapse to icons with tooltips, the sheet on mobile, both themes, Vietnamese. Note in the PR what was and was not checked.
- [ ] **Step 3:** `pnpm vitest run tests/unit/prototype-ui-parity.test.tsx` — expect PASS (the editor itself is unchanged).
