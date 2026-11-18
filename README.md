# SIT Sizing

Estimates SIT and QE effort (test cases, hours and FTE) with a versioned, auditable calculation engine. It replaces the single-file prototype (`SIT_Sizing_Model.html`) with a multi-user web app, and lets a QE's AI coding agent work with it through an MCP server.

**Status (2026-11-18):** releases 1, 2 and 3 and the post-release-3 work are merged to `main`. Engine 1.3.0, stored-payload schema 4, 160 assumption rows, 21 ADRs. What is still open is human sign-off (named reviewers, QE lead and Vietnamese reviews), listed in design section 14.4.

| Path                                                                         | What it is                                                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`sit-sizing-app/`](sit-sizing-app/)                                         | The app: a pnpm monorepo (Next.js 16, PostgreSQL with Prisma, Keycloak, MCP server). All code lives here         |
| [`SIT_Sizing_Model_Solution_Design.md`](SIT_Sizing_Model_Solution_Design.md) | The solution design (revision 5) and source of truth                                                              |
| `SIT_Sizing_Model.html`                                                      | The original prototype                                                                                            |
| [`sit-sizing-reference/`](sit-sizing-reference/)                             | Engine and UI code extracted from the prototype, the golden example and the VI dictionary, used by parity checks |
| `tcb-ds/`                                                                    | Techcombank design-system source (not in Git); its tokens are ported into `packages/tokens`                       |

## What it does

- **Estimates** per project, edited live in the browser (rough and detailed modes, shift-left evidence, assumptions), with autosave and an edit lock.
- **Versions** that are immutable once saved, with submit, approve or return (segregation of duties), compare and restore.
- **Assumption profiles** with calibration status per value, custom feature sizes, and apply-to-estimate.
- **Actuals and variance** after each SIT cycle, a **portfolio** roll-up for QBRs, Excel and CSV **export**, and email and in-app **notifications**.
- **Admin and audit** screens, **guided tours**, EN and VI throughout.
- **AI assistant (MCP)**: Claude Code or Codex can read estimates, preview results and, after an explicit yes, save or submit a version as the signed-in user.

## Run it in five commands

You need Node.js 24, Docker Desktop (or Rancher Desktop with the dockerd engine) and Git.

```bash
cd sit-sizing-app
corepack enable
pnpm install
pnpm dev:up
open http://localhost:3000
```

`pnpm dev:up` creates `.env` with random local passwords, then starts the database, Keycloak, the web app, the email worker, the MCP server and a local mail catcher, and loads synthetic data. Sign in as `dev-estimator`; the password is `KC_DEV_USER_PASSWORD` in `sit-sizing-app/.env`.

## Guides

- **[Solution design, feature by feature](sit-sizing-app/docs/guide/solution-design.html)**: the detailed design of each feature with the ADRs behind it, an architecture diagram, the data model and a searchable ADR index. Open it in a browser.
- **[How every feature works](sit-sizing-app/docs/guide/features.html)**: an illustrated, animated HTML guide to each feature, including the AI assistant (MCP).
- **[Run and deploy, step by step](sit-sizing-app/docs/guide/run-and-deploy.html)**: an illustrated HTML guide.
- **[AI assistant quickstart for QEs](sit-sizing-app/docs/guide/assistant-quickstart.md)**: install Claude Code or Codex, connect it to SIT Sizing, make a first estimate and test it with the sample BRD and FSD.
- [App README](sit-sizing-app/README.md): commands, layout and delivery status.
- [ADRs](sit-sizing-app/docs/adr/): every architecture decision, 0001 to 0021.
- [Runbook](sit-sizing-app/docs/runbook.md): full detail for local setup, troubleshooting, the pipeline, release, backup and operations.
- [Release checklist](sit-sizing-app/docs/release-checklist.md): what must be true before a release.
- [AGENTS.md](sit-sizing-app/AGENTS.md): rules for AI coding agents, including the full test suite before any merge.
