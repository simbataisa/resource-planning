# SIT Sizing

Full-stack version of the SIT Sizing Model prototype (`../SIT_Sizing_Model.html`).

The solution design is `../SIT_Sizing_Model_Solution_Design.md`. AI agents must read [AGENTS.md](AGENTS.md) first.

**Status: releases 1, 2 and 3 are complete** (design 14). Each release ends with a Playwright suite for its exit criteria (`pnpm test:e2e`). Decisions made along the way are in [docs/adr](docs/adr) (ADR-0001 to ADR-0014).

**New here?** Open the illustrated guide [docs/guide/run-and-deploy.html](docs/guide/run-and-deploy.html) in a browser. It walks through every step below with diagrams.

## Prerequisites

| Tool              | Version                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| Node.js           | 24 (`nvm use` reads `.nvmrc`)                                                 |
| pnpm              | 10.34.9, provided by `corepack enable`                                        |
| Container runtime | Docker Desktop, or Rancher Desktop with the dockerd (moby) engine; Compose v2 |

Behind a corporate proxy with TLS inspection, see `docker/certs/README.txt` (on macOS, `pnpm dev:env` exports the root certificates for you).

## Run locally

```bash
corepack enable
pnpm install       # also generates the Prisma client
pnpm dev:up        # creates .env, then starts db, migrations, seed, Keycloak, web (hot reload), worker, mail
```

| What               | Where                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| App                | http://localhost:3000. Sign in as `dev-estimator`, password `KC_DEV_USER_PASSWORD` in `.env`      |
| Health / readiness | http://localhost:3000/api/v1/health and `/api/v1/ready`                                           |
| API reference      | http://localhost:3000/api/v1/docs                                                                 |
| Keycloak           | http://localhost:18080 (admin console `/admin`, user `admin`, password `KEYCLOAK_ADMIN_PASSWORD`) |
| Local inbox        | http://localhost:8025 (Mailpit)                                                                   |

Other synthetic users: `dev-lead` (QE Lead), `dev-viewer`, `dev-outsider`, and `dev-admin` (sets up TOTP on first sign-in).

| Command                             | What it does                                                            |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev:logs`                     | Follow the web container logs                                           |
| `pnpm dev:down`                     | Stop the stack, keep the data                                           |
| `pnpm dev:reset`                    | Stop and **delete** local volumes (database, caches)                    |
| `pnpm stack:up` / `pnpm stack:down` | The production-like image instead of hot reload                         |
| `pnpm dev:obs`                      | Adds Jaeger tracing at http://localhost:16686                           |
| `pnpm dev`                          | Next.js on the host; needs the `db` container and `apps/web/.env.local` |

## Test

```bash
pnpm check           # type check, lint, format check, unit and golden tests
pnpm test:coverage   # coverage gates per layer
pnpm test:int        # API integration suite (needs Docker)
pnpm test:e2e        # production image in its own stack + Playwright (needs Docker)
```

All four must pass before any merge (see [AGENTS.md](AGENTS.md)); add `pnpm --filter @sit/engine parity` when `packages/engine` changes.

## Deploy

The same image goes to every environment; only environment variables and secrets differ.

1. **Build and verify.** Jenkins (`deploy/Jenkinsfile`) runs the tests, scans and E2E on every branch and publishes `sit-sizing-web:<APP_VERSION>` to Nexus from `main`.
2. **Complete** [docs/release-checklist.md](docs/release-checklist.md) in the release pull request.
3. **Migrate.** Run the `tools` image with `pnpm db:migrate` against the target database. Migrations never run at app start.
4. **Roll out** the web image and the `worker` (tools image, `PROCESS_ROLE=worker`) to `dev` → `sit` → `prod`. Promotion to `prod` needs a human approval.
5. **Check** `/api/v1/ready` reports the database and identity provider as ok.
6. **Roll back** by redeploying the previous image tag. Migrations are expand-only, so no schema rollback is needed.

Server environment variables, hosting assumptions and what is still open are in [runbook section 8](docs/runbook.md#8-release-promotion-and-rollback-design-125).

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
