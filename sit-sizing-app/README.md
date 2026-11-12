# SIT Sizing

Full-stack version of the SIT Sizing Model prototype (`../SIT_Sizing_Model.html`).

The solution design is `../SIT_Sizing_Model_Solution_Design.md`. AI agents must read [AGENTS.md](AGENTS.md) first.

**Status: step 1.2 (Data and API).** Foundations (1.0), the engine (1.1), and now the database, the REST API for projects, estimates, drafts and versions with the edit lock, the OpenAPI 3.2 contract and the Scalar API reference. Sign-in is a local stand-in until Keycloak (1.3); no UI yet.

## Quick start

```bash
corepack enable
pnpm install       # first run creates pnpm-lock.yaml — commit it
pnpm format        # once: normalise formatting of the generated scaffold
pnpm check         # type check, lint, format check, unit tests
pnpm dev:up        # db, migrations, seed, web (hot reload), mail in containers
```

Then open http://localhost:3000 and http://localhost:3000/api/v1/ready. See [docs/runbook.md](docs/runbook.md) for Rancher Desktop, tracing, troubleshooting and the pipeline.

## Layout

```
apps/web            Next.js app (pages, /api/v1 route handlers, server code, components)
packages/engine     Calculation engine — pure TypeScript, golden parity with the prototype
packages/schemas    Zod schemas shared by engine, API and forms
packages/tokens     TCB-DS design tokens (step 1.4)
packages/config     Shared tsconfig presets
packages/db         Prisma schema, migrations, seed, client
docker/             Dockerfile, compose files, Postgres init
deploy/             Jenkinsfile and CI scripts
docs/               ADRs, runbook, threat model, engine findings
```

## Delivery steps (design 14, Release 1)

| Step | Scope                                                           | State           |
| ---- | --------------------------------------------------------------- | --------------- |
| 1.0  | Foundations (F-01…F-05)                                         | Done            |
| 1.1  | Engine port with golden parity (E-01…E-07)                      | Done            |
| 1.2  | Prisma, REST API, OpenAPI 3.2 + Scalar, Axios, audit, edit lock | **This change** |
| 1.3  | Keycloak realm as code, Auth.js, sign-in                        | Next (needs Q2) |
| 1.4  | TCB-DS tokens, shadcn primitives, Storybook                     | Needs Q1        |
| 1.5  | Editor and results                                              |                 |
| 1.6  | Content and i18n                                                |                 |
| 1.7  | Hardening and pilot                                             |                 |
