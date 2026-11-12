# SIT Sizing

Full-stack version of the SIT Sizing Model prototype (`../SIT_Sizing_Model.html`).

The solution design is `../SIT_Sizing_Model_Solution_Design.md`. AI agents must read [AGENTS.md](AGENTS.md) first.

**Status: releases 1, 2 and 3 are complete** (design 14). Each release ends with a Playwright suite for its exit criteria (`pnpm test:e2e`). Decisions made along the way are in [docs/adr](docs/adr) (ADR-0001 to ADR-0014).

## Quick start

```bash
corepack enable
pnpm install       # first run creates pnpm-lock.yaml — commit it
pnpm format        # once: normalise formatting of the generated scaffold
pnpm check         # type check, lint, format check, unit tests
pnpm dev:up        # db, migrations, seed, Keycloak, web (hot reload), worker, mail in containers
```

Then open http://localhost:3000 and http://localhost:3000/api/v1/ready. See [docs/runbook.md](docs/runbook.md) for Rancher Desktop, tracing, troubleshooting and the pipeline.

## Layout

```
apps/web            Next.js app (pages, /api/v1 route handlers, server code, components)
apps/web/worker     Notification worker: sends the email outbox with retries (same image, own process)
packages/engine     Calculation engine — pure TypeScript, golden parity with the prototype
packages/schemas    Zod schemas shared by engine, API and forms
packages/tokens     Design tokens → tokens.css (TCB-DS, ADR-0005)
packages/config     Shared tsconfig presets
packages/db         Prisma schema, migrations, seed, client
docker/             Dockerfile, compose files, Postgres init
deploy/             Jenkinsfile and CI scripts
docs/               ADRs, runbook, threat model, engine findings
```

## Delivery (design 14)

### Release 1 — replace the HTML file for a pilot team

| Step | Scope                                                                                                 | State |
| ---- | ----------------------------------------------------------------------------------------------------- | ----- |
| 1.0  | Foundations (F-01…F-05)                                                                               | Done  |
| 1.1  | Engine port with golden parity (E-01…E-07)                                                            | Done  |
| 1.2  | Prisma, REST API, OpenAPI 3.2 + Scalar, Axios, audit, edit lock                                       | Done  |
| 1.3  | Keycloak realm as code, openid-client sign-in                                                         | Done  |
| 1.4  | TCB-DS tokens, shadcn primitives, Storybook                                                           | Done  |
| 1.5  | Editor and results, autosave, versions, export/import                                                 | Done  |
| 1.6  | Content pages, EN/VI checks, language in profile, VI review kit                                       | Done  |
| 1.7  | Hardening and pilot: CSP nonce, rate limit, back-channel logout, E2E, restore test, release checklist | Done  |

### Release 2 — review and reuse

| Task | Scope                                                           | ADR  | State |
| ---- | --------------------------------------------------------------- | ---- | ----- |
| V-01 | Approval workflow, version compare and restore                  | 0007 | Done  |
| P-01 | Assumption profiles with calibration status; apply to estimates | 0008 | Done  |
| X-02 | Excel workbook and CSV export                                   | 0009 | Done  |
| N-01 | Notification outbox, worker, EN/VI email and in-app notices     | 0010 | Done  |

### Release 3 — calibrate and report

| Task | Scope                                                                        | ADR  | State |
| ---- | ---------------------------------------------------------------------------- | ---- | ----- |
| P-02 | Actuals capture and variance view                                            | 0011 | Done  |
| R-01 | Portfolio view and endpoint                                                  | 0012 | Done  |
| E-08 | Engine version flag, recompute as new draft, upgrade stored payloads on read | 0013 | Done  |
| H-01 | Admin and audit screens                                                      | 0014 | Done  |
