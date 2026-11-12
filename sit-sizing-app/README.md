# SIT Sizing

Full-stack version of the SIT Sizing Model prototype (`../SIT_Sizing_Model.html`).

The solution design is `../SIT_Sizing_Model_Solution_Design.md`. AI agents must read [AGENTS.md](AGENTS.md) first.

**Status: step 1.6 (Content and i18n).** Foundations, engine, database and API, Keycloak sign-in, design system, the estimate editor with live results, autosave, versions and export/import (ADR-0006), and now the Guide, Method and Standards pages in EN and VI, the language saved to the user profile (`PATCH /api/v1/me`), stricter message checks and the Vietnamese review round trip (`docs/i18n/README.md`). **Waiting on:** the Vietnamese reviewer's sign-off. Hardening and the pilot come next (step 1.7).

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
packages/tokens     Design tokens → tokens.css (interim prototype palette until TCB-DS, Q1)
packages/config     Shared tsconfig presets
packages/db         Prisma schema, migrations, seed, client
docker/             Dockerfile, compose files, Postgres init
deploy/             Jenkinsfile and CI scripts
docs/               ADRs, runbook, threat model, engine findings
```

## Delivery steps (design 14, Release 1)

| Step | Scope                                                           | State                                     |
| ---- | --------------------------------------------------------------- | ----------------------------------------- |
| 1.0  | Foundations (F-01…F-05)                                         | Done                                      |
| 1.1  | Engine port with golden parity (E-01…E-07)                      | Done                                      |
| 1.2  | Prisma, REST API, OpenAPI 3.2 + Scalar, Axios, audit, edit lock | Done                                      |
| 1.3  | Keycloak realm as code, openid-client sign-in                   | Done (Q2 open)                            |
| 1.4  | Tokens (interim, Q1), shadcn primitives, Storybook              | Done                                      |
| 1.5  | Editor and results, autosave, versions, export/import           | Done                                      |
| 1.6  | Content pages, EN/VI checks, language in profile, VI review kit | **This change** (review sign-off pending) |
| 1.7  | Hardening and pilot                                             |                                           |
