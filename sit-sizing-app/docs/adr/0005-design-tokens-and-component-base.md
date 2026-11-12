# ADR-0005: Design tokens and component base

|                 |                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Status**      | Accepted for release 1. Amended 2026-11-12: token values now come from TCB-DS (Q1, see below). |
| **Date**        | 2026-11-12                                                                                     |
| **Deciders**    | Tech lead, product owner; design review of the Storybook catalogue                             |
| **Design refs** | Section 8; backlog U-01, U-02, U-03                                                            |

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

## Amendment: TCB-DS adopted (2026-11-12)

The product owner provided TCB-DS (`../tcb-ds`, also available as the `tcb-ds` skill) and chose to adopt it before step 1.7.

- **Source.** TCB-DS was captured from the public techcombank.com website (`tcb-ds/context/source-context.md`), not from an internal component library. It is accepted as the answer to Q1 for release 1. If an internal TCB-DS library appears later, only `tokens.ts` changes.
- **Mapping.**
  - Surfaces and rules: white cards on the mist-grey canvas `#F5F6F8`, ink text `#212121`, `#DEDEDE` rules, 8px radius, a flatter card shadow.
  - Strong actions are black (`primary`). In dark mode they invert.
  - Red `#ED1C24` is the `brand` and focus-ring colour, used for active and brand signals only.
  - Status colours follow TCB-DS's success, warning and error set.
  - The dark theme follows `tcb-ds/system/variables.dark.css`.
- **AA departures, marked "AA:" in `tokens.ts`:**
  - Red behind white text uses TCB-DS's active red `#C70E1B` (5.9:1) instead of `#ED1C24` (4.0:1).
  - Status text uses darker shades of the TCB-DS hues.
  - Form-field outlines use `#8C8C8C`, because `#DEDEDE` gives 1.3:1 and WCAG 1.4.11 asks for 3:1.
  - A new test checks the 3:1 non-text contrast of field outlines, the focus ring and the series colours.
- **Chart series.** Rough (gold) and detailed (navy) keep the prototype's colours, so the meaning of the two series does not change for users of the HTML tool.
- **Fonts.** TCB-DS ships SF Pro Display web fonts. Apple's licence does not normally allow embedding them on a website, so the app keeps the system font stack, which shows SF Pro on Apple devices. The font files are not copied into the app.
- **Logo.** The Techcombank marks in `tcb-ds/logos` are not used until brand owners approve their use in an internal tool.
