<!-- Copy of docs/pull-request-template.md for Git hosts that read .github/. Keep both in sync. -->

## Task

Backlog ID: <!-- e.g. F-02 --> · Design section: <!-- e.g. 12.2 -->

## What changed

## How it was verified

- [ ] `pnpm check` (type check, lint, format, unit tests)
- [ ] Integration tests (when API or schema code changed): `pnpm test:int`
- [ ] Manually: <!-- steps -->

## What was NOT verified

<!-- Be explicit. "Nothing" is rarely true. -->

## Definition of done (design 15.2)

- [ ] Tests come with the code; coverage gate for the layer is met
- [ ] Golden parity tests pass (engine untouched, or ADR linked: ___ )
- [ ] API changes: OpenAPI document regenerated, linted, no unapproved breaking change
- [ ] EN and VI messages complete
- [ ] Docs updated: ADR / runbook / `docs/engine-findings.md` as relevant
- [ ] No secrets, no real or personal data (synthetic values only)
- [ ] New dependencies justified below and licence checked

## New dependencies

<!-- name · version · licence · why it is needed · alternatives considered -->

## Reviewer notes

- [ ] Touches a sensitive path (`packages/engine`, `prisma/`, `lib/rbac.ts`, auth, `docker/keycloak`, `deploy/`): named human reviewer: ___
- [ ] Security review needed (auth, rbac, realm export)?
