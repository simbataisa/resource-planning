# Adding a guided tour

When a feature ships, add a short tour so people who already use the app find out about it. Design and decisions: [ADR-0017](../adr/0017-guided-tours.md).

## How it works

- Tours are data in `apps/web/lib/tours/registry.ts` (`TOURS`, type `TourDefinition` in `types.ts`).
- A feature tour is offered only to users created **before** its `since` date, so new users are not shown it on top of the first-estimate tour.
- Seen state is stored on the account (`User.tours`) and mirrored in the browser. The tour key is `<name>@<version>`.

## 1. Add the registry entry

```ts
{
  id: 'compare-versions@1',
  kind: 'feature',
  since: '2026-12-01T00:00:00.000Z', // release date
  after: 'first-estimate@1',          // optional: wait until this tour is completed or skipped
  audience: (me) => hasRole(me, 'ESTIMATOR', 'QE_LEAD'),
  steps: [
    step(ESTIMATE, tgt('compare-button'), `${CV}.open`, 'next', 'bottom'),
    step(ESTIMATE, 'center', `${CV}.done`),
  ],
},
```

- `kind` is `'feature'` (`'onboarding'` is for first-time tours).
- `audience` decides who sees it. Use the `hasRole` and `isAdmin` helpers at the top of the file.
- `step(route, target, messageKey, advance, placement)`:
  - `route` is a regex on the pathname without the locale prefix (`PROJECTS`, `PROJECT`, `ESTIMATE`, `ANY`).
  - `target` is a CSS selector (`tgt('name')` gives `[data-tour="name"]`), or `'center'` for a centred card.
  - `advance` is `'next'` (default), `'click'` (user clicks the target), `'navigate'` (user goes to the next route), or `{ event: 'estimate-created' | 'version-saved' }`.
  - `placement` is `top`, `bottom`, `left`, `right` or `auto`.
- A step can add `values: (me) => ({ email: me.email })` to fill ICU placeholders in its messages.
- The id must match the `TourKey` schema: a lower-case slug, `@`, then a 1 to 3 digit version.

## 2. Add `data-tour` targets

Put `data-tour="compare-button"` on the element the step points at. Targets are stable names, not styling classes.

Sidebar links go through `SidebarNavLink`, which has a `tour` prop that renders `data-tour`:

```tsx
<SidebarNavLink href="/portfolio" tour="nav-portfolio" ... />
```

Do not rename an existing target without updating the registry; the registry test checks that every selector appears in the source.

## 3. Add messages in EN and VI

Add `tours.<name>.<step>.title` and `tours.<name>.<step>.body` to `apps/web/messages/en.json` and `vi.json` (the `messageKey` of a step is `tours.<name>.<step>`). Keep the same keys in both files. Then send the Vietnamese text through review:

```bash
pnpm i18n:review   # export for the reviewer; apply with pnpm i18n:apply (docs/i18n/README.md)
```

## 4. Show a changed tour again

Bump the version in the id: `compare-versions@1` becomes `compare-versions@2`. Everyone sees it again, because seen state is per key. Update any test or E2E that names the old key.

## 5. Check

```bash
pnpm vitest run --project web apps/web/lib/tours/registry.test.ts
pnpm check
```

The registry test checks unique ids that match `TourKey`, a title and body in both languages for every step, and that each `data-tour` target exists in the source. Run `pnpm test:e2e` when the tour crosses pages.
