# Guided Tours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-time users are walked through the real screens to a saved first estimate, and new features can ship with a short tour, with "already seen" stored on the account.

**Architecture:** A pure tour layer in `apps/web/lib/tours` (registry, selection, browser copy) drives a `TourProvider` in `components/features/tours` that renders React Joyride in controlled mode across pages. Tour state is a new `User.tours` JSON column, read with `GET /me` and merged with `PATCH /me`, updated optimistically in the `['me']` query cache with no rollback.

**Tech Stack:** Next.js 16, React 19, React Joyride 3.2.x, TanStack Query, Zod 4, Prisma, next-intl, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-15-guided-tours-design.md` (approved). Read it before Task 1.

## Global Constraints

- Run all commands from `sit-sizing-app/`. Follow `AGENTS.md`; GitNexus `impact` before editing a symbol, `detect_changes` before each commit.
- Dependency: `react-joyride` 3.2.x (MIT, peer `react` 16.8–19). It is imported **only** in `apps/web/components/features/tours/` (ESLint-enforced).
- Tour ids match `/^[a-z0-9-]+@\d{1,3}$/`. Statuses: `completed`, `skipped`, `dismissed`.
- `PATCH /me` keeps at most **100** tour keys (oldest `at` dropped); a `null` value removes a key; `at` comes from `server/clock.ts`; tour updates are not audited.
- A `dismissed` tour starts again by itself when its `at` is earlier than `lastLoginAt`; `completed` and `skipped` never do.
- Optimistic close: update the `['me']` cache and `localStorage['sit-tours:<userId>']` first, then PATCH; **never roll back**; resend entries missing from `Me.tours` on the next load.
- A missing step target pauses the tour after **5 s**.
- Every user-facing string under `tours.*` in `messages/en.json` and `vi.json` (same keys). No hard-coded text.
- Accessibility: tooltip `role="dialog"` labelled by the step title, Esc dismisses, focus moves in and back, no animation under `prefers-reduced-motion`.
- Merged migrations are never edited; the new migration is additive. `packages/db` changes need a named human reviewer (tick the sensitive-path box in the PR).
- Validation failures return **400 `VALIDATION_FAILED`** (the app's existing behaviour; the spec's "422" is superseded, see Task 2).

## Review Focus

1. **`PATCH /me` with only `tours`** must not change the language → test in Task 2.
2. **localStorage unavailable** (private window, blocked storage) → tours still start and close; nothing throws → test in Task 3.
3. **Role changes between sessions** (Viewer finished `reading-tour@1`, later made Estimator) → `first-estimate@1` is still offered → test in Task 3.
4. **Target hidden** (sidebar collapsed or phone sheet closed, so a `nav-*` target is not visible) → the tour pauses instead of pointing at nothing → test in Task 5.
5. **Language switched mid-tour** → the open step re-renders in the new language without restarting → test in Task 5.

---

### Task 1: Tour schemas and the `/me` contract

**Files:**

- Modify: `packages/schemas/src/api.ts:48-60`
- Test: `packages/schemas/src/api.test.ts`

**Interfaces:**

- Produces: `TourKey`, `TourStatus`, `TourState` (Zod + inferred types); `Me` gains `tours: TourState`, `createdAt: string` (ISO), `lastLoginAt: string | null` (ISO); `MeUpdate = { locale?: 'en'|'vi'; tours?: Record<TourKey, { status: TourStatus } | null> }` refined to require at least one field; exported `TourUpdate` (the `tours` value type).

- [ ] **Step 1: Write the failing tests** in `api.test.ts`, `describe('tours')`:
  - `TourKey.safeParse('first-estimate@1').success === true`; `'First@1'`, `'tour'`, `'x@1234'` fail.
  - `MeUpdate.parse({ tours: { 'first-estimate@1': { status: 'skipped' } } })` succeeds with `locale` undefined.
  - `MeUpdate.parse({ tours: { 'first-estimate@1': null } })` succeeds.
  - `MeUpdate.safeParse({}).success === false`; `MeUpdate.safeParse({ tours: { 'bad key': { status: 'completed' } } }).success === false`; `{ status: 'seen' }` fails.
  - `Me.parse(sample)` accepts `tours: {}`, `createdAt`, `lastLoginAt: null`.
- [ ] **Step 2: Run** `pnpm vitest run --project schemas packages/schemas/src/api.test.ts` → FAIL (`TourKey` not exported).
- [ ] **Step 3: Implement** the schemas in `api.ts` with `.meta({ id })` and synthetic examples (`{ 'first-estimate@1': { status: 'completed' } }`). Export from `index.ts` if it re-exports explicitly.
- [ ] **Step 4: Run** the same command → PASS; `pnpm --filter @sit/schemas typecheck` → no errors.
- [ ] **Step 5: Commit** `schemas: tour state on Me and MeUpdate`.

### Task 2: Store tours on the user (migration, service, API)

**Files:**

- Modify: `packages/db/prisma/schema.prisma` (model `User`, line 72)
- Create: `packages/db/prisma/migrations/20261117000000_user_tours/migration.sql`
- Modify: `apps/web/server/services/me.ts`
- Modify: `apps/web/server/openapi/operations.ts:640-670` (examples only)
- Regenerate: `docs/api/openapi.json`
- Test: `apps/web/tests/integration/me.test.ts`

**Interfaces:**

- Consumes: Task 1 schemas.
- Produces: `getMe(user): Promise<Me>` now returns `tours`, `createdAt`, `lastLoginAt`; `updateMe(user, input)` merges tours. Pure helper `mergeTours(stored: TourState, update: TourUpdate, now: Date): TourState` exported from `apps/web/server/domain/tours.ts`.

- [ ] **Step 1: Write failing tests.**
  - Unit `apps/web/server/domain/tours.test.ts`: `mergeTours` sets `at = now.toISOString()` on new/changed keys, removes keys given `null`, keeps untouched keys, and with 101 keys drops the one with the oldest `at`.
  - Integration `me.test.ts`, new `describe('PATCH /me tours (guided tours)')`:
    - `dev-viewer` PATCH `{ tours: { 'first-estimate@1': { status: 'skipped' } } }` → 200, `json.tours['first-estimate@1'].status === 'skipped'`, **`json.locale` unchanged** (Review Focus 1); GET returns it; `dev-estimator`'s `tours` stays `{}`.
    - PATCH `{ tours: { 'first-estimate@1': null } }` → key gone.
    - PATCH `{ tours: { 'Bad Key': { status: 'completed' } } }` → 400 `VALIDATION_FAILED`; PATCH `{}` → 400.
    - GET `/me` has `createdAt` (ISO) and `lastLoginAt` (ISO or null).
- [ ] **Step 2: Run** `pnpm vitest run --project web apps/web/server/domain/tours.test.ts` → FAIL; `pnpm --filter @sit/web exec vitest run --config vitest.integration.config.ts tests/integration/me.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
  - `schema.prisma`: `tours Json @default("{}")` on `User`. Migration SQL: `ALTER TABLE "User" ADD COLUMN "tours" JSONB NOT NULL DEFAULT '{}';` Generate with `pnpm --filter @sit/db migrate:dev --name user_tours` locally, then rename the folder to `20261117000000_user_tours` so it sorts after `20261116000000_actuals_note`.
  - `domain/tours.ts`: `mergeTours` as above (pure, no `Date` construction; `now` is passed in).
  - `services/me.ts`: `getMe` reads `tours`, `createdAt`, `lastLoginAt` from the user row (select them; parse `tours` with `TourState`, falling back to `{}` if it fails). `updateMe` runs in a transaction: write `locale` only when present; when `tours` is present, read, `mergeTours(stored, input.tours, now())` with `now` from `server/clock.ts`, write.
  - `operations.ts`: update the `updateMe` request example to show both fields.
- [ ] **Step 4: Run** both test commands → PASS; `pnpm openapi:generate` then `pnpm openapi:check` → clean; `pnpm db:check` → OK.
- [ ] **Step 5: Commit** `me: store guided-tour state on the user (migration user_tours)`. Note in the commit body that `packages/db` needs a named reviewer.

### Task 3: Pure tour layer (registry types, selection, browser copy)

**Files:**

- Create: `apps/web/lib/tours/types.ts`, `apps/web/lib/tours/select.ts`, `apps/web/lib/tours/storage.ts`
- Test: `apps/web/lib/tours/select.test.ts`, `apps/web/lib/tours/storage.test.ts`

**Interfaces:**

- Consumes: `Me`, `TourState`, `TourStatus` from Task 1.
- Produces:
  - `types.ts`: `TourEvent = 'estimate-created' | 'version-saved'`; `TourStep { route: RegExp; target: string | 'center'; messageKey: string; placement?: 'top'|'bottom'|'left'|'right'|'auto'; advance: 'next'|'click'|'navigate'|{ event: TourEvent } }`; `TourDefinition { id: string; kind: 'onboarding'|'feature'; since: string; after?: string; audience: (me: Me) => boolean; steps: TourStep[] }`.
  - `select.ts`: `isSeen(id: string, me: Me, local: TourState): boolean`; `selectTour(me: Me, pathname: string, registry: TourDefinition[], local: TourState): TourDefinition | null` (pathname without locale prefix).
  - `storage.ts`: `readLocal(userId: string): TourState`; `writeLocal(userId: string, id: string, status: TourStatus, at: string): void`; `pendingSync(me: Me, local: TourState): Record<string, { status: TourStatus }>`.

- [ ] **Step 1: Write failing tests** (`select.test.ts`), using a small fake registry and a `me()` builder:
  - Unseen onboarding tour whose first step matches the path and whose audience matches → returned.
  - `completed` or `skipped` in either `me.tours` or `local` → not returned.
  - `dismissed` with `at` before `me.lastLoginAt` → returned; after → not returned.
  - Feature tour with `since` later than `me.createdAt` → returned only once the matching onboarding tour is `completed` or `skipped`; with `since` earlier than `createdAt` → never.
  - A tour with `after: 'first-estimate@1'` is not returned until that id is completed or skipped.
  - First step's route does not match the path → null.
  - **Review Focus 3:** `me` with `reading-tour@1` completed, now an Estimator → `first-estimate@1` is returned.
  - `storage.test.ts`: `readLocal` returns `{}` when `localStorage.getItem` throws and when the value is not valid JSON; `writeLocal` does not throw when `setItem` throws (**Review Focus 2**); `pendingSync` returns entries present in `local` and absent or different in `me.tours`.
- [ ] **Step 2: Run** `pnpm vitest run --project web apps/web/lib/tours` → FAIL.
- [ ] **Step 3: Implement** the three files. Order of preference in `selectTour`: onboarding before feature, then registry order. Validate `readLocal` output with `TourState.safeParse`.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `tours: pure registry types, selection and browser copy`.

### Task 4: Dependency, import boundary and ADR

**Files:**

- Modify: `apps/web/package.json`, `pnpm-lock.yaml`
- Modify: `eslint.config.mjs` (features block and `app/**` block)
- Create: `docs/adr/0017-guided-tours.md`

**Interfaces:**

- Produces: `react-joyride` installed; importing it outside `apps/web/components/features/tours/**` is a lint error.

- [ ] **Step 1: Write the failing check:** add a temporary file `apps/web/components/features/estimates/joyride-probe.tsx` containing `import Joyride from 'react-joyride';`.
- [ ] **Step 2: Run** `pnpm --filter @sit/web add react-joyride@~3.2.0` then `pnpm lint` → PASS (no rule yet, which is the failure to fix).
- [ ] **Step 3: Implement** the rule. Add `const JOYRIDE = [{ name: 'react-joyride', message: 'Only components/features/tours renders tours. (ADR-0017)' }];`. In the `apps/web/components/**` + `app/**` block use `restrict([], [...LOCALE_LINK, ...JOYRIDE])`; in the features block use `restrict(UI_FORBIDDEN, [...LOCALE_LINK, ...JOYRIDE])` with `ignores: ['apps/web/components/features/tours/**']`; add a block for `apps/web/components/features/tours/**/*.{ts,tsx}` with `restrict(UI_FORBIDDEN, LOCALE_LINK)` (flat config replaces rule options per block, so each block lists everything it needs).
- [ ] **Step 4: Run** `pnpm lint` → FAIL on `joyride-probe.tsx` with the ADR-0017 message. Delete the probe; `pnpm lint` → PASS. `pnpm licenses:check` → PASS; `pnpm audit --prod` → no high or critical.
- [ ] **Step 5: Write ADR-0017** (template `docs/adr/0000-template.md`): context, decision (React Joyride; account storage with optimistic, no-rollback update and browser copy), alternatives from spec section 5, consequences (new column, new dependency with licence and age noted).
- [ ] **Step 6: Commit** `web: add react-joyride behind a lint boundary (ADR-0017)`.

### Task 5: Tour provider, tooltip and optimistic saving

**Files:**

- Create: `apps/web/components/features/tours/tour-provider.tsx`, `tour-tooltip.tsx`, `use-tour-event.ts`, `tours.test.tsx`
- Modify: `apps/web/lib/query/hooks.ts` (add `useSaveTours`)
- Modify: `apps/web/components/features/app-shell/providers.tsx` (mount `TourProvider` inside the QueryClient provider)
- Modify: `apps/web/messages/en.json`, `vi.json` (`tours.controls.*`: `back`, `next`, `skip`, `finish`, `close`, `progress` = "{current} of {total}", `resume`, `take`)

**Interfaces:**

- Consumes: Task 3 (`selectTour`, `isSeen`, `readLocal`, `writeLocal`, `pendingSync`, `TourDefinition`, `TourEvent`); `api.updateMe` from `lib/api`.
- Produces:
  - `useSaveTours()`: mutation `(update: TourUpdate) => Promise<Me>`. `onMutate` writes the merged entries into `['me']` with `at = new Date().toISOString()` and calls `writeLocal`; `onSuccess` sets `['me']`; `onError` does **nothing** (no rollback).
  - `TourProvider({ registry, children })` and `useTours(): { active: TourDefinition | null; paused: boolean; start(id: string): void; resume(): void }`.
  - `useTourEvent(): (event: TourEvent) => void`.

- [ ] **Step 1: Write failing component tests** (`tours.test.tsx`, Testing Library, Joyride real, `useMe` mocked via a QueryClient seeded with a `Me`, `next/navigation` mocked):
  - On a matching path, the first step's title renders in a `role="dialog"`; Next moves to step 2.
  - A `click` step advances when its target is clicked; a `{ event: 'version-saved' }` step advances when `useTourEvent()('version-saved')` is called.
  - Skip → `['me']` cache shows `skipped` immediately, `localStorage` has it, `api.updateMe` called with `{ tours: { id: { status: 'skipped' } } }`; with `api.updateMe` rejecting, the tour **stays closed** and the cache still says `skipped`.
  - Esc → `dismissed` recorded the same way.
  - On mount with `localStorage` holding an entry missing from `me.tours`, `api.updateMe` is called once with it.
  - **Review Focus 4:** a step whose target never appears → after 5 s (fake timers) the dialog closes and `useTours().paused === true`; nothing is recorded.
  - **Review Focus 5:** re-render under the `vi` locale while a step is open → the step's VI title shows and the step index is unchanged.
  - With `prefers-reduced-motion: reduce` mocked, the provider passes Joyride its "no scroll animation" setting (`scrollDuration: 0` in v2 naming; use the v3 equivalent from the 3.2 docs) and disables the spotlight transition.
  - When a step opens, focus is inside the dialog; after Finish or Esc, focus is back on the page (`document.activeElement` is not inside a removed node).
  - Closing `no-project@1` in any way records `dismissed` (never `completed` or `skipped`), so it shows again at the next sign-in until the user is added to a project.
- [ ] **Step 2: Run** `pnpm vitest run --project web apps/web/components/features/tours` → FAIL.
- [ ] **Step 3: Implement.**
  - Provider: on `useMe()` success and on pathname change (strip the locale with the existing helper in `lib/path.ts` if it has one), call `selectTour`; keep `{ id, stepIndex }` in `sessionStorage['sit-tour-progress']` so a tour continues across pages; render `<Joyride run stepIndex continuous tooltipComponent={TourTooltip} … />` in controlled mode; translate steps by `messageKey` (`${key}.title`, `${key}.body`); handle Joyride's callback for `next`, `prev`, `skip`, `close` and `target not found` (start the 5 s pause timer instead of skipping); for the last step of `first-estimate@1`, record `completed` when the `version-saved` event arrives, then show the Done card.
  - Tooltip: TCB-DS tokens via existing `Button` from `components/ui`; title in `<h2 id>` referenced by `aria-labelledby`; progress text from `tours.controls.progress`.
- [ ] **Step 4: Run** the component tests → PASS; `pnpm test:coverage` → `components/features` ≥ 80% lines and branches.
- [ ] **Step 5: Commit** `tours: provider, tooltip and optimistic tour state`.

### Task 6: The four tours, their targets and events

**Files:**

- Create: `apps/web/lib/tours/registry.ts`, `apps/web/lib/tours/registry.test.ts`
- Modify (add `data-tour` attributes only): `components/features/app-shell/app-shell.tsx` and `nav-items.ts` (sidebar links), `components/features/projects/project-list.tsx`, `components/features/estimates/estimate-list.tsx`, `new-estimate-dialog.tsx`, `components/features/estimate-editor/estimate-editor.tsx` (tab triggers), `summary-cards.tsx`, `draft-toolbar.tsx`, `export-panel.tsx`, `components/features/results/results-panels.tsx` (gap table)
- Modify (events): `new-estimate-dialog.tsx:54` (`estimate-created` in `onSuccess` before `router.push`), `draft-toolbar.tsx:148` (`version-saved` after `save.mutateAsync` resolves)
- Modify: `messages/en.json`, `vi.json` (`tours.firstEstimate.*`, `tours.firstEstimateAdmin.*`, `tours.readingTour.*`, `tours.noProject.*`)

**Interfaces:**

- Consumes: Task 3 types, Task 5 `useTourEvent`.
- Produces: `TOURS: TourDefinition[]` with ids `first-estimate@1`, `first-estimate-admin@1` (`after: 'first-estimate@1'`), `reading-tour@1`, `no-project@1`; `data-tour` values: `nav-projects`, `project-list`, `estimate-list`, `new-estimate`, `estimate-name`, `create-estimate`, `tab-rough`, `tab-team`, `summary-cards`, `gap-table`, `save-status`, `save-version`, `export-panel`, `nav-users`, `nav-audit`, `nav-profiles`, `tour-menu`.

- [ ] **Step 1: Write the failing registry test** (`registry.test.ts`):
  - Ids unique and match the `TourKey` pattern.
  - Every `messageKey` has `title` and `body` in both `en.json` and `vi.json`.
  - Every non-`center` target `[data-tour="x"]` appears as `data-tour="x"` somewhere under `apps/web/components` (read the files with `fs` + glob in the test).
  - Audiences: `first-estimate@1` true for an Estimator, a QE Lead and an Admin with no memberships; false for a Viewer-only user and for a user with no memberships. `reading-tour@1` true only for Viewer-only. `no-project@1` true only for no memberships and not Admin. `first-estimate-admin@1` true only for Admin.
- [ ] **Step 2: Run** `pnpm vitest run --project web apps/web/lib/tours/registry.test.ts` → FAIL.
- [ ] **Step 3: Implement** the registry with the step order from spec 6.5 (first-estimate: welcome `center` → `project-list` (navigate) → `new-estimate` (click) → `estimate-name` (`{ event: 'estimate-created' }`) → `tab-rough` → `tab-team` → `summary-cards` → `gap-table` → `save-status` → `save-version` (`{ event: 'version-saved' }`) → done `center`). For Admins no change is needed: `server/services/projects.ts:23` already lists every project for `ADMIN`, so the `project-list` step offers all projects. Add the `data-tour` attributes and the two event calls. Write EN step copy; add VI entries, then run `pnpm i18n:review` to export them for review.
- [ ] **Step 4: Run** the registry test → PASS; `pnpm --filter @sit/web exec vitest run tests/unit/messages.test.ts` → PASS; `pnpm --filter @sit/web exec vitest run tests/unit/prototype-ui-parity.test.tsx` → PASS (attributes must not change what the editor shows).
- [ ] **Step 5: Commit** `tours: first-estimate, admin, reading and no-project tours`.

### Task 7: Entry points ("?" menu and Guide button)

**Files:**

- Create: `apps/web/components/features/tours/tour-menu.tsx`
- Modify: `apps/web/components/features/app-shell/app-shell.tsx:75-82` (render `TourMenu` beside `NotificationBell`)
- Modify: `apps/web/app/[locale]/(app)/guide/page.tsx` (a "Take the tour" button at the top, client island)
- Test: `apps/web/components/features/tours/tours.test.tsx` (extend), `components/features/app-shell/app-shell.test.tsx` (extend)

**Interfaces:**

- Consumes: Task 5 `useTours()`.
- Produces: `TourMenu()` with `data-tour="tour-menu"`; `TakeTourButton()`.

- [ ] **Step 1: Write failing tests:** the sidebar header has a button labelled by `tours.controls.menu` next to the bell; its menu shows "Take the tour", and "Resume tour" only when `paused`; choosing "Take the tour" calls `start` with the user's onboarding tour id (from `selectTour` ignoring seen state). Guide page renders the "Take the tour" button.
- [ ] **Step 2: Run** `pnpm vitest run --project web apps/web/components/features/tours apps/web/components/features/app-shell` → FAIL.
- [ ] **Step 3: Implement** with the existing `DropdownMenu` from `components/ui`, `HelpCircle` icon from `lucide-react`, keyboard-accessible, collapsed-sidebar friendly (icon only with a tooltip). Add `tours.controls.menu` to both message files.
- [ ] **Step 4: Run** the tests → PASS.
- [ ] **Step 5: Commit** `tours: help menu and Guide page entry points`.

### Task 8: End-to-end tests

**Files:**

- Modify: `apps/web/tests/e2e/auth.setup.ts`, `apps/web/playwright.config.ts` (an `OUTSIDER_STATE` and `VIEWER_STATE` like `LEAD_STATE`)
- Create: `apps/web/tests/e2e/tours.spec.ts`

**Interfaces:**

- Consumes: `PATCH /api/v1/me` with tours (Task 2); `data-tour` targets (Task 6).

- [ ] **Step 1: Change the setup first:** in `signIn`, after the "Projects" heading is visible and before `storageState`, call `page.request.patch('/api/v1/me', { data: { tours: { 'first-estimate@1': { status: 'completed' }, 'first-estimate-admin@1': { status: 'completed' }, 'reading-tour@1': { status: 'completed' } } } })` and expect 200. Do not click anything in the welcome card. Also sign in `dev-outsider` and `dev-viewer` into their own state files (same marking).
- [ ] **Step 2: Write `tours.spec.ts`** (`test.describe.serial`):
  - As `dev-outsider`: reset with `PATCH /me` `{ tours: { 'first-estimate@1': null } }`, reload `/en/projects` → welcome dialog visible; walk the steps: open project OTHER, New estimate, name `E2E · Tour first estimate`, Create, Next through the editor steps, Save version with a note → Done card visible; reload → no dialog; GET `/api/v1/me` shows `completed`.
  - Skip: reset, reload, press "Skip tour" → reload → no dialog.
  - Resume: reset, reload, go to `/en/profiles` mid-tour → dialog gone; open the "?" menu → "Resume tour" → back on the expected step.
  - As `dev-viewer`: reset `reading-tour@1`, reload → reading tour's first step visible.
  - axe check (existing helper in `tests/e2e/helpers.ts`) with a step open.
- [ ] **Step 3: Run** `pnpm test:e2e` → `tours.spec.ts` passes and every existing spec still passes.
- [ ] **Step 4: Commit** `e2e: guided tours, and existing users start with tours seen`.

### Task 9: Docs and the full suite

**Files:**

- Create: `docs/guide/adding-a-tour.md`
- Modify: `../SIT_Sizing_Model_Solution_Design.md` section 7 (new row "Guided tours": first-time guided estimate per role, feature tours, replay; ADR-0017)
- Modify: `docs/guide/features.html` (a short "Guided tours" section, same pattern as the others) and `README.md` feature list if it has one

- [ ] **Step 1: Write `adding-a-tour.md`:** add a `TourDefinition` with `kind: 'feature'`, `since` = release date, `after` if needed; add `data-tour` targets; add `tours.<name>.*` messages in EN and VI and run the VI review; bump the version (`@2`) to show a changed tour again; run the registry test.
- [ ] **Step 2: Propose the design edit** in section 7 (the design is the source of truth; flag it in the PR for the product owner).
- [ ] **Step 3: Run the full suite** (AGENTS.md "Before any merge"): `pnpm check`, `pnpm test:coverage`, `pnpm test:int`, `pnpm test:e2e`. All pass. Record each result for the PR.
- [ ] **Step 4: Commit** `docs: adding a tour, design row and feature guide section`.
