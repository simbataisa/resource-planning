# ADR-0001: Technology stack and version policy

|                 |                                          |
| --------------- | ---------------------------------------- |
| **Status**      | Proposed (accept at the step 1.0 review) |
| **Date**        | 2026-11-12                               |
| **Deciders**    | Tech lead, product owner                 |
| **Design refs** | Section 3, 12.1, 12.5                    |

## Context

Design section 3 fixes the stack. It also says to pin versions at kickoff, using the latest stable release that is at least two weeks old. Several tools released new major versions in 2026, and some of the tools that depend on them do not support those versions yet.

## Decision

**How versions are pinned.**

- `package.json` sets ranges on a known major or minor version.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 20160`, so pnpm never installs a version published less than 14 days ago.
- The committed `pnpm-lock.yaml` is the exact pin. `.npmrc` sets `save-exact=true` for anything added later.
- Shared toolchain versions (TypeScript, Vitest, Zod, @types/node) live in the pnpm `catalog:` so every package uses the same one.
- Container images are pinned to a version tag. Before the first server deployment, pin them by digest in Nexus.

| Area                          | Choice                                                                         | Range                                        | Note                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                       | Node.js                                                                        | 24 LTS (`node:24-bookworm-slim`)             | `.nvmrc`, `engines`                                                                                                                                            |
| Package manager               | pnpm                                                                           | `10.34.9` via corepack                       | pnpm 12 is out; upgrade in a separate PR once the CI agent image supports it                                                                                   |
| Framework                     | Next.js                                                                        | `^16.3.0`                                    | App Router, `output: standalone`, `proxy.ts` (Next 16's name for middleware)                                                                                   |
| UI runtime                    | React                                                                          | `^19.2.0`                                    |                                                                                                                                                                |
| Language                      | TypeScript                                                                     | `~6.0.3`                                     | TypeScript 7 (native compiler) is out, but typescript-eslint supports only versions below 6.1 so far. Move to 7 when typescript-eslint and Next.js support it. |
| Lint                          | ESLint 9 + `eslint-config-next`                                                | `^9.39.0`, `^16.3.0`                         | ESLint 10 is out; stay on 9 until every plugin in eslint-config-next supports 10                                                                               |
| Format                        | Prettier                                                                       | `^3.6.0`                                     |                                                                                                                                                                |
| Tests                         | Vitest + coverage-v8                                                           | `^5.0.3`                                     | Testing Library, Testcontainers and Playwright are added in steps 1.2–1.5                                                                                      |
| Validation                    | Zod                                                                            | `^4.1.0`                                     |                                                                                                                                                                |
| ORM                           | Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`, `prisma.config.ts`) | `^7.10.0`                                    | Package `packages/db`; Prisma 8 is still a release candidate                                                                                                   |
| HTTP client and server state  | Axios, TanStack Query                                                          | `^1.13.0`, `^5.90.0`                         |                                                                                                                                                                |
| API reference                 | Scalar (`@scalar/nextjs-api-reference`, `@scalar/api-reference`)               | `^0.12.0`, `^1.70.0`                         | Self-hosted bundle (ADR-0003)                                                                                                                                  |
| OpenAPI lint and diff         | Redocly CLI, oasdiff (container)                                               | `^2.10.0`, `v1.35.0`                         | ADR-0003                                                                                                                                                       |
| Integration tests             | Testcontainers PostgreSQL, tsx                                                 | `^12.0.0`, `^4.20.0`                         | Needs a Docker socket (runbook)                                                                                                                                |
| Identity provider and sign-in | Keycloak; openid-client + jose                                                 | `26.8.0` (image); `^6.8.0`, `^6.2.0`         | ADR-0002, ADR-0004. Move to the latest 26.8.x patch once it is two weeks old                                                                                   |
| Mutation testing              | Stryker + vitest runner                                                        | `10.1.1` (both, exact: the runner pins core) | Engine only, break below 70% (step 1.1)                                                                                                                        |
| Logging                       | pino                                                                           | `^10.0.0`                                    |                                                                                                                                                                |
| Tracing                       | OpenTelemetry Node SDK                                                         | `^0.300.0`, API `~1.10.0`                    | Configured only through standard `OTEL_*` variables                                                                                                            |
| Database                      | PostgreSQL                                                                     | `17-alpine`                                  | Confirm the hosted version with the platform team (Q4)                                                                                                         |
| Local tracing viewer          | Jaeger                                                                         | `2.22.0`                                     | Receives OTLP directly; development only                                                                                                                       |
| Local mail                    | Mailpit                                                                        | `v1.31.4`                                    | Development only                                                                                                                                               |

Added in later steps, each with its own ADR entry or PR justification: shadcn/ui, Tailwind and Storybook (1.4), next-intl, React Hook Form and anime.js (1.5–1.6), ExcelJS (release 2).

## Consequences

- After the first `pnpm install`, the tech lead records the resolved versions (`pnpm list -r --depth 0`) in this ADR and commits the lockfile.
- Upgrades happen in their own PRs. Never mix an upgrade with feature work.
- Moving to TypeScript 7, ESLint 10 or pnpm 12 is a tracked follow-up, not something to do in passing.

### Resolved versions

_Fill in after the first install._
