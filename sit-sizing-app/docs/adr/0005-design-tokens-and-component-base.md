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

## Amendment: TCB-DS red in the prototype's theme (2026-11-12)

The product owner provided TCB-DS (a package captured from the public techcombank.com site) and decided:

1. Use the TCB-DS red `#ED1C24`.
2. Follow the theme of the HTML prototype (`SIT_Sizing_Model.html`).
3. Keep the system font stack, and do not use the Techcombank logo for now.

The TCB-DS package itself stays outside the repository. This answers Q1 for release 1.

**What the theme looks like:**

- **Page and cards.** A 4px red bar across the top of the page. Ink `#212121` text on the page grey `#F5F6F8`. White cards with 1px `#DEDEDE` rules and a soft shadow, 8px radius.
- **Red elements.** Primary buttons, links, focus outlines (2px), the selected tab's underline and caption labels (with a short red rule) are red. The button hover is `#C8141C`.
- **Type.** Headings and headline figures are light (300). Labels, table heads and chips are small caps; figures in tables and ranges are monospace.
- **Summary cards.** A 4px coloured top edge: gold for rough, navy for detailed, grey for the gap, gold-brown for calibration.
- **Fields and chips.** Fields and table heads sit on a grey fill (`#F1F1F1`). Chips are pills, and "Uncalibrated" has a dashed edge.
- **Callouts.** A navy left edge on the soft detailed background.
- **Dark theme.** The prototype's dark palette.

**Accessibility (WCAG 2.2 AA), all in `packages/tokens/src/tokens.ts` and its tests:**

- **Approved exception.** White text on `#ED1C24` is 4.0:1, and red link or caption text on white is about 4.0:1. AA asks for 4.5:1 for normal-size text. The product owner accepted this for the brand red, as the prototype uses it. `contrastExceptions` lists these pairs, and the test still requires 3:1 for them.
- **Darker than the prototype.** Status text uses darker shades so it reads at 4.5:1: bad `#C8141C`, good `#18733C`, warn `#7A5F1E`. Field outlines are `#8C8C8C` instead of `#C4C4C4`, to reach the 3:1 that interface parts need. A test checks field outlines, the focus ring and the series colours at 3:1.

**Fonts.** The font stack is the prototype's: `-apple-system`, SF Pro Text/Display (local only), Helvetica Neue, Arial. No web font files are shipped (SF Pro licence). Monospace uses JetBrains Mono or SF Mono only when the device already has them.
