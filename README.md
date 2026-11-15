# SIT Sizing

Estimates SIT and QE effort with a versioned, auditable calculation engine. It replaces the single-file prototype (`SIT_Sizing_Model.html`) with a full-stack app.

| Path                                                                         | What it is                                                                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`sit-sizing-app/`](sit-sizing-app/)                                         | The app: a pnpm monorepo (Next.js 16, PostgreSQL with Prisma, Keycloak). All code lives here |
| [`SIT_Sizing_Model_Solution_Design.md`](SIT_Sizing_Model_Solution_Design.md) | The solution design and source of truth                                                      |
| `SIT_Sizing_Model.html`                                                      | The original prototype                                                                       |
| [`sit-sizing-reference/`](sit-sizing-reference/)                             | Engine and UI code extracted from the prototype, used by the parity checks                   |

## Run it in five commands

You need Node.js 24, Docker Desktop (or Rancher Desktop with the dockerd engine) and Git.

```bash
cd sit-sizing-app
corepack enable
pnpm install
pnpm dev:up
open http://localhost:3000
```

`pnpm dev:up` creates `.env` with random local passwords, then starts the database, Keycloak, the web app, the email worker and a local mail catcher, and loads synthetic data. Sign in as `dev-estimator`; the password is `KC_DEV_USER_PASSWORD` in `sit-sizing-app/.env`.

## Guides

- **[Run and deploy, step by step](sit-sizing-app/docs/guide/run-and-deploy.html)**: an illustrated HTML guide. Open it in a browser.
- **[How every feature works](sit-sizing-app/docs/guide/features.html)**: an illustrated, animated HTML guide to each feature, including the proposed AI assistant (MCP).
- [App README](sit-sizing-app/README.md): commands, layout and delivery status.
- [Runbook](sit-sizing-app/docs/runbook.md): full detail for local setup, troubleshooting, the pipeline, release, backup and operations.
- [Release checklist](sit-sizing-app/docs/release-checklist.md): what must be true before a release.
- [AGENTS.md](sit-sizing-app/AGENTS.md): rules for AI coding agents, including the full test suite before any merge.
