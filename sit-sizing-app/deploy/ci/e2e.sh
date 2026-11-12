#!/usr/bin/env bash
# Playwright E2E (design 13, L5) in the official Playwright image, matching the installed
# @playwright/test version, against a running stack (E2E_BASE_URL). Host networking lets the
# browser reach the app and Keycloak on the agent's localhost ports.
# UPDATE_SNAPSHOTS=1 regenerates the Linux visual baselines (commit them after review).
set -euo pipefail
: "${E2E_BASE_URL:?set E2E_BASE_URL}"
: "${KC_DEV_USER_PASSWORD:?set KC_DEV_USER_PASSWORD}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
# The agent may have no Node: read the version from the installed package.
VERSION="$(sed -n 's/^  "version": "\([^"]*\)".*/\1/p' apps/web/node_modules/@playwright/test/package.json | head -1)"
IMAGE="${REGISTRY_PREFIX:-}mcr.microsoft.com/playwright:v${VERSION}-noble"
ARGS=(--update-snapshots=none)
[[ "${UPDATE_SNAPSHOTS:-0}" == "1" ]] && ARGS=(--update-snapshots=all)
mkdir -p reports/e2e

docker run --rm --network host --ipc=host \
  -v "$ROOT":"$ROOT" -w "$PWD/apps/web" \
  -u "$(id -u):$(id -g)" -e HOME=/tmp -e CI=true \
  -e E2E_BASE_URL -e E2E_MAILPIT_URL -e KC_DEV_USER_PASSWORD -e E2E_VISUAL=1 -e E2E_BROWSER=bundled \
  "$IMAGE" \
  npx playwright test "${ARGS[@]}"
