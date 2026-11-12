# Sidebar navigation — design

Date: 2026-11-13 · Size: small change · Status: awaiting approval

## Intent

Revamp the signed-in navigation: replace the horizontal header nav in `components/features/app-shell/app-shell.tsx` with a shadcn Sidebar. The header has grown to up to nine links plus language, bell, user name and sign-out, and wraps on narrower screens. The change is recorded in a new ADR.

## Goals

- Every link that is in the header today moves into a left sidebar, grouped:
  - **Work:** Projects, Profiles, Portfolio (role-gated, as today)
  - **Admin:** Audit log (QE Lead or Admin), Users (Admin). The group heading shows only when at least one link in it is visible.
  - **Reference:** Guide, Method, Standards, API docs (still a plain `<a>` to `/api/v1/docs`, marked as leaving the app)
- The sidebar header holds the brand (tagline + "SIT Sizing", linking to `/projects`).
- The sidebar footer holds the language switch and a user menu (the user's name; opens a menu with **Sign out**). When signed out, the footer shows the **Sign in** button.
- A slim bar above the page holds the sidebar toggle, the current section's name (from the first route segment, e.g. "Projects"), and the notification bell.
- The current section's link is marked active (`aria-current="page"`, red marker).
- Desktop: collapses to icons with tooltips; the state is remembered (shadcn's cookie); Ctrl/⌘+B toggles it. Below the mobile breakpoint the sidebar opens as a slide-over sheet.

## Non-goals

- No change to which links a role sees, or to their names (tests and EN/VI messages keep matching).
- No per-page breadcrumb with project or estimate names.
- No change to the content area, the disclaimer footer, the skip link or the 4px red top bar (ADR-0005 theme stays).

## Anti-goals

- A sidebar that hides links from keyboard or screen-reader users, or fails the axe checks.
- Wide pages (editor, compare, portfolio) losing usable width with no way to get it back.
- New npm dependencies, or anything fetched at build time.

## Approaches

1. **Copy the shadcn Sidebar source in by hand (chosen).** Same route as the existing primitives (ADR-0005): shadcn code, themed by tokens, on the single `radix-ui` package. Adds `sidebar.tsx`, `sheet.tsx`, `dropdown-menu.tsx` and a `use-mobile` hook to `components/ui`. No new dependencies; every file reviewed. Cost: upstream fixes are copied by hand, as for every primitive.
2. **shadcn CLI** (`components.json` + `npx shadcn add sidebar`). Easier future additions, but fetches code at build time (at odds with the 14-day release-age rule), needs reformatting and re-theming, and adds a second way to bring in components.
3. **Custom sidebar on Radix Collapsible/Dialog.** Less code, but not the shadcn Sidebar asked for, and loses its icon collapse, remembered state, shortcut and mobile behaviour.

Picked by the user: **1**, because it matches how the codebase already brings in shadcn and avoids the network and supply-chain concerns of 2.

## Decided

- Layout A (everything in the sidebar), chosen by the user from three mockups (A, B header kept for utilities, C icon rail by default).
- Grouping, footer, slim top bar, collapse behaviour and kept elements as above (proposed and approved together).
- A new ADR, **ADR-0015: sidebar navigation**, recording the change from the header nav as an addition to the ADR-0005 theme.

## My calls (correct any)

- **Tokens:** add `sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring` (and the primary pair) to `packages/tokens/src/tokens.ts`, mapped to existing values (white card, ink, a soft red tint with the darker red text, `#DEDEDE` rule, red focus), so the copied component stays token-only and the contrast tests cover the new pairs.
- **Icons:** lucide icons for each link (needed for the collapsed state).
- **Default state:** expanded on first visit.
- **The `PortfolioNavLink` and `AdminNavLinks` role checks** are reused; they are reshaped to render sidebar menu items rather than inline links.
- **New messages** (group labels, toggle label, user-menu label) go into `en.json` and `vi.json`; VI wording goes through `pnpm i18n:review` as usual.

## Left to the builder

- Exact shadcn Sidebar version to copy from, and adapting it to the repo's lint and format rules.
- Icon choices per link.
- Test updates: `app-shell.test.tsx` (navigation landmark, "Signed in as" text replaced by the user menu, sign-out now inside the menu), `tests/e2e/zz-sign-out.spec.ts` (open the user menu before clicking Sign out), plus component tests and Storybook stories for the new primitives, axe checks, and a reduced-motion check for the slide and collapse.
- Keep coverage at the layer gates (features 80%).
