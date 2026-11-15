# Guided tours — design

|            |                                                                                |
| ---------- | ------------------------------------------------------------------------------ |
| **Status** | Draft for product-owner approval                                               |
| **Date**   | 2026-11-15                                                                     |
| **Refs**   | Solution design sections 7, 8, 9, 10.5, 11; ADR-0006, ADR-0010, ADR-0015       |
| **Needs**  | ADR-0017 (new dependency, new user field); named human review of the migration |

## 1. Intent

People opening SIT Sizing for the first time do not know where to start, and the editor has many inputs. A guided tour walks a new person through the real screens until they have **created and saved their first estimate**. When a new feature ships later, existing users get a short tour of just that feature.

The tour teaches by doing: the user's first estimate is real work in their own project, not a demo.

## 2. Decisions made with the product owner

1. **Library: React Joyride** (MIT, 3.2.0, peer `react` 16.8–19). Intro.js was rejected: its free licence is AGPL, which `deploy/ci/license-check.mjs` fails.
2. **Goal of the first-time tour:** the user creates and saves version 1 of a real estimate.
3. **Where that estimate lives: option A**, a real estimate in a project the user belongs to. No practice project, no new archive feature in this work.
4. **"Already seen" is stored on the account, updated optimistically, with a browser copy as fallback** (section 6.3).
5. **Different first-time experience per role** (section 6.5): full guided estimate for Estimators and QE Leads, a reading tour for Viewers, a one-card message for people in no project yet, and an extra admin step for Admins.
6. **No new-feature tour content ships with this work.** It ships the mechanism and a how-to for adding one.
7. **Existing accounts see the first-time tour too** (decided 2026-11-15, after the final review). `User.tours` starts empty for everyone, so every current user gets their onboarding tour at the next sign-in after release. No backfill and no `since` rule for onboarding.

## 3. Goals, non-goals, anti-goals

**Goals**

- An Estimator signing in for the first time can follow the tour to a saved version 1 without outside help.
- A tour already finished or skipped never starts by itself again, on any browser or device.
- Adding a tour for a new feature is a small, documented change: a registry entry, step messages and `data-tour` targets.
- Every tour can be replayed on demand.

**Non-goals**

- Archiving or deleting estimates (a separate change, option C in the brainstorm).
- A practice or sandbox project.
- Usage analytics on tours (who finished, where people drop off).
- Editing tours from an admin screen; tours live in code.
- Content for any specific new-feature tour.

**Anti-goals (would make this a failure even if it works)**

- A tour blocks real work: it cannot be closed, or it traps keyboard focus with no way out.
- A tour the user closed comes back on the same browser because a save failed.
- A tour points at a button the user does not have (wrong role) or at an element that is not on screen.
- The existing E2E suite becomes flaky because a tour pops up over the screens it tests.

## 4. Constraints

- `AGENTS.md` rules apply, in particular: schema first (5), layers (6), i18n EN and VI (9), accessibility (10), new dependency stated and licence-checked (11), API changes include the contract (15), migrations reviewed by a named human (human controls).
- `minimumReleaseAge` is 14 days; React Joyride 3.2.0 was published 2026-07-09.
- The CSP allows inline styles (`style-src 'self' 'unsafe-inline'`) and scripts only by nonce. Joyride is bundled, never loaded from a CDN.
- Components never fetch directly: data goes through `lib/api` and TanStack Query hooks in `lib/query`.
- Merged migrations are never edited; the new migration is additive (expand-only).

## 5. Approaches

**Library**

| Option                     | Licence     | Trade-off                                                                                                             |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| **React Joyride (chosen)** | MIT         | React-native API (`steps`, `run`, `stepIndex`, callback); controlled mode suits multi-page tours; React 19 supported. |
| Driver.js                  | MIT         | Small and framework-free, but imperative; we would wrap it ourselves for React and routing.                           |
| Intro.js                   | AGPL / paid | Fails the licence gate.                                                                                               |

**Storing "already seen"**

| Option                                             | Trade-off                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Browser only (localStorage)                        | No database change; tours replay on every new browser, device or private window.                       |
| Account only, wait for the save                    | Exact, but a spinner on Skip, and a failed save brings the tour back.                                  |
| **Account, optimistic, browser fallback (chosen)** | Instant UI, follows the user across devices; costs one additive migration that needs a named reviewer. |

## 6. Design

### 6.1 Shape

```
lib/tours/registry.ts     tour definitions (ids, versions, audience, steps)   pure, unit-tested
lib/tours/select.ts       which tour (if any) to start for this user and page pure, unit-tested
lib/tours/storage.ts      browser copy (localStorage) with try/catch          small, unit-tested
components/features/tours/
  tour-provider.tsx       context: current tour, step, start/resume/finish; renders Joyride
  tour-tooltip.tsx        Joyride tooltip in TCB-DS tokens and next-intl strings
  tour-menu.tsx           "Take the tour" / "Resume tour" entry points
  use-tour-event.ts       hook for screens to report events (e.g. version saved)
```

- `TourProvider` is mounted in `components/features/app-shell/providers.tsx`, inside the QueryClient provider there. next-intl wraps `Providers` from `app/[locale]/layout.tsx`, so translations, `useMe()` and the router are all available.
- React Joyride is imported **only** in `tour-provider.tsx` and `tour-tooltip.tsx`; no other component imports it (same rule as anime.js in design 8.4). An ESLint `no-restricted-imports` rule enforces it.
- Joyride runs in **controlled mode** (`stepIndex` and `run` owned by the provider), because steps span several pages.

### 6.2 Tour definitions

```ts
type TourId = `${string}@${number}`; // e.g. 'first-estimate@1'
interface TourStep {
  route: RegExp; // page the step belongs to, without locale prefix
  target: string | 'center'; // `[data-tour="…"]` selector, or a centred card
  messageKey: string; // next-intl key under `tours.<tour>.<step>` (title + body)
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  advance: 'next' | 'click' | 'navigate' | { event: TourEvent };
}
interface TourDefinition {
  id: TourId;
  kind: 'onboarding' | 'feature';
  since: string; // ISO date the feature shipped (feature tours)
  audience: (me: Me) => boolean;
  steps: TourStep[];
}
type TourEvent = 'estimate-created' | 'version-saved';
```

- Targets use stable `data-tour="…"` attributes added to the real elements, never translated text or CSS classes.
- `advance`:
  - `next`: the user presses Next.
  - `click`: the step's target is clicked (e.g. "New estimate").
  - `navigate`: the next step's `route` matches after a page change.
  - `{ event }`: a screen reports an event through `useTourEvent()`; the draft toolbar reports `version-saved` after a successful save, the create dialog `estimate-created`.
- Changing a tour enough that people should see it again means bumping its version (`@2`). Old entries in storage are then ignored.

### 6.3 Remembering "already seen"

**Data.** `User.tours Json @default("{}")`, migration `<timestamp>_user_tours` (additive). Shape, as a Zod schema in `@sit/schemas`:

```ts
export const TourKey = z.string().regex(/^[a-z0-9-]+@\d{1,3}$/);
export const TourStatus = z.enum(['completed', 'skipped', 'dismissed']);
export const TourState = z.record(TourKey, z.object({ status: TourStatus, at: z.iso.datetime() }));
```

**API** (schema → service → route → `operations.ts` → `pnpm openapi:generate`):

- `Me` gains `tours: TourState`, `createdAt` (the user row's creation time, which is the first sign-in, since rows are provisioned at the callback) and `lastLoginAt` (the existing column, set at each sign-in in `server/auth/provision.ts`).
- `MeUpdate` becomes `{ locale?: 'en'|'vi', tours?: Record<TourKey, { status: TourStatus } | null> }`, with at least one field. The service:
  - writes `locale` only when it is present (today `updateMe` writes it unconditionally; it needs a guard);
  - merges the given tours into the stored object; a `null` value **removes** that key (used by the E2E reset, and harmless: it only touches the user's own preferences);
  - sets `at` from `server/clock.ts`, keeps at most 100 keys (oldest dropped), and returns the updated `Me`;
  - does not audit, like the language preference.

**Client flow (optimistic, no rollback).**

1. The user presses Finish, Skip or ✕ (or Esc).
2. The provider updates the `['me']` query cache at once and closes the tour.
3. It writes the same entry to localStorage under `sit-tours:<userId>`.
4. It sends `PATCH /api/v1/me` in the background.
   - Success: nothing more to do.
   - Failure: the entry stays "seen" in this browser; on the next page load, entries present in localStorage but missing from `Me.tours` are sent again. There is **no rollback**: a failed save must not replay a tour the user just closed.
5. Before `/me` has loaded, no tour starts. When it loads, a tour is considered seen if either the account or the browser copy says so.

**Statuses.**

| Status      | Set by         | Starts again by itself?                                                                                                           |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `completed` | Last step done | Never                                                                                                                             |
| `skipped`   | "Skip tour"    | Never                                                                                                                             |
| `dismissed` | ✕ or Esc       | At every sign-in after it was closed (`at` earlier than `lastLoginAt`), until it is completed or skipped (product-owner decision) |

Replaying from the menu always works and does not change the stored status until the replay ends.

### 6.4 Choosing a tour

`select.ts` is pure: `(me, pathname, registry, seen) → TourDefinition | null`.

- At most one tour starts automatically per page load.
- Onboarding comes first. Feature tours start only after the user's onboarding tour is `completed` or `skipped`.
- A **feature tour** is offered only to users whose `createdAt` is before its `since` date; newer users meet the feature in onboarding.
- A tour starts only if its first step's `route` matches the current page and the user is in its audience.

### 6.5 First-time tours

| Tour id                  | Audience                                               | Steps (summary)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `first-estimate@1`       | Estimator or QE Lead in at least one project, or Admin | Welcome card → Projects list: open your project → Project page: "New estimate" (click) → Create dialog: name it after your next release, worked example preselected (event `estimate-created`) → Editor: Rough scope tab → Window/team tab → Summary cards (rough vs detailed, FTE range) → Gap table → Autosave and the edit lock → "Save version" (event `version-saved`) → Done card: submit for review next, links to the guide |
| `first-estimate-admin@1` | Admin                                                  | After `first-estimate@1`: Users, Audit log, Global profiles in the sidebar (three steps)                                                                                                                                                                                                                                                                                                                                            |
| `reading-tour@1`         | Viewer only (no Estimator or QE Lead role anywhere)    | Open a project → open an estimate → summary cards → gap table → export → card: a QE Lead can make you an Estimator                                                                                                                                                                                                                                                                                                                  |
| `no-project@1`           | In no project and not Admin                            | One centred card: "Ask your QE Lead to add you to a project", showing the user's email. Not stored as `completed`: the real tour starts at the first sign-in after they are added                                                                                                                                                                                                                                                   |

- If the user has several projects with an editing role, the projects step lets them choose; with exactly one, it points at that one.
- **Admins** can open every project, so for an Admin the projects step offers every active project, whether or not they are a member (product-owner decision). `first-estimate-admin@1` starts after `first-estimate@1` is completed or skipped.
- **Finishing.** On `version-saved` the provider records `completed` (cache, browser copy, PATCH) and then shows the Done card, which stays until the user closes it. Closing the Done card changes nothing further.
- **Leaving the path.** If the user navigates somewhere the next step does not expect, the tour pauses (stays `in progress` in sessionStorage) and the menu shows "Resume tour". Resuming navigates back to the step's route. The tour is never marked seen by a pause.
- **Missing target.** If a step's target does not appear within 5 seconds, the tour pauses rather than pointing at nothing.
- `first-estimate@1` is marked `completed` only on the `version-saved` event, so "completed" means a version really exists.

### 6.6 Entry points

- **Sidebar header:** a "?" button next to the notification bell opens a small menu: "Take the tour" (replay the user's onboarding tour) and "Resume tour" when one is paused. Placement next to the bell follows ADR-0015's sidebar-only shell (builder's call; to confirm in review).
- **Guide page** (`/guide`): a "Take the tour" button at the top.

### 6.7 Look, language and accessibility

- The tooltip is a custom `tour-tooltip.tsx` using TCB-DS tokens (red primary button, surface, radius); the spotlight uses the overlay token. No Joyride default styling.
- All text comes from `messages/en.json` and `vi.json` under `tours.*`, including Back, Next, Skip tour, Finish and the step counter ("3 of 11"). The key-parity test covers them; VI goes through `pnpm i18n:review` / `pnpm i18n:apply`.
- Keyboard: Tab moves within the tooltip, Enter activates, Esc dismisses. Focus moves to the tooltip when a step opens and returns to the target or the page afterwards. The tooltip has `role="dialog"`, a label from the step title, and the step counter announced.
- `prefers-reduced-motion`: no smooth scrolling or spotlight animation.
- The tour never blocks the page permanently: Skip tour and ✕ are always visible.

### 6.8 Tests

- **Unit:** `select.ts` (audience per role, onboarding before feature tours, `since` rule, dismissed vs sign-in time), `storage.ts` (try/catch when storage is unavailable), registry integrity (unique ids, every `messageKey` in both languages, every `target` has a matching `data-tour` in the source).
- **Component:** `TourProvider` with a mocked `useMe` and Joyride rendered: starts, advances on click/navigate/event, optimistic close, no rollback on a failed PATCH, pause on missing target. Coverage gate 80% for `components/features`.
- **Integration:** `PATCH /me` merges tours, rejects bad keys (422), keeps locale behaviour, caps at 100 keys; `GET /me` returns `tours`, `createdAt`, `lastLoginAt`.
- **E2E:**
  - A new `tours.spec.ts` resets tours through `PATCH /me` (`null` values) and walks `first-estimate@1` to a saved version as **`dev-outsider` in project OTHER**, so the DEMO data the other specs rely on is untouched. It also covers Skip and Resume. Specs run serially (`playwright.config.ts`), so the reset cannot race another spec.
  - `dev-viewer` drives `reading-tour@1`.
  - `no-project@1` is covered by component tests only: an E2E user with no project would need a realm change (sensitive path).
  - The shared setup (`tests/e2e/auth.setup.ts`) marks every onboarding tour `completed` with `PATCH /me` **after** the "Projects" heading appears and before saving the storage state, so the existing suite never sees a tour. Until that call, the welcome card may open over the page; the setup must not depend on clicking through it.
- **Accessibility:** axe on a page with an open tour step.

## 7. What changes outside `components/features/tours`

| Area                                                    | Change                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/db` (sensitive path)                          | `User.tours` column and migration; named human reviewer                                     |
| `packages/schemas/src/api.ts`                           | `TourKey`, `TourStatus`, `TourState`; `Me` and `MeUpdate` extended                          |
| `apps/web/server/services` and `dto.ts`                 | Merge logic for tours; `Me` DTO fields                                                      |
| `apps/web/server/openapi/operations.ts`                 | Updated examples; `docs/api/openapi.json` regenerated                                       |
| App shell, editor, project page, create dialog, results | `data-tour` attributes; `useTourEvent` calls in the create dialog and draft toolbar         |
| `messages/en.json`, `vi.json`                           | `tours.*` keys                                                                              |
| `apps/web/package.json`                                 | `react-joyride` 3.2.x; licence check and `pnpm audit` clean                                 |
| `eslint.config`                                         | Restrict `react-joyride` imports to the tours feature folder                                |
| `docs/adr/0017-guided-tours.md`                         | Library and storage decision                                                                |
| `docs/guide/adding-a-tour.md`                           | How to add a feature tour: registry entry, messages, targets, `since`, version bump         |
| Solution design section 7                               | New row "Guided tours" (the design is the source of truth; propose the edit in the same PR) |
| Playwright setup                                        | Mark onboarding tours completed for existing spec users                                     |

## 8. Left to the builder

- Exact step wording (EN first, VI through the review kit), within the step summaries above.
- Which existing element carries each `data-tour` attribute, and the names of the attributes.
- Whether `useTourEvent` is a context call or a small event emitter.
- The exact placement and icon of the "?" button, within the sidebar header.
- Timestamp format of the migration name.

## 9. Open questions for the product owner

None blocking. To confirm in review: the "?" button next to the bell (6.6).

## 10. Calls made by the designer after the builder check

These were settled without the product owner; check them while reading.

- Use the existing `lastLoginAt` column instead of a new `lastSignInAt`; `createdAt` stands for the first sign-in.
- `MeUpdate.locale` becomes optional with a guard in `updateMe`.
- A `null` tour value removes the key (needed for the E2E reset).
- E2E users: `dev-outsider` in OTHER for the guided estimate, `dev-viewer` for the reading tour; no E2E for the no-project card.
- `completed` is recorded on `version-saved`, before the Done card shows.
- The Playwright setup marks onboarding tours completed after sign-in.
