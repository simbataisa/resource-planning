# ADR-0013: Engine version flag, recompute as new draft, upgrade on read

|                 |                                                                  |
| --------------- | ---------------------------------------------------------------- |
| **Status**      | Proposed for release 3 (engine package: named reviewer, rule 13) |
| **Date**        | 2026-11-13                                                       |
| **Deciders**    | Tech lead, product owner                                         |
| **Design refs** | Section 6.6 (engine change policy); backlog E-08                 |

## Context

Design 6.6 sets the rules for a changing engine and schema:

- Stored results never change silently.
- An old engine is flagged, not recomputed behind the user's back.
- Recompute is a user action that creates a new draft.
- Approved versions stay immutable.
- Old payloads are upgraded on read, never rewritten in place.

Before E-08, versions already stored `engineVersion` and `schemaVersion`, but six server paths cast the stored JSON straight to the current types, and nothing told the user about an older engine.

## Decision

1. **One read path.**
   - `upgradeStored()` in `@sit/schemas` runs the upgrade steps from the stored `schemaVersion` to `INPUTS_SCHEMA_VERSION`, then validates with Zod.
   - `server/stored.ts` wraps it, and every service and the version DTO read inputs and assumptions through it.
   - Rows are never rewritten. The next save stores the current shape.
2. **Upgrade steps.** `UPGRADES` is keyed by the version a step upgrades from. It's empty today, because version 1 is the first stored shape. A new step must come with a fixture of the old shape in `packages/engine/golden/stored/` and a test showing it upgrades and recomputes.
3. **Release 1 fixture.** `v1-example.json` is the worked example as Postgres returns it, keys reordered by jsonb included. It must read and recompute to exactly the engine's own example result. Fixtures are never edited.
4. **Newer data after a rollback.** A version saved by a newer release returns 409 `NEWER_SCHEMA` rather than a guess. A corrupt payload is logged and returns 500.
5. **Flag.**
   - A saved version whose `engineVersion` differs from the app's `ENGINE_VERSION` shows "Computed with engine x.y" in the editor.
   - The version history shows a small "engine x.y" badge.
   - Drafts are recomputed on every autosave, so they are never flagged.
6. **Recompute as new draft.** This is the existing "start a draft from version n", which recomputes with the current engine. The notice then opens the comparison of the old and new versions, so the user sees what the engine change did. The old version is unchanged.

## Consequences

- A formula change still needs an `ENGINE_VERSION` bump and an ADR (AGENTS.md rule 3). Existing versions then show the flag without any migration.
- A schema change now has a clear checklist: bump `INPUTS_SCHEMA_VERSION`, add the step, add the old-shape fixture and its test.
