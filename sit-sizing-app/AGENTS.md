# AGENTS.md — rules for AI coding agents

Read this before every task. It applies to every agent session in this repository.

**Source of truth:** `../SIT_Sizing_Model_Solution_Design.md` (the solution design, revision 4). Reference files from the prototype are in `../sit-sizing-reference/`. Where this file and the design disagree, stop and ask.

The TCB repository root also has a `CLAUDE.md` with GitNexus code-intelligence rules: run impact analysis before you edit a symbol, and change detection before you commit. Follow them when the GitNexus tools are available.

## Repository map

| Path                                         | What lives there                                                                   | Layer rules                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/engine`                            | Calculation engine: pure TypeScript, no I/O, no UI text                            | Imports only `zod` and `@sit/schemas` (ESLint-enforced)                       |
| `packages/schemas`                           | Zod schemas: types, API contract, form validation                                  | No engine, no I/O                                                             |
| `packages/tokens`                            | TCB-DS tokens (step 1.4)                                                           |                                                                               |
| `packages/config`                            | Shared tsconfig presets                                                            |                                                                               |
| `packages/db`                                | Prisma schema, migrations, seed, client                                            | Merged migrations are never edited; only `apps/web/server` imports the client |
| `apps/web/app`                               | Next.js pages and `api/v1` route handlers                                          | A handler validates and authorises, then calls a service                      |
| `apps/web/server`                            | Services, repositories, domain rules, env, logger, route wrapper, OpenAPI registry | Never imported by components                                                  |
| `apps/web/components/{ui,patterns,features}` | Component layers 2 → 3 → 4                                                         | A lower layer never imports a higher one; no Prisma, no Axios                 |
| `apps/web/lib`                               | Client-safe helpers (Axios client, query keys, rbac, i18n)                         |                                                                               |
| `docker/`                                    | Dockerfile, compose files, Postgres init, Keycloak realm (1.3)                     |                                                                               |
| `deploy/`                                    | Jenkinsfile and CI scripts                                                         | Sensitive path: named human reviewer                                          |
| `docs/`                                      | ADRs, runbook, threat model, engine findings                                       |                                                                               |

## Commands

```bash
pnpm install          # once, and after lockfile changes
pnpm check            # type check + lint + format check + unit tests (run before every PR)
pnpm test             # unit tests; pnpm test:coverage for coverage gates
pnpm dev              # Next.js on the host (needs `pnpm dev:env` and the db from `pnpm dev:up`)
pnpm dev:up           # full stack in containers with hot reload
pnpm dev:obs          # plus Jaeger tracing at http://localhost:16686
pnpm test:int         # API integration suite (Testcontainers, needs Docker)
pnpm openapi:generate # after any API change; commit docs/api/openapi.json
pnpm --filter @sit/web storybook   # component catalogue at http://localhost:6006
```

## Ground rules (design 15.1)

1. **Read first.** Before any task, read this design, `AGENTS.md`, the relevant ADRs and the files you will change. If the repository has a `CLAUDE.md` with code-intelligence rules (impact analysis before editing a symbol, change detection before commit), follow them.
2. **One task, one branch, one pull request.** Keep PRs under about 400 changed lines where possible. Do not mix refactoring with behaviour changes.
3. **Never change the numbers by accident.** Any change under `packages/engine` must keep all golden tests green. If a formula or default must change, stop, write an ADR, get human approval, then update the golden files in the same PR.
4. **Tests come with the code.** Write or update tests in the same PR. For the engine, write the failing test first.
5. **Schema first.** Add or change the Zod schema, then types, then code. Do not hand-write a type that a schema can infer.
6. **Respect the layers.** Components do not call Axios or Prisma. Route handlers do not contain business rules. The engine has no I/O and no UI text.
7. **No real data.** Use synthetic names and values in seeds, fixtures, tests, examples and screenshots. Never add personal or customer data, real account numbers or real ID numbers.
8. **No secrets** in code, tests, logs or commit messages. Add new variables to `.env.example` and `env.ts`.
9. **i18n always.** Every user-facing string goes through next-intl with both `en` and `vi` entries. Do not hard-code text in components.
10. **Accessibility is part of done:** labels, keyboard access, focus state, reduced motion.
11. **Do not add dependencies** without stating why in the PR and checking the licence. Prefer what is already in the stack.
12. **Ask instead of guessing** when a requirement is ambiguous or an open question in section 16 blocks the task. Record the question in the PR.
13. **Identity is configuration, not code.** Change sign-in behaviour through the Keycloak realm export. Authentication code lives only in `apps/web/server/auth` and `app/api/auth` (ADR-0004); do not add token or password logic anywhere else. Never log passwords, tokens, secrets or reset links. Never weaken a rule in section 10.4 to make a test pass. Every change to the realm export, `lib/rbac.ts` or auth code needs human security review.
14. **Do not** push to the main branch, change CI gates, edit migrations that have been merged, or run destructive database commands outside your own dev containers.
15. **API changes include the contract.** A new or changed endpoint is not done until its Zod schemas are registered in the OpenAPI registry with synthetic examples and error responses, the committed `openapi.json` is updated, and it renders in `/api/v1/docs`. Do not hand-edit the generated document.

## Definition of done, every PR (design 15.2)

- Type check, lint, unit and component tests pass; integration tests pass when API or schema code changed.
- New code meets the coverage gate for its layer.
- Golden parity tests pass.
- For API changes: OpenAPI document regenerated, linted, and free of unapproved breaking changes.
- EN and VI messages complete.
- Docs updated: ADR for decisions, runbook for operational changes, `docs/engine-findings.md` for engine observations.
- PR description states what changed, how it was verified, and what was not verified.

## How a task is briefed (design 15.4)

Give each session: the task ID and acceptance line from the table, links to this design and the relevant section, the files in `sit-sizing-reference/` it needs, and what is out of scope. Ask the agent to finish with a summary of what it changed, how it verified it, and anything it could not verify.

## Human controls (design 15.5)

- **Sensitive paths:** `packages/engine`, `prisma/migrations`, `lib/rbac.ts`, auth code, `docker/keycloak` and the pipeline need review by a named human. Code-owner enforcement is **optional for now**: until it is turned on, the PR author ticks the sensitive-path box in the PR template and asks a named reviewer. `docs/CODEOWNERS.example` is ready to copy to the repository root when owners are agreed. An agent's approval never counts as that review.
- **No self-merge.** Agents open pull requests; a person merges.
- **Small, traceable changes.** Each PR names its task ID and states what was verified and what was not.
- **Golden files are protected.** Changing a file under `packages/engine/golden/` requires an ADR link in the PR.
- **Stop conditions.** An agent stops and asks when a test can only pass by weakening a gate, when a requirement conflicts with this design, or when a task touches something outside its stated scope.
