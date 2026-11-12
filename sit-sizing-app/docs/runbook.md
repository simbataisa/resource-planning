# Runbook

Covers local development and the pipeline as of step 1.0. Later steps add sections for migrations (1.2), Keycloak (1.3), backup and restore (1.7), and release promotion.

## 1. Prerequisites

| Tool              | Version                                                               | Notes                                                           |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| Node.js           | 24 LTS                                                                | `nvm use` reads `.nvmrc`                                        |
| pnpm              | 10.34.9                                                               | `corepack enable` provides the version pinned in `package.json` |
| Container runtime | Docker Desktop, or Rancher Desktop with the **dockerd (moby)** engine | Compose v2 (`docker compose`) is required                       |

## 2. First run

```bash
corepack enable
pnpm install            # creates pnpm-lock.yaml on the very first run — commit it
pnpm format             # first run only: normalise formatting of the generated scaffold
pnpm check              # type check, lint, format check, unit tests
pnpm dev:up             # creates .env with random local passwords, then starts db, web, mail
open http://localhost:3000            # placeholder home page
curl -s localhost:3000/api/v1/health  # {"status":"ok",...}
curl -s localhost:3000/api/v1/ready   # {"status":"ready",...} once the database is reachable
```

| Command                             | What it does                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev:up` / `pnpm dev:down`     | Stack with hot reload (bind mount; `node_modules` and `.next` in named volumes) |
| `pnpm stack:up` / `pnpm stack:down` | Production-like image (read-only root filesystem, non-root user)                |
| `pnpm dev:obs`                      | Adds Jaeger: UI at http://localhost:16686, OTLP at http://localhost:4318        |
| `pnpm dev:logs`                     | Follows the web container logs                                                  |
| `pnpm dev:reset`                    | **Deletes local volumes** (database, caches). Local only.                       |
| `pnpm dev`                          | Next.js on the host. Needs the `db` container; uses `apps/web/.env.local`       |

Mailpit (local email) runs at http://localhost:8025.

### Database (step 1.2)

`pnpm dev:up` runs the `migrate` service before the web app starts, then loads the synthetic seed. On the host:

| Command                                             | What it does                                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm db:migrate`                                   | Apply migrations                                                                                               |
| `pnpm db:seed`                                      | Synthetic users, projects DEMO and OTHER, the default global profile, an example estimate (refuses sit/prod)   |
| `pnpm db:check`                                     | Fail if `schema.prisma` and the migrations disagree (needs a shadow database; `app_user` has CREATEDB locally) |
| `pnpm --filter @sit/db migrate:dev --name <change>` | Create a new migration (local only)                                                                            |

If `binaries.prisma.sh` is not reachable, set `PRISMA_ENGINES_MIRROR` to the internal mirror before `pnpm install`.

### Signing in before Keycloak (step 1.2 only)

Until step 1.3, local runs use `AUTH_MODE=dev`: the API trusts an `x-dev-user` header holding a seeded subject. `env.ts` refuses this mode unless `APP_ENV=local`.

| Subject         | Role                                             |
| --------------- | ------------------------------------------------ |
| `dev-admin`     | Global Admin                                     |
| `dev-lead`      | QE Lead of DEMO                                  |
| `dev-estimator` | Estimator in DEMO                                |
| `dev-viewer`    | Viewer in DEMO                                   |
| `dev-outsider`  | QE Lead of OTHER only (for cross-project checks) |

```bash
curl -s -H 'x-dev-user: dev-estimator' localhost:3000/api/v1/me
```

### API reference (step 1.2)

- Interactive reference: http://localhost:3000/api/v1/docs. Until step 1.3, sign in as a dev user by running `document.cookie = 'sit-dev-user=dev-estimator; path=/'` in the browser console on `localhost:3000` (local `AUTH_MODE=dev` only), then reload.
- Raw document: `/api/v1/openapi.json`; committed copy: `docs/api/openapi.json`.
- After any API change, run `pnpm openapi:generate` and commit the result. CI runs `openapi:check`, Redocly lint and the oasdiff breaking-change check.
- Run the ADR-0003 spike checks once after the first install and record the results in the ADR.

### Integration tests

`pnpm test:int` starts PostgreSQL in a Testcontainer, applies migrations, checks drift, seeds, and calls the route handlers. It needs the Docker socket; on Rancher Desktop export the variables in section 3 first.

### Seeing a trace (F-04 acceptance)

1. `pnpm dev:obs`
2. `curl -s localhost:3000/api/v1/ready`
3. Open Jaeger at http://localhost:16686, choose the service `sit-sizing-web`, and find the `GET /api/v1/ready` span.

For `pnpm dev` on the host, uncomment `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in `apps/web/.env.local`.

## 3. Docker Desktop and Rancher Desktop (design 12.3)

The compose files use only Compose v2 features, publish ports on `127.0.0.1`, run no privileged containers, and bind-mount only the repository.

**Rancher Desktop settings:** Preferences → Container Engine → **dockerd (moby)**. Make sure "Administrative access" or the `~/.rd/bin` PATH entry is set, so that `docker` and `docker compose` resolve to Rancher's binaries.

| Runtime                        | Docker socket                                            |
| ------------------------------ | -------------------------------------------------------- |
| Docker Desktop (macOS, Linux)  | `/var/run/docker.sock` (Docker Desktop creates the link) |
| Docker Desktop (Windows)       | `npipe:////./pipe/docker_engine`                         |
| Rancher Desktop (macOS, Linux) | `$HOME/.rd/docker.sock`                                  |
| Rancher Desktop (Windows)      | `npipe:////./pipe/docker_engine`                         |

**Testcontainers with Rancher Desktop** (needed from step 1.2). `pnpm test:int` detects `~/.rd/docker.sock` and sets the first two variables itself; set them by hand only for other tools:

```bash
export DOCKER_HOST="unix://$HOME/.rd/docker.sock"
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
# Only if containers start but tests cannot reach the mapped ports (VZ networking):
export TESTCONTAINERS_HOST_OVERRIDE=$(rdctl shell ip a show rd0 | awk '/inet / {sub("/.*",""); print $2}')
```

`containerd` with `nerdctl compose` is supported on a best-effort basis only.

### Troubleshooting

| Symptom                                                | Fix                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `required variable … is missing`                       | Run `pnpm dev:env` (creates `.env`). Never commit `.env`.                                               |
| `pnpm-lock.yaml not found` during build                | Run `pnpm install` on the host once and commit the lockfile                                             |
| Port 3000 or 5432 already in use                       | Set `WEB_PORT` or `DB_PORT` in `.env`                                                                   |
| Hot reload misses changes (some Rancher setups)        | Add `WATCHPACK_POLLING: "true"` under `web.environment` in `compose.dev.yaml` locally; do not commit it |
| Database passwords changed in `.env` but sign-in fails | The init script runs only on an empty volume: `pnpm dev:reset`, then `pnpm dev:up`                      |
| `ERR_PNPM_…minimumReleaseAge`                          | The requested version is younger than 14 days. Pick an older version; do not lower the setting          |

## 4. Pipeline (design 12.5)

`deploy/Jenkinsfile` (multibranch job on the TCB repository, script path `sit-sizing-app/deploy/Jenkinsfile`). Stages: install → type check and lint → unit tests with coverage → engine mutation gate (from step 1.1) → API integration tests (from step 1.2) → build image → security scans → compose smoke test → publish to Nexus (`main` only).

Jenkins configuration that the platform team provides:

| Item                                                   | Purpose                                                 |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Agent label `docker`                                   | Docker Engine and Compose v2                            |
| `REGISTRY_PREFIX`                                      | Nexus Docker pull-through prefix, with a trailing slash |
| `NPM_REGISTRY`                                         | Nexus npm proxy URL                                     |
| `NEXUS_DOCKER_REGISTRY` and credentials `nexus-docker` | Image push target                                       |
| `gitleaks` and `trivy` on the agent                    | Secret and image scans (`deploy/ci/security-scans.sh`)  |

### Branch protection (F-05) — set on the Git host

- `main` is protected: no direct pushes, no force pushes, linear history.
- Every PR needs at least one human approval. PRs that touch engine, migration, auth, Keycloak or pipeline paths need a named human reviewer (the PR template has a checkbox for this).
- The Jenkins status check must pass before merging.
- Nobody approves their own PR. An agent's approval never counts (design 15.5).
- **Code owners are optional for now.** To turn them on later, copy `docs/CODEOWNERS.example` to the repository root, replace the `@OWNER-…` placeholders, and enable "require code owner review".
- If the Git host does not read `.github/pull_request_template.md`, use `docs/pull-request-template.md` as the template.
