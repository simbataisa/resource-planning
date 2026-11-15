# Release checklist (step 1.7, design 12.5)

Copy this list into the release pull request and tick each item. A human approves promotion to `prod`; an agent's approval never counts.

**Release:** `APP_VERSION` ……… · **Engine:** `ENGINE_VERSION` ……… · **Date:** ………

## Build and tests

- [ ] Jenkins on `main` is green for this commit. The run covers:
  - type check, lint, unit and component tests;
  - coverage gates;
  - engine golden parity and mutation gate;
  - API integration tests (with the migration drift check);
  - Keycloak realm baseline (`pnpm test:idp`).
- [ ] Playwright E2E smoke passed against the compose stack, including axe and the visual baselines.
- [ ] Release 3 exit criteria passed in `tests/e2e/release3.spec.ts`: actuals calibrate a published profile, portfolio totals equal the underlying versions.
- [ ] Release 2 exit criteria passed in `tests/e2e/release2.spec.ts`: approval end to end with notices and email, a published profile applied to a new estimate, Excel export equal to the screen.
- [ ] Prototype parity test green (`tests/unit/prototype-ui-parity.test.tsx`).
- [ ] OpenAPI document regenerated and committed. Breaking-change diff reviewed (`deploy/ci/openapi-diff.sh`).

## Security

- [ ] Security scans attached from the Jenkins run:
  - gitleaks: no findings;
  - `pnpm audit`: no high or critical;
  - licences within policy;
  - Trivy: no fixable high or critical, for both images (`sit-sizing-web` and `sit-sizing-mcp`).
- [ ] Dynamic scan of `sit` done, findings triaged (design 11).
- [ ] IdP configuration review done and signed (`docs/security/idp-review.md`).
- [ ] Penetration test of the IdP configuration done; findings closed or accepted with an owner (`docs/security/pentest-scope.md`).
- [ ] Changes to sensitive paths reviewed by the named reviewer: engine, migrations, `lib/rbac.ts`, auth code, `docker/keycloak`, pipeline.
- [ ] Secrets for the target environment come from the secret store (Q4) and have an owner and a rotation date.
- [ ] New runtime dependencies checked for licence and supply chain: release 2 adds `exceljs` (X-02) and `nodemailer` (N-01).

## Data and operations

- [ ] Restore test done in the last 30 days and recorded in the runbook (section 9). Date: ………
- [ ] Migrations in this release are expand-only; rollback = previous image (runbook section 8).
- [ ] Rate limit (`RATE_LIMIT_PER_MINUTE`) set for the environment (Q10).
- [ ] Release 2: `worker` service deployed; `SMTP_URL` points at the approved relay (Q12) or is left unset on purpose; no `FAILED` emails left unexplained (runbook section 10).
- [ ] Dashboards and alerts in place (design 12.6): error rate, latency, failed migrations, certificate expiry.

## MCP server (ADR-0016, runbook section 11)

- [ ] MCP image `sit-sizing-mcp:<APP_VERSION>` scanned (Trivy report attached) and smoke-tested in the same Jenkins run: `/health` 200, unauthenticated `POST /mcp` answers 401 with `resource_metadata`.
- [ ] The environment's MCP URL (`https://…/mcp`) is reachable over HTTPS from a QE laptop. URL: ………
- [ ] Keycloak is reachable from the same laptop (sign-in runs in the laptop's browser).
- [ ] Sign-in verified from each supported client in ADR-0016's compatibility table, and a tool call answered. Clients, versions and date: ………
- [ ] `MCP_DEV_USER` is not set; `APP_ENV` is the target environment; `MCP_PUBLIC_URL` is the https URL above.
- [ ] Network exposure of the MCP URL and of Keycloak's registration endpoint matches what the threat model records.

## Content and sign-off

- [ ] Vietnamese review signed off (`docs/i18n/README.md`). Reviewer and date: ………
- [ ] Engine findings reviewed; no unexplained difference from the prototype (`docs/engine-findings.md`).
- [ ] Release notes written for the pilot team.
- [ ] Product owner approval: ………
