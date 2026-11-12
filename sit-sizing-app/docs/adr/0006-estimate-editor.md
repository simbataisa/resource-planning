# ADR-0006: Estimate editor, locale routing and prototype parity

|                 |                                                                      |
| --------------- | -------------------------------------------------------------------- |
| **Status**      | Accepted for release 1                                               |
| **Date**        | 2026-11-12                                                           |
| **Deciders**    | Tech lead, product owner                                             |
| **Design refs** | Sections 7, 8.3, 8.5, 9.3, 14 (step 1.5); backlog U-04 to U-09, X-01 |

## Context

Step 1.5 replaces the HTML prototype for a pilot team. Its exit criterion is that a user reproduces the prototype's worked example with identical numbers. The prototype is also the specification for the screens: five input tabs, nine detailed sections, the results panels, export and import. Users switch between EN and VI.

## Decision

1. **Locale in the URL with next-intl.** Every page lives under `/{locale}` (`en`, `vi`). `proxy.ts` adds the prefix when it is missing, choosing the `sit-locale` cookie, then the browser language, then English. The language switch sets the cookie. The Keycloak post-logout URI stays `/signed-out`, which the proxy forwards to `/{locale}/signed-out`. In-app links use `Link` from `@/i18n/navigation`; ESLint blocks `next/link`. The locale is not yet saved to the user profile (design 8.5); that needs a `PATCH /me` endpoint, planned with step 1.6.
2. **Messages come from the prototype.** EN strings are the prototype's own wording. VI strings are looked up in `sit-sizing-reference/vi-translations.json` first, using the JS dictionary that the prototype's live text uses. Only new strings (autosave, lock, versions) were translated for this app. All VI text still needs the native-speaker review planned in step 1.6.
3. **Numbers are formatted as the prototype formats them.** `lib/format.ts` reproduces `fmt`, `f1`, `num1` and `pctS`: `Math.round` then `toFixed`, with `en-US` grouping in both languages (Q6). `Intl` rounding is not used for figures, because it can differ from `Math.round` on ties.
4. **One client store per open draft.** It is a React context with a reducer (design 8.3), holding `{ inputs, assumptions, dirty, rowVersion, revision }`. `computeBoth` runs in the browser on every change, memoised by state. Inputs are controlled, and use the prototype's own normalisers: for example, languages are stored as `max(1, round(v))` and out-of-range values are clamped, not rejected. React Hook Form is not used in the editor. Its validation-on-submit model does not fit an always-valid, live-recomputed form. Small forms such as "New estimate" validate with the shared Zod schemas.
5. **Edit lock lifecycle (U-09).**
   - Opening a draft takes or renews the lock. The editor then reloads the server copy, so a takeover never edits stale data.
   - A heartbeat runs every 5 minutes against the 15-minute lock.
   - Autosave runs 1.5 s after the last change and sends `rowVersion`. Edits made while a save is in flight stay dirty, tracked by `revision`.
   - Any 409 switches the page to recovery. The user's unsaved values stay on screen and can be downloaded, then the latest draft can be reloaded.
   - The lock is not released when the page unmounts. In development, React's double mount would race a release against the next acquire. The lock expires on its own, and the same user re-acquires it at once.
6. **Save version** flushes pending edits first, then freezes the draft. "Edit in a new draft" starts the next version.
7. **Export and import use the prototype's file format.**
   - Export writes `{ tool: 'sit-sizing-model', version: 1, profile, savedAt, calibrated, assumptions, scope }`, so files move both ways between the HTML tool and the app.
   - Import goes through the engine's `fromPrototypeProfile` and is validated with Zod before it replaces the draft.
   - The QBR summary is the prototype's text, line for line.
   - Release 1 has no profile entity in the editor, so the exported `profile` is the estimate name. Assumption profiles arrive in release 2 (P-01).
8. **Parity is tested against the prototype itself.** `tests/unit/prototype-ui-parity.test.tsx` runs `SIT_Sizing_Model.html` in jsdom with the same scope, assumptions and language as the app.
   - It checks that every figure and sentence the prototype renders also appears in the app: summary cards, section summaries, notes, derived formulas, gap table, tornado, scenarios, worked example, evidence effects and the calendar check.
   - It also checks the tornado order, the exact QBR summary and the export round-trip.
   - It runs for the worked example and a changed scenario in EN and VI, and for a blank scope in EN.

## Consequences

- The engine golden tests prove the numbers. The parity test proves what the user sees, so a UI change that alters a figure, a rounding or a sentence fails CI.
- Prototype behaviours that are only UI are logged as UI notes in `docs/engine-findings.md`. One example: the prototype stops with an error on a blank scope.
- Changing wording for the VI review changes `messages/vi.json`. The parity test then needs the same change applied to the reference, or an agreed exception list.
- Stale locks clear after 15 minutes, or a QE Lead takes over. Releasing on tab close (`pagehide`) can be added in step 1.7 if the pilot finds the wait annoying.
