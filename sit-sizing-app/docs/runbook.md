# Runbook

Covers local development, tests, the pipeline, Keycloak, release and deployment, backup and restore, notifications (releases 1 to 3) and the MCP server. For a visual walkthrough, open [guide/run-and-deploy.html](guide/run-and-deploy.html) in a browser.

## 1. Prerequisites

| Tool              | Version                                                               | Notes                                                           |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| Node.js           | 24 LTS                                                                | `nvm use` reads `.nvmrc`                                        |
| pnpm              | 10.34.9                                                               | `corepack enable` provides the version pinned in `package.json` |
| Container runtime | Docker Desktop, or Rancher Desktop with the **dockerd (moby)** engine | Compose v2 (`docker compose`) is required                       |

## 2. First run

```bash
corepack enable
pnpm install            # installs dependencies and generates the Prisma client
pnpm check              # type check, lint, format check, unit tests
pnpm dev:up             # creates .env with random local passwords, then starts db, migrate, seed,
                        # Keycloak, web, worker, mail and the MCP server
open http://localhost:3000            # redirects to Keycloak; sign in as dev-estimator
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

| Command                                             | What it does                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm db:migrate`                                   | Apply migrations                                                                                                                           |
| `pnpm db:seed`                                      | Synthetic users, projects DEMO and OTHER, the default global profile, an example estimate (refuses sit/prod)                               |
| `pnpm db:check`                                     | Validate the schema; the drift check (migrations vs `schema.prisma`) runs when `SHADOW_DATABASE_URL` is set, and always in `pnpm test:int` |
| `pnpm --filter @sit/db migrate:dev --name <change>` | Create a new migration (local only)                                                                                                        |

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

`deploy/Jenkinsfile` (multibranch job on the TCB repository, script path `sit-sizing-app/deploy/Jenkinsfile`). Stages: install → type check and lint → unit tests with coverage → engine mutation gate → API integration tests → build image → security scans → compose smoke test and Playwright E2E (`deploy/ci/smoke.sh` → `deploy/ci/e2e.sh`) → publish to Nexus (`main` only).

Jenkins configuration that the platform team provides:

| Item                                                   | Purpose                                                 |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Agent label `docker`                                   | Docker Engine and Compose v2                            |
| `REGISTRY_PREFIX`                                      | Nexus Docker pull-through prefix, with a trailing slash |
| `NPM_REGISTRY`                                         | Nexus npm proxy URL                                     |
| `NEXUS_DOCKER_REGISTRY` and credentials `nexus-docker` | Image push target                                       |
| `gitleaks` and `trivy` on the agent                    | Secret and image scans (`deploy/ci/security-scans.sh`)  |
| `mcr.microsoft.com/playwright` through Nexus           | E2E browser image, same version as `@playwright/test`   |
| Free ports 23000 and 28080 on the agent                | The E2E stack (`E2E_WEB_PORT`, `E2E_KEYCLOAK_PORT`)     |

### Branch protection (F-05) — set on the Git host

- `main` is protected: no direct pushes, no force pushes, linear history.
- Every PR needs at least one human approval. PRs that touch engine, migration, auth, Keycloak or pipeline paths need a named human reviewer (the PR template has a checkbox for this).
- The Jenkins status check must pass before merging.
- Nobody approves their own PR. An agent's approval never counts (design 15.5).
- **Code owners are optional for now.** To turn them on later, copy `docs/CODEOWNERS.example` to the repository root, replace the `@OWNER-…` placeholders, and enable "require code owner review".
- If the Git host does not read `.github/pull_request_template.md`, use `docs/pull-request-template.md` as the template.

## 5. Keycloak (step 1.3)

| What            | Where                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign-in page    | http://localhost:3000 redirects to Keycloak at http://localhost:18080                                                                                                    |
| Synthetic users | `dev-admin`, `dev-lead`, `dev-estimator`, `dev-viewer`, `dev-outsider`; password = `KC_DEV_USER_PASSWORD` in `.env`. `dev-admin` must set up TOTP on first sign-in       |
| Admin console   | http://localhost:18080/admin (master realm), user `admin`, password `KEYCLOAK_ADMIN_PASSWORD` in `.env`. Local only; in server environments the console is internal-only |
| Realm as code   | `docker/keycloak/realm/qe-tools-realm.json` (all environments), `docker/keycloak/dev/qe-tools-users-0.json` (local only)                                                 |
| Login theme     | `docker/keycloak/themes/tcb` (TCB-DS red in the app's theme, ADR-0005)                                                                                                   |
| Baseline checks | `pnpm test` (realm export) and `pnpm test:idp` (running Keycloak)                                                                                                        |

**Changing the realm.** Edit the export in a pull request; never change `sit` or `prod` in the console without exporting back. Keycloak imports the realm only when it does not exist yet, so locally apply a change with `pnpm dev:keycloak-reset` (drops and re-creates only the local `keycloak` database, then restarts Keycloak).

Server environments apply realm changes with a reviewed import job (to be added with hosting, Q4).

**Upgrades (design 10.7).** Pin the image tag in `docker/compose.yaml` and `tests/identity/keycloak.test.ts`; run `pnpm test:idp` and the sign-in E2E, then upgrade `sit` before `prod`. Back up the `keycloak` database together with `app`.

**Sign-in problems.**

| Symptom                                           | Fix                                                                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/api/v1/ready` reports `identityProvider` not ok | Keycloak is still starting (about 30 s) or `OIDC_INTERNAL_URL` is wrong                        |
| Keycloak says "Invalid redirect uri"              | `APP_BASE_URL` and `SIT_WEB_BASE_URL` (compose) must match the URL in the browser              |
| Signed out every 10 minutes                       | The refresh with Keycloak fails: check the web logs for `REFRESH_FAILED` and Keycloak's events |
| Signed out right after signing out elsewhere      | Expected: back-channel logout (step 1.7). Keycloak posts to `SIT_WEB_BACKCHANNEL_URL`          |

**Back-channel logout with `pnpm dev` on the host.** Keycloak (in a container) must reach the app. Set `SIT_WEB_BACKCHANNEL_URL=http://host.docker.internal:3000/api/auth/backchannel-logout` in `.env`, then `pnpm dev:keycloak-reset`. With `pnpm dev:up` the default (`http://web:3000/…`) already works.

## 6. End-to-end tests (step 1.7)

```bash
pnpm test:e2e      # the gate: production build in its own stack, then Playwright in your Chrome
pnpm test:e2e:dev  # quick iteration against the running dev stack (pnpm dev:up); not a gate
pnpm test:e2e:report  # open the last HTML report (traces and screenshots of failures)
```

- **Why the gate uses the production build.** `next dev` compiles every page on first request and restarts itself on config changes or near its memory limit. Under a full suite that means minute-long gaps at random points, so failures depend on timing rather than on the code. `pnpm test:e2e` builds the web image and runs `deploy/ci/smoke.sh` with `E2E_RUNNER=host`: the same stack CI uses, as compose project `sit-ci-local` on ports 23000 (web), 28080 (Keycloak) and 28025 (Mailpit). It has fresh random secrets and the synthetic seed, and is removed afterwards. It can run while `pnpm dev:up` is running.
- **Dev server restarts.** The dev container logs `[dev] next dev exited with code …` before Docker restarts it. If restarts are frequent, check `pnpm dev:logs` for "approaching the used memory threshold" or "Found a change in". The container already gets a 4 GB heap (`NODE_OPTIONS` in `compose.dev.yaml`).
- **Sign-in.** A setup step signs in through Keycloak as `dev-estimator` and `dev-lead` (password from `.env` or the stack's generated env, never printed), and the tests reuse those sessions.
- **Suite.** `release3.spec.ts` covers the release 3 exit criteria: actuals from one SIT cycle used to publish a calibrated profile, and portfolio totals equal to the underlying versions (on screen and in CSV), plus the audit log and project members. `release2.spec.ts` covers the release 2 exit criteria: approval end to end with notices and email, a published profile used by a new estimate, and the Excel export equal to the screen. The smoke suite:
  - creates an estimate from the worked example and checks the prototype's numbers;
  - edits a quantity and checks autosave;
  - exports the profile and saves a version;
  - opens the content pages with axe, the API reference (CSP nonce) and the Vietnamese switch;
  - signs out last.
- **Test data.** Each run adds a few estimates named `E2E · …` to the local database (synthetic). `pnpm dev:reset` clears them.
- **Visual regression.** Screenshots of the summary cards and the gap table (`@visual`) run in CI's Linux Playwright image, where the baselines are kept. To refresh them after an approved UI change, run `UPDATE_SNAPSHOTS=1 deploy/ci/e2e.sh` against a running stack and commit `apps/web/tests/e2e/*-snapshots/`.

## 7. Security settings (step 1.7)

| Setting                 | Where                                 | Notes                                                                                                       |
| ----------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Content Security Policy | `proxy.ts`, `server/http/csp.ts`      | Fresh script nonce per request, `'strict-dynamic'`; no inline scripts without the nonce (threat model T-07) |
| Rate limit              | `RATE_LIMIT_PER_MINUTE` (default 300) | Per user and app instance; 429 with `Retry-After`. Tune with the non-functional targets (Q10)               |
| Back-channel logout     | `/api/auth/backchannel-logout`, realm | Keycloak ends a session → the app refuses it on the next request (`RevokedSession`, rows expire after 12 h) |
| Security headers        | `next.config.ts`                      | HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`                                 |

## 8. Release, promotion and rollback (design 12.5)

1. **Release candidate.** Jenkins on `main` is green: tests, coverage gates, engine parity and mutation gate, integration tests, security scans, E2E. The image is published to Nexus under `APP_VERSION`.
2. **Checklist.** Complete `docs/release-checklist.md` in the release pull request. It covers scan results, the restore test date, the IdP review and the VI sign-off.
3. **Migrate, then deploy.** Run the `tools` image (`pnpm db:migrate`) against the target database. Then roll out the same image to `dev` → `sit` → `prod`; only environment variables and secrets differ.
4. **Promotion to `prod`** needs a human approval in Jenkins.
5. **Rollback.** Redeploy the previous image tag. Migrations are expand-only within a release (design 12.5), so the previous version runs on the new schema. Never edit or roll back a merged migration; fix forward.
6. **Keycloak realm changes** go through the reviewed import job, not the console (section 5).

### 8.1 What runs in a server environment

| Component     | Image and command                                                         | Notes                                                                  |
| ------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Migration job | `tools` stage, `pnpm db:migrate`                                          | Run once per release, before the web rollout                           |
| Web app       | `sit-sizing-web:<APP_VERSION>` (`runner` stage), port 3000                | Read-only root filesystem, non-root, writable `/tmp` and `.next/cache` |
| Worker        | `tools` stage, `node_modules/.bin/tsx worker/main.ts` in `/repo/apps/web` | `PROCESS_ROLE=worker`; several replicas are safe                       |
| PostgreSQL 17 | Platform-managed                                                          | Databases `app` and `keycloak` (see `docker/postgres/init`)            |
| Keycloak 26.8 | Platform-managed, realm from `docker/keycloak/realm/qe-tools-realm.json`  | Never import `docker/keycloak/dev/` (synthetic users) outside local    |

The pipeline publishes only the web image today. Build the `tools` image from the same commit (`docker build -f docker/Dockerfile --target tools .`) until a publish step is added for it.

### 8.2 Environment variables outside local

All values come from the platform secret store (design 11, Q4), never from a committed file. `apps/web/server/env.ts` validates them at start-up and refuses to start when a rule is broken.

| Variable                               | Value                                                    |
| -------------------------------------- | -------------------------------------------------------- |
| `APP_ENV`                              | `dev`, `sit` or `prod`                                   |
| `APP_VERSION`                          | The image tag                                            |
| `DATABASE_URL`                         | `postgresql://…/app` for the app user                    |
| `APP_BASE_URL`                         | Public URL of the app; must be `https://` outside local  |
| `AUTH_MODE`                            | `oidc` (`dev` is refused outside local)                  |
| `OIDC_ISSUER`                          | `https://<idp>/realms/qe-tools`, as the browser sees it  |
| `OIDC_INTERNAL_URL`                    | Only when the server reaches Keycloak on a different URL |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | `sit-sizing-web` and its secret (16+ characters)         |
| `SESSION_SECRET`                       | 32+ random characters; rotating it signs everyone out    |
| `LOG_LEVEL`                            | `info`; `debug` and `trace` are refused in `prod`        |
| `RATE_LIMIT_PER_MINUTE`                | Default 300 (Q10)                                        |
| `OTEL_EXPORTER_OTLP_ENDPOINT`          | Tracing collector, optional                              |
| `SMTP_URL`, `MAIL_FROM` (worker)       | The approved relay (Q12); unset keeps emails queued      |

### 8.3 Deployment steps

1. Confirm the release checklist is complete and the Jenkins run on `main` is green.
2. Back up `app` and `keycloak` (or confirm the nightly backup), then run the migration job and wait for it to finish successfully.
3. Roll out the web image and the worker with the new `APP_VERSION`.
4. Check `GET /api/v1/health` (process up) and `GET /api/v1/ready` (database and identity provider reachable), then sign in once.
5. On failure, redeploy the previous tag of both web and worker (step 5 above).

**Still open:** the hosting platform, secret store and import job for the realm are decided with the platform team (design section 16, Q4). Until then, these steps describe what any container platform must provide; they are not a platform-specific procedure.

## 9. Backup and restore (design 12.7)

- **Backups.** Nightly backups of the `app` and `keycloak` databases (point-in-time recovery if the platform offers it) are owned by the platform team (Q4). The realm export and configuration are in the repository, so Keycloak can be rebuilt from code plus its database backup.
- **Restore test, before every release:**

  ```bash
  pnpm db:restore-test   # against the running compose stack
  ```

  It dumps both databases (`reports/backup/`), restores each into a scratch database, compares the row counts of the key tables, drops the scratch copies and appends the result to `reports/restore-test.log`. For `sit` and `prod`, restore the platform backup into a scratch server instead and run the same row-count comparison.

- **Record of restore tests:**

| Date | Environment | Result | By  |
| ---- | ----------- | ------ | --- |
|      |             |        |     |

## 10. Notifications (release 2, N-01)

- **Services:** `worker` sends queued emails; `mail` (Mailpit) catches them locally. `pnpm dev:up` starts both. Read the local inbox at <http://localhost:8025>.
- **Settings:** `SMTP_URL` (unset: emails stay queued), `MAIL_FROM`, `NOTIFY_MAX_ATTEMPTS` (6), `NOTIFY_POLL_MS` (5000). Outside local, `SMTP_URL` comes from the secret store and points at the approved relay (Q12).
- **Logs:** `docker compose … logs -f worker`. Lines carry `component: notify-worker`, and a summary is logged after each batch that did something.
- **Check the queue:**
  ```sql
  SELECT status, count(*) FROM "Notification" WHERE channel = 'EMAIL' GROUP BY status;
  SELECT id, attempts, "nextAttemptAt", "lastError" FROM "Notification"
  WHERE channel = 'EMAIL' AND status = 'FAILED' ORDER BY "createdAt" DESC LIMIT 20;
  ```
- **Resend failed emails after fixing the cause:**
  ```sql
  UPDATE "Notification" SET status = 'PENDING', attempts = 0, "nextAttemptAt" = now()
  WHERE channel = 'EMAIL' AND status = 'FAILED' AND "createdAt" > now() - interval '7 days';
  ```
- **Scaling:** several worker replicas are safe; rows are claimed with `SKIP LOCKED`.

## 11. MCP server (ADR-0016)

The `mcp` service lets AI assistants (Claude Code, Codex) read and edit estimates through the API, as the signed-in user, with that user's permissions. It holds no data and no secrets: every tool call goes to `/api/v1` with the caller's Keycloak access token. Code: `apps/mcp`; image target `mcp` in `docker/Dockerfile` (`sit-sizing-mcp:local`).

### Start, stop, logs, health

| What          | How                                                                                                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Start         | `pnpm dev:up` (dev sign-in, see below) or `pnpm stack:up` (production-like image, Keycloak sign-in). Both wait for `mcp` to be healthy. MCP endpoint: http://localhost:3100/mcp                                                                                                                                                |
| Stop          | `pnpm dev:down` / `pnpm stack:down`, or only this service: `docker compose --env-file .env -f docker/compose.yaml -f docker/compose.dev.yaml stop mcp`                                                                                                                                                                         |
| Logs          | `docker compose --env-file .env -f docker/compose.yaml -f docker/compose.dev.yaml logs -f mcp`. One line per request (method, path, status, duration) and per tool call (tool name, status, duration); never tool arguments or tokens                                                                                          |
| Liveness      | `curl -s localhost:3100/health` → `{"status":"ok"}` (the compose healthcheck)                                                                                                                                                                                                                                                  |
| Readiness     | `curl -s localhost:3100/ready` → `{"status":"ready"}` when the API's `/api/v1/ready` answers 200, otherwise 503 `not_ready`                                                                                                                                                                                                    |
| Scripted flow | `pnpm --filter @sit/mcp test:e2e` against `pnpm dev:up`, or `pnpm --filter @sit/mcp test:e2e:stack`: builds the images and runs the flow in an isolated stack (project `sit-mcp-flow-local`, ports 23300/23310, fresh secrets), then removes it. Both create estimates and versions in the stack they target (synthetic names) |
| Hardening     | Non-root user, read-only root filesystem with a tmpfs on `/tmp` (tsx compile cache), all capabilities dropped, `no-new-privileges`                                                                                                                                                                                             |

**Dev sign-in.** `compose.dev.yaml` sets `APP_ENV=local` and `MCP_DEV_USER=dev-estimator`: the server then sends the API's `x-dev-user` header instead of a token, so tools work without signing in. It needs the API in dev mode (`AUTH_MODE=dev`, the default in the generated `.env`). The server refuses to start with `MCP_DEV_USER` unless `APP_ENV=local`, and `compose.yaml` never sets it. The dev service restarts on source changes with `tsx watch`, but file events from a macOS bind mount do not always reach the container: if a change does not show, run `docker compose --env-file .env -f docker/compose.yaml -f docker/compose.dev.yaml restart mcp`. For real Keycloak sign-in locally, use `pnpm stack:up` with `AUTH_MODE=oidc` in `.env` (the API accepts bearer tokens only in OIDC mode).

### Environment

Validated at start-up by `apps/mcp/src/env.ts`; a bad value stops the server with the variable's name (never its value). All are in `.env.example`.

| Variable                    | Compose value                            | Meaning                                                                                       |
| --------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `APP_ENV`                   | from `.env` (required)                   | `local`, `dev`, `sit` or `prod`. Outside `local`: `MCP_PUBLIC_URL` must be https, no dev user |
| `LOG_LEVEL`                 | from `.env`, default `info`              | `debug`/`trace` are refused in `prod`                                                         |
| `SIT_API_BASE_URL`          | `http://web:3000`                        | Origin of the web app; the server calls `<origin>/api/v1`                                     |
| `OIDC_ISSUER`               | `http://localhost:18080/realms/qe-tools` | Must equal the token's `iss` (the browser-facing Keycloak URL)                                |
| `OIDC_INTERNAL_URL`         | `http://keycloak:8080`                   | Where the server fetches the realm's signing keys                                             |
| `OIDC_API_AUDIENCE`         | `sit-sizing-api`                         | Audience every token must carry                                                               |
| `MCP_PUBLIC_URL`            | `http://localhost:3100`                  | This server's public origin (OAuth protected resource). https outside local                   |
| `MCP_PORT`                  | `3100` (host port from `.env`)           | Listening port                                                                                |
| `MCP_RATE_LIMIT_PER_MINUTE` | `60`                                     | Tool calls per user per minute and instance; keep below the API's `RATE_LIMIT_PER_MINUTE`     |
| `MCP_DEV_USER`              | `dev-estimator` in the dev overlay only  | Seeded user to act as, without Keycloak. Local only                                           |

Outside local the URL must be reachable over HTTPS from QE laptops, and so must Keycloak (sign-in runs in the user's browser). Network exposure is the platform team's decision (threat model).

### How a QE adds the server to an assistant

Supported clients follow ADR-0016's compatibility table. Replace the URL with the environment's MCP URL (`https://…/mcp`; locally `http://localhost:3100/mcp`). On first use the assistant opens Keycloak in the browser; sign in as usual.

| Client      | Status      | How to add it                                                                                                                                                                                                                                                                                 |
| ----------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | Supported   | `claude mcp add --transport http --client-id sit-sizing-mcp sit-sizing https://<host>/mcp`, then `/mcp` in Claude Code to sign in. Uses the pre-registered public client                                                                                                                      |
| Codex       | Supported   | Add the URL as a Streamable HTTP server in Codex's MCP settings (for example `codex mcp add sit-sizing --url https://<host>/mcp`; check the syntax of the installed version), then sign in when Codex asks. No client ID: Codex registers its own client on each sign-in (see clean-up below) |
| Antigravity | Unsupported | It never starts a sign-in (`initialize: Unauthorized`). No workaround in this version                                                                                                                                                                                                         |
| Kiro        | Not tested  | Unknown until someone tests it; record the result in ADR-0016                                                                                                                                                                                                                                 |

Before the first use, the QE signs in to SIT Sizing once in the browser: the app account is created there, never through the MCP server.

### Tool errors the assistant may report

| Code              | Meaning                                                                                                    | What to do                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `NOT_PROVISIONED` | The token is valid, but the person has no active SIT Sizing account yet (or it was deactivated)            | Sign in to SIT Sizing once in the browser; an admin reactivates deactivated users |
| `EDITOR_OPEN`     | The user has the draft open in the editor (they hold its edit lock), so the assistant will not write to it | Close the draft in the editor (or wait for the lock to expire), then ask again    |
| `LOCKED`          | Someone else holds the draft's edit lock; the message names them and the expiry time                       | Wait, or ask that person or a QE Lead (who can take the lock over in the editor)  |
| `NO_DRAFT`        | The estimate has no open draft                                                                             | Ask the assistant to start a draft (`start_draft`) first                          |
| `RATE_LIMITED`    | Too many tool calls this minute (server or API limit); the message gives the retry time                    | Wait and retry                                                                    |

A refused or expired token is not a tool error: the server answers with an OAuth challenge and the client asks the user to sign in again.

### Clean-up of self-registered clients (Codex)

Codex registers a new public client in the `qe-tools` realm on every sign-in, and the realm's anonymous registration policy allows at most **200 clients** ("Max Clients Limit"). When the limit is reached, new Codex sign-ins fail (registration refused with 403); Claude Code is unaffected. An admin checks monthly, and whenever a Codex sign-in fails that way:

Every command below runs in a shell inside the Keycloak container, which has `bash`, `grep`, `cut` and `wc` (no `jq`, no `curl`). Locally: `docker compose --env-file .env -f docker/compose.yaml exec keycloak bash`; elsewhere, the same image on the internal admin network. Checked against `keycloak/keycloak:26.8.0`.

1. Sign in to the admin CLI (it asks for the `admin` password; locally `KEYCLOAK_ADMIN_PASSWORD` in `.env`):
   ```bash
   K=/opt/keycloak/bin/kcadm.sh
   $K config credentials --server http://localhost:8080 --realm master --user admin
   ```
2. List the self-registered clients (internal id, then `clientId`). They have a generated UUID as `clientId` and only loopback redirect URIs; the clients defined in the realm export (`sit-sizing-web`, `sit-sizing-mcp` and Keycloak's built-in ones) have readable names, never match, and are never deleted:
   ```bash
   $K get clients -r qe-tools --fields id,clientId --format csv --noquotes | grep -E ',[0-9a-f-]{36}$'
   $K get clients -r qe-tools --fields id --format csv --noquotes | wc -l   # total, against the limit of 200
   ```
3. A client is stale when it has no active sessions (`$K get clients/<id>/session-count -r qe-tools` → `"count" : 0`) and no recent `CODE_TO_TOKEN` or `REFRESH_TOKEN` event in the realm's events (Admin console → Events, filter by client).
4. Delete each stale client by its internal id (first column): `$K delete clients/<id> -r qe-tools`. Its user only has to sign in again; Codex then registers a new client.

Record each clean-up (date, environment, clients deleted, by whom) in the release log.
