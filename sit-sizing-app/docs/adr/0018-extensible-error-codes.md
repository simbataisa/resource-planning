# ADR-0018: Error codes are an extensible set

|                           |                                                                      |
| ------------------------- | -------------------------------------------------------------------- |
| **Status**                | Proposed                                                             |
| **Date**                  | 2026-11-15                                                           |
| **Deciders**              | Product owner, tech lead; one code-owner approval for the switch     |
| **Backlog / design refs** | Design 9.1 (error envelope), 9.4 (contract and breaking-change gate) |

## Context

Every non-2xx response uses one envelope, `ApiError`, with a machine-readable `error.code`. Until now the contract published that code as a closed `enum` of eight values (`packages/schemas/src/api-error.ts`).

The CI breaking-change gate (`deploy/ci/openapi-diff.sh`, oasdiff v1.35.0) compares the committed `docs/api/openapi.json` with `origin/main`. oasdiff treats a new value in a response `enum` as breaking, because a client that switches over the closed set may not handle it. `ApiError` is referenced by every error response, so one new code fails the gate on every operation.

A coming change (the MCP server branch) adds a new code, `NOT_PROVISIONED`, and others will follow. oasdiff honours `x-extensible-enum` (new values are not breaking) only when the **base** spec already uses it. So the switch from a closed enum to the extensible form has to land on `main` on its own before any new code is added.

## Options considered

| Option                                                      | Pros                                                                 | Cons                                                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| A. Extensible set on `main` first (this ADR)                | One approval, once; every later code is additive and passes the gate | One small extra PR; clients must not treat the code list as complete                                                   |
| B. One-off breaking approval inside the MCP PR              | No separate PR                                                       | The base still has a closed enum, so every future code needs another approval; mixes contract policy into a feature PR |
| C. Keep a closed enum and approve each new code as breaking | Clients can switch exhaustively                                      | A code-owner approval for every new code; the gate loses meaning as approvals become routine                           |

## Decision

Option A. The contract publishes `error.code` as `type: string` with `x-extensible-enum` listing the known codes and a description that tells clients to fall back to the HTTP status and message for a code they do not know. It is generated from the Zod schema (`ApiErrorCodeWire` with `.meta()`); the document is never hand-edited.

The server keeps a closed type (`ApiErrorCode`, `KnownApiErrorCode`), so `HttpError` and `errorResponse` can only emit known codes, and a new code is still added in one place. Clients parse the envelope with the open schema: the web client (`lib/http.ts`) accepts any string code and still surfaces the status, message and request ID.

## Consequences

- **This switch needs one code-owner approval** (`OPENAPI_BREAKING_APPROVED`), because oasdiff reports a closed enum becoming open on a response property as breaking. After it is on `main`, adding a code to `ApiErrorCode` is additive and passes the gate without approval.
- Removing or renaming a known code is still a breaking change and goes through the normal approval.
- Client code must not assume the code list is complete. Code that branches on `code` keeps a default branch that uses `status` and `message`.
- If the gate ever stops honouring `x-extensible-enum` (for example after an oasdiff upgrade), new codes would fail the gate again; we would then pin oasdiff or revisit this ADR.
