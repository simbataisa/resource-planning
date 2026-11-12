# ADR-0015: Sidebar navigation

|                 |                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Status**      | Proposed                                                                                                           |
| **Date**        | 2026-11-13                                                                                                         |
| **Deciders**    | Tech lead, product owner                                                                                           |
| **Design refs** | Section 8.1 (component layers), ADR-0005 (theme); `docs/superpowers/specs/2026-11-13-sidebar-navigation-design.md` |

## Context

The signed-in header (U-04) held the brand and up to nine links (Projects, Profiles, Portfolio, Audit log, Users, Guide, Method, Standards, API reference), plus the language switch, the notification bell, the user's name and sign-out. Releases 2 and 3 added the role-gated links, and the row now wraps on narrower screens. The product owner asked to replace it with a shadcn Sidebar.

## Options considered

Layout, chosen from three mockups:

| Option                                 | Pros                                                     | Cons                                   |
| -------------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| A · Everything in the sidebar (chosen) | One place for navigation and the account; a slim top bar | Sign-out moves into a menu             |
| B · Sidebar for links, header kept     | Most familiar                                            | Two bars of chrome, less vertical room |
| C · Icon rail by default               | Most width for the editor and compare tables             | New users must learn the icons         |

How it is built:

| Option                                        | Pros                                                                                    | Cons                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Copy shadcn's Sidebar source by hand (chosen) | Same route as the other primitives (ADR-0005); no new dependencies; every file reviewed | Upstream fixes are copied by hand                                                                   |
| shadcn CLI (`components.json`)                | Later additions are one command                                                         | Fetches code at build time (at odds with the 14-day release-age rule); second way to add components |
| Custom sidebar on Radix Collapsible/Dialog    | Less code                                                                               | Not the shadcn Sidebar; loses icon collapse, remembered state, shortcut and mobile sheet            |

## Decision

The signed-in navigation is a left sidebar (layout A) built from shadcn's Sidebar, copied into `components/ui` and trimmed. Links are grouped as Work (Projects, Profiles, Portfolio), Admin (Audit log, Users; hidden when neither is visible) and Reference (Guide, Method, Standards, API reference). The sidebar footer holds the language switch and an account menu with Sign out. A slim bar above the page holds the toggle, the current section's name and the bell. On desktop the sidebar collapses to icons (Ctrl/⌘+B), remembered in the `sidebar_state` cookie and read by the server layout; below 768px it is a slide-over sheet.

Changes from upstream shadcn: labels are props (no English in layer 2), the inset is a `<div>` because the shell owns `<main id="main">`, hover is neutral and only the active item gets the red tint and a 2px red marker. Six `sidebar-*` tokens are added to `packages/tokens` and covered by the contrast tests.

## Consequences

- The ADR-0005 theme is unchanged: the 4px red top bar, page grey, red focus and active marker stay.
- `components/ui` gains `sidebar.tsx`, `sheet.tsx` and `dropdown-menu.tsx`, plus `lib/use-mobile.ts` and `lib/sidebar-cookie.ts`.
- Sign-out now opens the account menu first; the E2E sign-out test does the same.
- The Vietnamese labels added here (`app.navGroups.*`, `app.toggleNav`, `app.closeNav`, `app.accountMenu`) go through `pnpm i18n:review`.
- If users miss the always-visible links on narrow laptops, start collapsed or move to option C by changing the default only.
