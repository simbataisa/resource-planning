#!/usr/bin/env bash
# Runs the MCP scripted flow test (tests/e2e/flow.test.ts) against an isolated compose
# stack: its own project name, ports, volumes and random secrets, so a running
# `pnpm dev:up` stack (project sit-sizing) is never touched. Same pattern as
# deploy/ci/smoke.sh. The stack runs the production-like images with dev sign-in:
# the API with AUTH_MODE=dev, the MCP server with MCP_DEV_USER=dev-estimator
# (APP_ENV=local, both refused anywhere else). Keycloak is not started: dev mode
# does not need it. The stack is removed afterwards, with its volumes.
#
#   pnpm --filter @sit/mcp test:e2e:stack
#   NO_BUILD=1 ...   reuse the sit-sizing-{web,tools,mcp}:local images already built
# Building retags the shared images sit-sizing-{web,tools,mcp}:local (as `pnpm test:e2e`
# does for web and tools); running containers keep the image they started with.
set -euo pipefail
cd "$(dirname "$0")/../../.."

PROJECT="sit-mcp-flow-${BUILD_NUMBER:-local}"
WEB_PORT="${MCP_FLOW_WEB_PORT:-23300}"
MCP_PORT="${MCP_FLOW_MCP_PORT:-23310}"
TMP="$(mktemp -d)"
ENV_FILE="$TMP/env"
OVERRIDE="$TMP/compose.flow.yaml"
COMPOSE=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f docker/compose.yaml -f "$OVERRIDE")

cleanup() {
  mkdir -p reports
  "${COMPOSE[@]}" logs --no-color web > reports/mcp-flow-web.log 2>&1 || true
  "${COMPOSE[@]}" logs --no-color mcp > reports/mcp-flow-mcp.log 2>&1 || true
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

rand() { head -c 18 /dev/urandom | base64 | tr '+/' '-_' | tr -d '='; }
# Fresh secrets every run; Keycloak values are only needed for compose interpolation.
cat > "$ENV_FILE" <<ENV
POSTGRES_SUPERUSER_PASSWORD=$(rand)
APP_DB_PASSWORD=$(rand)
KEYCLOAK_DB_PASSWORD=$(rand)
KEYCLOAK_ADMIN_PASSWORD=$(rand)
OIDC_CLIENT_SECRET=$(rand)
SESSION_SECRET=$(rand)$(rand)
KC_DEV_USER_PASSWORD=$(rand)
KEYCLOAK_PORT=${MCP_FLOW_KEYCLOAK_PORT:-28380}
WEB_PORT=${WEB_PORT}
MCP_PORT=${MCP_PORT}
MAIL_UI_PORT=0
DB_PORT=0
APP_ENV=local
AUTH_MODE=dev
APP_VERSION=mcp-flow
LOG_LEVEL=info
REGISTRY_PREFIX=${REGISTRY_PREFIX:-}
ENV

# Dev sign-in for the MCP server, in this throwaway stack only (never in compose.yaml).
cat > "$OVERRIDE" <<'YAML'
services:
  mcp:
    environment:
      MCP_DEV_USER: dev-estimator
YAML

if [[ -z "${NO_BUILD:-}" ]]; then
  "${COMPOSE[@]}" build migrate web mcp
fi
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 300 db web mcp
# Synthetic seed: users dev-estimator and dev-lead, project DEMO.
"${COMPOSE[@]}" run --rm --no-deps seed

# Captured first: `curl | grep -q` can fail under pipefail when grep exits early (SIGPIPE).
health="$(curl -fsS "http://127.0.0.1:${MCP_PORT}/health")"
[[ "$health" == *'"status":"ok"'* ]] || { echo "MCP /health: $health" >&2; exit 1; }
# /ready is expected to be 503 here: the API's readiness includes Keycloak, not started.
echo "MCP /ready: $(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${MCP_PORT}/ready") (503 expected without Keycloak)"

MCP_E2E_URL="http://127.0.0.1:${MCP_PORT}/mcp" \
SIT_E2E_API_URL="http://127.0.0.1:${WEB_PORT}" \
  pnpm --filter @sit/mcp test:e2e
