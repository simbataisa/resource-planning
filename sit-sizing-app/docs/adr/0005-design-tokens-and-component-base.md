# ADR-0005: Design tokens and component base

|                 |                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------- |
| **Status**      | Accepted for release 1. Token values are interim until the TCB-DS source is available (Q1). |
| **Date**        | 2026-11-12                                                                                  |
| **Deciders**    | Tech lead, product owner; design review of the Storybook catalogue                          |
| **Design refs** | Section 8; backlog U-01, U-02, U-03                                                         |

## Context

The design asks for a layered component base themed with TCB-DS. The TCB-DS source (Figma library, token package or CSS) has not been provided yet (Q1). The HTML prototype the QE team already uses carries a working palette in light and dark.

## Decision

1. **Tokens first.** `packages/tokens/src/tokens.ts` is the only place colours, radius, fonts and motion durations live. `tokens.css` is generated from it (`pnpm --filter @sit/tokens build`), and a test fails if the committed file is stale.
2. **Interim values = the prototype palette**, adjusted only where text failed WCAG AA. Examples: destructive `#C8102E` instead of `#ED1B24` for white text; darker good/warn/bad text on their soft backgrounds. A test checks 14 text/background pairs at 4.5:1 or better in both themes.
3. **Semantic names**, compatible with shadcn/ui (`background`, `primary`, `muted-foreground`, …), plus domain tokens (`rough`, `detailed`, `good`, `warn`, `bad`). Components use only these names. Replacing the palette with TCB-DS changes `tokens.ts` and nothing else.
4. **Tailwind CSS v4** through PostCSS, with an `@theme inline` mapping from tokens to utilities (`bg-primary`, `text-muted-foreground`).
5. **Layers** (enforced by ESLint):
   - layer 2 `components/ui`: shadcn/ui primitives on the `radix-ui` package;
   - layer 3 `components/patterns`: domain-free compositions such as StatCard, Field, NumberField, CollapsibleSection, StatusChip and ComparisonBars;
   - layer 4 `components/features`: estimate screens, from step 1.5.
6. **Motion**: anime.js only behind three hooks (`usePrefersReducedMotion`, `useCountUp`, `useEnterAnimation`). Motion is off when the OS asks for reduced motion, and never carries meaning.
7. **Review surface**: Storybook 10 (`@storybook/nextjs-vite`) with the a11y addon; component tests run Testing Library and axe in jsdom.

## Consequences

- When Q1 is answered: map TCB-DS tokens onto these names in `tokens.ts`, regenerate `tokens.css`, re-run the contrast test, then have design review the Storybook catalogue. The Keycloak login theme (`docker/keycloak/themes/tcb`) takes the same values.
- Brand red stays available as `brand` for highlights. The primary action colour is navy, because white text on the brand red is below AA.
- `pnpm-workspace.yaml` installs Linux builds of native packages too (`supportedArchitectures`), so the same `node_modules` runs tests in Linux sandboxes and containers.
