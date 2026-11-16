# Profile detail page: two-column layout (design)

Date: 2026-11-16. Status: approved by the requester. Small change.

## Intent

The profile detail page (`components/features/profiles/profile-editor.tsx`) is hard to use. Its elements are unevenly distributed. A full-width notice comes first, then a tall one-per-line list of feature sizes, and only then the assumption values. The requester picked layout A from three mockups: a two-column page.

## Goals

- Key facts sit in a narrow left panel that stays in view: status, calibration progress, sizes, and actions.
- The assumption values get the wide right column.

## Non-goals

- No behaviour change: saving, publishing, retiring, cloning, calibration notes and the size editing rules stay the same.
- No change to the Assumptions tab inside the estimate editor, to routes, or to the API.

## Anti-goals

- The size editor must not be squeezed into the narrow column.
- The page must not lose keyboard access or screen-reader labels.

## Approaches considered

- **A. Two columns, summary panel plus values.** Chosen by the requester.
- **B. A summary strip and tabs.** Rejected: only one topic is visible at a time.
- **C. Single column, tightened.** Rejected: it keeps the long vertical flow.

## Decided layout

- **Header:** the title and the project line. Clone and Retire move to the top right. Save and Publish move into the status card.
- **Left panel:** about a third of the width, sticky while the values scroll. From `lg` up it sits beside the values; on narrower screens it stacks above them. It holds three cards:
  1. **Status:**
     - The Published, Draft or Retired badge, with the published date or "read-only" wording. This replaces today's full-width notice.
     - In a draft, the Name field, _Save changes_, _Publish_ and "Unsaved changes" when the page is dirty.
  2. **Calibration:** "N of T rows calibrated", where T is the profile's row total (130 + 3 per size), with a thin progress bar. It has an accessible text equivalent.
  3. **Feature sizes:**
     - The sizes as chips, in order, with the hint "Rough scope offers them in this order."
     - In a draft, an **Edit sizes** button opens a right-hand side panel (`ui/sheet`) holding today's `SizeEditor`, unchanged in behaviour.
- **Right column:**
  - The "Assumption values" heading with the uncalibrated badge on the same line.
  - The hint below.
  - The collapsible groups, as today.

## Builder's calls

- Exact spacing and breakpoints, within the TCB-DS tokens.
- New message keys for the card titles and the calibration line, in EN and VI.
- How the profile editor's own Assumptions-tab header drops its duplicate hint and badge (the right column already shows them).

## Verification

- Update the component tests and the E2E spec (they open "Edit sizes" first).
- Axe stays clean.
- The full suite passes before the PR.
