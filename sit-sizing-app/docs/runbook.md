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
- **Suite.** `release2.spec.ts` covers the release 2 exit criteria: approval end to end with notices and email, a published profile used by a new estimate, and the Excel export equal to the screen. The smoke suite:
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
