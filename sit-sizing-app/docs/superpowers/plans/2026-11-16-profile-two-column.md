# Profile Two-Column Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the profile detail page as two columns:

- a narrow sticky panel with status, calibration and sizes;
- the assumption values in the wide column;
- the size editor in a side panel.

**Architecture:** This is a layout-only change in `apps/web/components/features/profiles/` plus one optional prop on `AssumptionsTab`. Behaviour, hooks, API and engine are untouched.

**Tech Stack:** Next.js 16, React, Tailwind with TCB-DS tokens, next-intl, Radix sheet (`components/ui/sheet`), Vitest + Testing Library + axe, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-profile-two-column-design.md`

## Global Constraints

- No behaviour change. These keep working exactly as today:
  - save, publish, retire, clone;
  - calibration notes;
  - the size-editing rules and focus handling.
- The estimate editor's Assumptions tab looks and behaves as today. The new prop is optional.
- Every new string goes into `messages/en.json` and `vi.json`; `pnpm i18n:review` regenerates the review file.
- Accessibility:
  - the sheet has a title and a close label;
  - the progress bar has a text equivalent;
  - axe stays clean.
- The panel sits beside the values from `lg` up and stacks above them below `lg`. It is sticky only from `lg` up.
- Full suite (`pnpm check`, `pnpm test:coverage`, `pnpm test:int`, `pnpm test:e2e`) before the PR. The named reviewer is Dennis.

## Review Focus

1. **A published or retired profile shows no "Edit sizes" button and no name field.** Tested in Task 2.
2. **"Unsaved changes" appears after a size edit made in the sheet,** and Save stays enabled after the sheet closes. Tested in Task 2.
3. **The estimate editor's Assumptions tab still shows its hint and badge** when no `title` is given. Tested in Task 1 by the existing editor tests.
4. **The sheet keeps the size editor's focus and confirmation behaviour.** The remove dialog opens over the sheet and closing it returns to the sheet. Tested in Task 2.
5. **The calibration line uses the profile's own total** (e.g. 163 with one added size), not 160. Tested in Task 2.

---

### Task 1: `AssumptionsTab` takes an optional title

**Files:**

- Modify: `apps/web/components/features/estimate-editor/assumptions-tab.tsx`
- Test: `apps/web/components/features/estimate-editor/custom-sizes.test.tsx`

**Interfaces:**

- Produces: `AssumptionsTab({ title?: ReactNode, ... })`. With a title, the first row is title + uncalibrated badge, and the hint follows below. Without one, the layout is exactly as today.

- [ ] **Step 1: Failing test.** `shows a title beside the uncalibrated badge`: render `<AssumptionsTab title={<h2>Assumption values</h2>} />`. Expect the heading "Assumption values", and expect that heading and the badge "160 uncalibrated" to share a parent element.
- [ ] **Step 2:** Run `pnpm vitest run --project web apps/web/components/features/estimate-editor/custom-sizes.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement the prop.
- [ ] **Step 4:** Run the same file plus `editor.test.tsx`. Expected: PASS.
- [ ] **Step 5:** Commit `Assumptions tab: optional title beside the uncalibrated badge`.

### Task 2: The two-column profile page

**Files:**

- Create: `apps/web/components/features/profiles/profile-panel.tsx`, with these components:
  - `StatusCard`
  - `CalibrationCard`
  - `SizesCard` (chips, plus an "Edit sizes" sheet wrapping `SizeEditor`)
- Modify:
  - `profile-editor.tsx` (grid layout, moves Save and Publish, removes the full-width notice)
  - `messages/en.json`, `vi.json`
  - `docs/i18n/vi-review.csv` (regenerated)
- Test:
  - `apps/web/components/features/profiles/profiles.test.tsx`
  - `apps/web/tests/e2e/custom-sizes.spec.ts`

**Interfaces:**

- Consumes: Task 1 `title` prop; `SizeEditor` props unchanged; `assumptionPaths`, `uncalibratedCount` from `@sit/engine`.
- Produces:
  - Message keys `profiles.panel.{status,calibration,calibrated,sizes,sizesHint,editSizes}`.
  - `calibrated`: "{n} of {t} rows calibrated".

- [ ] **Step 1: Failing tests** in `profiles.test.tsx`:
  - `shows status, calibration and sizes in the side panel`. A published profile shows the region "Feature sizes" with 10 chips (`listitem`s), the text "1 of 160 rows calibrated" (profile `uncalibrated: 159`), and no "Edit sizes" or Name field.
  - `edits sizes in a side panel`. On a draft, clicking "Edit sizes" opens a dialog named "Feature sizes". Adding XS2 there, closing it, and then saving sends `values.sizes` with XS2. "Unsaved changes" is shown, and the calibration line reads "… of 163 rows calibrated".
  - Update the existing size-editor tests so they open "Edit sizes" first and query inside the dialog.
- [ ] **Step 2:** Run `pnpm vitest run --project web apps/web/components/features/profiles/profiles.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The page grid is `lg:grid-cols-[minmax(16rem,1fr)_2fr]` and the panel is `lg:sticky lg:top-4 self-start`.
  - The calibration count is computed from local state: `uncalibratedCount(assumptions, DEFAULTS, calibration)` and `assumptionPaths(assumptions).length`. It shows unsaved edits.
  - Write the EN and VI texts, then run `pnpm i18n:review`.
- [ ] **Step 4:** Run the component tests plus `prototype-ui-parity`. Expected: PASS, with axe clean.
- [ ] **Step 5:** Update `custom-sizes.spec.ts`: `publishProfile` clicks "Edit sizes" and works inside the sheet, then closes it. Check that `release2`/`release3` profile specs still use selectors that exist.
- [ ] **Step 6:** Run the full suite. Commit `Profiles: two-column detail page with a side panel for sizes`.
