# Draft lock token — design

|            |                                                               |
| ---------- | ------------------------------------------------------------- |
| **Status** | Draft for product-owner approval                              |
| **Date**   | 2026-11-15                                                    |
| **Refs**   | Solution design 5.2.1 and 8.3 (edit lock), ADR-0016, ADR-0018 |
| **Needs**  | Named reviewer for the migration (sensitive path)             |

## 1. Intent

A draft's edit lock belongs to a user. When the same person has the editor open and also uses the AI assistant (MCP), or has the editor open in two tabs, each one renews the other's lock and either can release it. The MCP write tools refuse a lock they can see, but a short window remains in which the assistant takes and then releases the editor's lock. This closes that window.

## 2. Decision (product owner)

**Lock token.** Every time someone takes a free or expired lock, the API returns a random token. Renewing, autosave, applying a profile, saving a version and releasing the lock must present the same token. A second tab or the assistant is told the draft is open elsewhere instead of silently sharing the lock. The channel-tag alternative was rejected: two tabs of the same user could still race.

## 3. Goals, non-goals

- Goal: only the tab or assistant session that took the lock can use or release it.
- Goal: a person can still take over their own lock on purpose (a crashed or forgotten tab).
- Non-goal: changing who may take over someone else's lock (QE Lead rule unchanged), lock length (15 minutes) or the optimistic `rowVersion` check.
- Anti-goal: an editor tab losing work silently. A tab that lost its lock keeps its unsaved values, as today.

## 4. Design

**Data.** `EstimateVersion.lockTokenHash String?` (additive migration). The API stores the SHA-256 of the token, never the token. The column is cleared whenever the lock is cleared.

**Taking the lock** (`POST …/draft/lock`, and the implicit lock in `POST /projects/{id}/estimates` and `POST …/draft`):

| Lock state                    | Request           | Result                                                                |
| ----------------------------- | ----------------- | --------------------------------------------------------------------- |
| Free or expired               | any               | New token, returned once in the response                              |
| Held by me, token matches     | heartbeat         | Renewed, same token                                                   |
| Held by me, no or other token | `takeover: false` | 409 `LOCKED_ELSEWHERE` ("open in another tab or in the assistant")    |
| Held by me, no or other token | `takeover: true`  | New token (the other tab or assistant loses it); allowed for any role |
| Held by someone else          | as today          | As today (`HELD_BY_OTHER`, QE Lead takeover gets a new token)         |

**Using the lock.** `PATCH …/draft`, `POST …/draft/profile`, `POST …/versions` and `DELETE …/draft/lock` require the header `X-Lock-Token`. A missing or wrong token on a lock I hold → 409 `LOCKED_ELSEWHERE`; nothing is written and the lock is not released.

**Contract.** Lock responses gain `lockToken` (string, only to the caller who just took the lock). The header is documented on the four operations. `LOCKED_ELSEWHERE` is a new error code (an additive change since ADR-0018). `pnpm openapi:generate`; the breaking-change check must pass.

**Web editor.** The token lives in the editor store for that tab only (memory, not storage). Autosave, heartbeat, apply profile, save and close send it. On `LOCKED_ELSEWHERE` the editor switches to the existing read-only/recovery view with "Open here instead" (takeover of my own lock). EN and VI text.

**MCP.** `withDraftLock` keeps the token from its own lock call and sends it on the write and on release. A release with its token can no longer free the editor's lock. `create_estimate` and `start_draft` release with the token their own POST returned. The existing refusals (`EDITOR_OPEN`, `LOCKED`, `NO_DRAFT`) stay; `LOCKED_ELSEWHERE` from the API maps to `EDITOR_OPEN`.

**Audit.** Unchanged. A takeover of my own lock is audited like a takeover (`estimate.draft.lock.takeover`, with `own: true`).

## 5. Tests

- Domain (pure): the decision table above.
- Integration: each row of the table; the four lock-using operations refuse a missing or wrong token and write nothing; a wrong-token release keeps the lock; takeover of my own lock issues a new token and the old one stops working; the hash is stored, not the token.
- Web: the editor sends the token; a `LOCKED_ELSEWHERE` answer shows recovery with "Open here instead"; a second tab cannot autosave over the first.
- MCP: the race from ADR-0016's residual (editor locks between the assistant's check and lock) now ends with the assistant refused and the editor's lock intact.
- E2E: the existing suite passes; one new case opens the same draft in two tabs.

## 6. Left to the builder

Header vs. body field name details within "X-Lock-Token"; the exact recovery-view wording (EN first, VI through the review kit); where the token is generated (`node:crypto` `randomBytes(32)` base64url).

## 7. Rollout

The web app and the MCP server deploy together; an old editor tab open during the deploy gets `LOCKED_ELSEWHERE` on its next save and shows the recovery view with its values kept.
