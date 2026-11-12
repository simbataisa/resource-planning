# @sit/db

Prisma 7 schema, migrations, seed and client for the `app` database (design 5.2).

| Command                                             | What it does                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @sit/db generate`                    | Generates the client into `src/generated/prisma` (runs on `pnpm install`)                                  |
| `pnpm db:migrate`                                   | Applies migrations (`prisma migrate deploy`)                                                               |
| `pnpm db:seed`                                      | Loads synthetic users, two projects, the default global profile and an example estimate                    |
| `pnpm --filter @sit/db migrate:dev --name <change>` | Creates a new migration from schema changes (local only)                                                   |
| `pnpm --filter @sit/db check`                       | Validates the schema; checks migration drift when `SHADOW_DATABASE_URL` is set (always in `pnpm test:int`) |

Rules: merged migrations are never edited (AGENTS.md rule 14); every migration is backward compatible with the previous app version (expand, then contract later, design 12.5). Constraints Prisma cannot model (one draft per estimate, profile scope check, lock only on drafts, append-only audit) live in custom SQL at the end of the init migration.

`DATABASE_URL` comes from the environment, or from `apps/web/.env.local` locally (`pnpm dev:env`). `migrate:dev` and `check` also need a shadow database: set `SHADOW_DATABASE_URL` if your role cannot create databases.
