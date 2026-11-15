# ADR-0003: OpenAPI 3.2 contract and Scalar API Reference

|                 |                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **Status**      | Accepted for implementation; the spike checks below must pass on a real install before step 1.2 is closed |
| **Date**        | 2026-11-12                                                                                                |
| **Deciders**    | Tech lead, product owner                                                                                  |
| **Design refs** | Section 9.4; backlog A-05, A-07, A-08                                                                     |

## Context

Design 9.4 asks for an OpenAPI document generated from the Zod schemas, OpenAPI 3.2 if the toolchain supports it (3.1 otherwise), and a self-hosted Scalar API Reference. Most Zod-to-OpenAPI generators emitted 3.1 when the design was written.

## Decision

1. **No third-party generator.** Zod 4 converts schemas to JSON Schema 2020-12 natively (`z.toJSONSchema`), and OpenAPI 3.1 and 3.2 use that dialect for schema objects. A small builder (`apps/web/server/openapi/build.ts`, about 150 lines) assembles paths, parameters, error responses, security schemes and examples from one registry (`server/openapi/operations.ts`). Schemas with `.meta({ id })` become `components.schemas`.
2. **Version: `openapi: 3.2.0`** (`OPENAPI_VERSION`). We use no 3.2-only features, so falling back to `3.1.1` is a one-line change.
3. **Scalar** via `@scalar/nextjs-api-reference` at `GET /api/v1/docs`, behind sign-in. The browser bundle from `@scalar/api-reference` is copied into `public/vendor/scalar/` before `next dev` and `next build`, and the page loads it from there (`cdn` option). Default fonts off; no proxy, so "try it" calls the same origin with the user's own session.
4. **Linting** with Redocly CLI (`redocly.yaml`); **breaking-change diff** with oasdiff (`deploy/ci/openapi-diff.sh`) against `main`.
5. **Contract test** (`server/openapi/build.test.ts`): the registry must list exactly the route handlers under `app/api/v1`, every `$ref` must resolve, and every signed-in operation documents 401 and its security.

## Spike checks (A-07) — to run once dependencies are installed

| #   | Check                                                                                                                             | If it fails                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | `pnpm openapi:generate` writes `docs/api/openapi.json`; `pnpm test` passes the contract test                                      | Fix the builder; it is ours                                           |
| 2   | `pnpm --filter @sit/web openapi:lint` accepts `openapi: 3.2.0`                                                                    | Set `OPENAPI_VERSION = '3.1.1'`, regenerate, record here              |
| 3   | `/api/v1/docs` renders every operation with examples; the browser network tab shows **no** request to any host other than the app | Adjust the Scalar config (`cdn`, fonts) or pin another Scalar version |
| 4   | "Try it" on `GET /me` works with the dev user (`x-dev-user`) locally and, from step 1.3, with the session cookie                  | Keep "try it" disabled until 1.3                                      |
| 5   | `deploy/ci/openapi-diff.sh` (oasdiff v1.35.0) reads a 3.2.0 document                                                              | Use 3.1.1 for the diff input only, or another diff tool               |
| 6   | CSP: the docs page works with the app CSP (`script-src 'self' 'unsafe-inline'`)                                                   | Add a route-specific CSP for `/api/v1/docs` only                      |

Record the outcome of each check in this ADR (date and result) when closing A-07.

### Results

| #   | Date       | Result                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 2026-11-12 | Passed: `docs/api/openapi.json` generated; contract test green                                                                                                                                                                                                                                                                                                                                         |
| 2   | 2026-11-12 | Passed: Redocly CLI 2 lints `openapi: 3.2.0` without a version error. Two findings fixed: an invalid rule name in `redocly.yaml`, and `operation-4xx-response` on `/health` and `/ready`, which have no 4xx by design (reviewed exception in `.redocly.lint-ignore.yaml`)                                                                                                                              |
| 3   | 2026-11-12 | Passed after a fix: every operation renders with examples; only `localhost:3000` resources load (checked in Chrome). The default Scalar build showed links to hosted services (Share, Generate SDK, Deploy, Ask AI Agent, Open API Client) and has telemetry on by default; the route now sets `telemetry: false`, `showDeveloperTools: 'never'`, `hideClientButton: true`, `agent` and `mcp` disabled |
| 4   | 2026-11-12 | Passed: "Test Request" on `GET /me` returned 200 from `localhost:3000` with the dev user                                                                                                                                                                                                                                                                                                               |
| 5   | 2026-11-12 | Pending: runs in CI once `docs/api/openapi.json` is on `main`                                                                                                                                                                                                                                                                                                                                          |
| 6   | 2026-11-12 | Passed: no CSP violations with the app CSP; `connect-src 'self'` would also block any call to Scalar hosts                                                                                                                                                                                                                                                                                             |

## Consequences

- One source of truth: changing a Zod schema changes validation, the Axios client's parsing and the documentation together.
- We own about 150 lines of builder code instead of depending on a generator's 3.2 support.
- The committed `docs/api/openapi.json` must be regenerated in the same PR as any API change; CI fails otherwise.
- Error codes in the `ApiError` envelope are published as an extensible set (`x-extensible-enum`), not a closed `enum`, so adding a code is not a breaking change for the oasdiff gate; see [ADR-0018](0018-extensible-error-codes.md).
