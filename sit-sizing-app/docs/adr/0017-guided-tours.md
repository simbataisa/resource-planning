# ADR-0017: Guided tours

|                 |                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Status**      | Proposed                                                                                     |
| **Date**        | 2026-11-15                                                                                   |
| **Deciders**    | Tech lead, product owner                                                                     |
| **Design refs** | `docs/superpowers/specs/2026-11-15-guided-tours-design.md` (sections 2, 5 and 6.3), ADR-0015 |

## Context

People opening SIT Sizing for the first time do not know where to start, and the editor has many inputs. The product owner asked for a guided tour that walks a new person through the real screens until they have created and saved their first estimate, and for short tours of a single feature when one ships later. Three things need a decision: the tour library, where "already seen" is remembered, and where the library may be imported.

Constraints: the licence gate (`deploy/ci/license-check.mjs`) fails AGPL packages; the CSP allows scripts only by nonce, so the library must be bundled and never loaded from a CDN; `minimumReleaseAge` is 14 days; a new dependency must state why it is needed and its licence (AGENTS.md rule 11).

## Options considered

**Library**

| Option                     | Licence     | Pros                                                                                 | Cons                                                          |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **React Joyride (chosen)** | MIT         | React-native API (`steps`, `run`, `stepIndex`, callback); controlled mode; React 19. | Adds a dependency (about ten small transitive packages).      |
| Driver.js                  | MIT         | Small and framework-free.                                                            | Imperative; we would wrap it for React and routing ourselves. |
| Intro.js                   | AGPL / paid | Familiar API.                                                                        | Fails the licence gate.                                       |

**Storing "already seen"**

| Option                                         | Pros                                         | Cons                                                         |
| ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Browser only (localStorage)                    | No database change.                          | Tours replay on every new browser, device or private window. |
| Account only, wait for the save                | Exact.                                       | A spinner on Skip, and a failed save brings the tour back.   |
| **Account, optimistic, browser copy (chosen)** | Instant UI; follows the user across devices. | One additive migration, which needs a named reviewer.        |

## Decision

Use **React Joyride 3.2.x** (MIT, peer `react` 16.8 to 19). Version 3.2.0 was published 2026-07-09, so it passes the 14-day release-age rule; the range is pinned to `~3.2.0`. It is needed because a multi-page, controlled tour with focus handling and positioning is more code than we want to own; Driver.js was close but imperative, and Intro.js fails the licence gate.

Store tour state on the account as `User.tours` (JSON, default `{}`), exposed on `Me` and changed through `PATCH /api/v1/me`. The client closes a tour optimistically: it updates the `['me']` cache and `localStorage['sit-tours:<userId>']` first, then sends the PATCH in the background. It never rolls back, so a failed save cannot replay a tour the user just closed; entries present in the browser but missing from `Me.tours` are sent again on the next load. Before `/me` loads no tour starts, and a tour counts as seen if either copy says so.

Import `react-joyride` only under `apps/web/components/features/tours/`. An ESLint `no-restricted-imports` path rule blocks it everywhere else in `apps/web/components` and `apps/web/app`, with a message pointing to this ADR. Flat config replaces rule options per block, so every block that matches a component file (ui, patterns, features, and the components and app block) lists the library rule next to the existing ones, and the tours folder has its own block without it.

## Consequences

- Easier: adding a tour for a new feature is a registry entry, step messages and `data-tour` targets. Tours follow the user across devices.
- New column `User.tours` (additive, expand-only migration `user_tours`); `packages/db` changes need a named human reviewer.
- Existing accounts start with no tours seen, so every current user gets the first-time tour at their next sign-in after release (product-owner decision, 2026-11-15). Tell users in the release notes; they can choose "Skip tour".
- New dependency: `react-joyride` 3.2.0 (MIT) with small transitive packages (`@gilbarbara/*`, `@fastify/deepmerge`, `is-lite`, `react-innertext`, `scroll`, `scrollparent`, `type-fest`). It is bundled with the app, so the CSP is unchanged. Joyride's inline styles are allowed by the existing `style-src 'unsafe-inline'`.
- `pnpm licenses:check` already fails on two unrelated packages on macOS (`@img/sharp-libvips-darwin-arm64`, `buffers`) before this change; Joyride and its additions are not among them.
- Harder: a later change that needs Joyride outside the tours folder must change this rule and this ADR.
- We would know the decision was wrong if the library blocks a React upgrade or the licence gate flags a release. We would then replace it behind the tours folder, since nothing else imports it.
