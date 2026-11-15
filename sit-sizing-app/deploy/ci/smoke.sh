#!/usr/bin/env bash
# Starts the production-like compose stack with the images under test, checks liveness,
# readiness and headers of the web app and the MCP server (ADR-0016), then runs the
# Playwright E2E suite against it (design 12.5, 13).
# Fixed ports: Keycloak's public URL and the app's redirect URIs must be known before start.
# E2E=off skips the browser suite (never on main or release branches).
# E2E_RUNNER=host runs Playwright on this machine (installed Google Chrome, no visual
# baselines) instead of the Playwright image: that is `pnpm test:e2e` locally.
set -euo pipefail
IMAGE="${1:?usage: smoke.sh <web-image:tag> <mcp-image:tag>}"
MCP_IMAGE="${2:?usage: smoke.sh <web-image:tag> <mcp-image:tag>}"
PROJECT="sit-ci-${BUILD_NUMBER:-local}"
ENV_FILE="$(mktemp)"
COMPOSE=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f docker/compose.yaml)
cleanup() {
  "${COMPOSE[@]}" logs --no-color web > reports/smoke-web.log 2>&1 || true
  "${COMPOSE[@]}" logs --no-color worker > reports/smoke-worker.log 2>&1 || true
  "${COMPOSE[@]}" logs --no-color mcp > reports/smoke-mcp.log 2>&1 || true
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$ENV_FILE"
}
mkdir -p reports
trap cleanup EXIT

rand() { head -c 18 /dev/urandom | base64 | tr '+/' '-_' | tr -d '='; }
cat > "$ENV_FILE" <<ENV
POSTGRES_SUPERUSER_PASSWORD=$(rand)
APP_DB_PASSWORD=$(rand)
KEYCLOAK_DB_PASSWORD=$(rand)
KEYCLOAK_ADMIN_PASSWORD=$(rand)
OIDC_CLIENT_SECRET=$(rand)
SESSION_SECRET=$(rand)$(rand)
KC_DEV_USER_PASSWORD=$(rand)
KEYCLOAK_PORT=${E2E_KEYCLOAK_PORT:-28080}
WEB_PORT=${E2E_WEB_PORT:-23000}
MAIL_UI_PORT=${E2E_MAIL_PORT:-28025}
MCP_PORT=${E2E_MCP_PORT:-23100}
DB_PORT=0
APP_ENV=local
APP_VERSION=${APP_VERSION:-smoke}
LOG_LEVEL=info
REGISTRY_PREFIX=${REGISTRY_PREFIX:-}
ENV

# Use the images built earlier instead of rebuilding. MCP_DEV_USER is never set here: the
# MCP server must demand a bearer token, as it does outside a laptop.
docker tag "$IMAGE" sit-sizing-web:local
docker tag "$MCP_IMAGE" sit-sizing-mcp:local
# The migrate, seed and worker services use the tools stage (workspace, no Next.js build).
"${COMPOSE[@]}" build migrate
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 240 db keycloak mail web worker mcp
# Synthetic seed (projects, members, the default profile, the worked example): E2E needs it.
"${COMPOSE[@]}" run --rm --no-deps seed

WEB_PORT=$("${COMPOSE[@]}" port web 3000 | awk -F: '{print $NF}')
BASE="http://127.0.0.1:${WEB_PORT}"

curl -fsS "$BASE/api/v1/health" | tee /dev/stderr | grep -q '"status":"ok"'
curl -fsS "$BASE/api/v1/ready"  | tee /dev/stderr | grep -q '"status":"ready"'
curl -fsS -o /dev/null -D - "$BASE/" | grep -qi '^content-security-policy:'
curl -fsS -o /dev/null -D - "$BASE/api/v1/health" | grep -qi '^x-request-id:'

# MCP server (ADR-0016). Responses are captured before matching: under pipefail,
# `curl | grep -q` can fail when grep exits early (SIGPIPE).
MCP_PORT=$("${COMPOSE[@]}" port mcp 3100 | awk -F: '{print $NF}')
MCP_BASE="http://127.0.0.1:${MCP_PORT}"
fail() { echo "MCP smoke failed: $*" >&2; exit 1; }
mcp_health="$(curl -fsS "$MCP_BASE/health")"
[[ "$mcp_health" == *'"status":"ok"'* ]] || fail "/health: $mcp_health"
mcp_ready="$(curl -fsS "$MCP_BASE/ready")"
[[ "$mcp_ready" == *'"status":"ready"'* ]] || fail "/ready: $mcp_ready"
# Unauthenticated MCP request: 401 with a challenge that points at the protected
# resource metadata (how a client discovers Keycloak and signs in).
mcp_headers="$(curl -sS -o /dev/null -D - -X POST "$MCP_BASE/mcp" \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}')"
mcp_status="$(printf '%s\n' "$mcp_headers" | awk 'toupper($1) ~ /^HTTP\// {code=$2} END {print code}')"
[[ "$mcp_status" == "401" ]] || fail "unauthenticated POST /mcp answered $mcp_status, expected 401"
mcp_challenge="$(printf '%s\n' "$mcp_headers" | tr -d '\r' | awk 'tolower($0) ~ /^www-authenticate:/')"
[[ "$mcp_challenge" == *'Bearer'*'resource_metadata='* ]] || fail "WWW-Authenticate missing or without resource_metadata: ${mcp_challenge:-none}"
echo "MCP: /health ok, /ready ready, unauthenticated POST /mcp -> 401 ($mcp_challenge)"

echo
echo "smoke test passed"

if [[ "${E2E:-on}" != "off" ]]; then
  export E2E_BASE_URL="http://localhost:${WEB_PORT}"
  export E2E_MAILPIT_URL="http://localhost:${E2E_MAIL_PORT:-28025}"
  KC_DEV_USER_PASSWORD="$(grep '^KC_DEV_USER_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
  export KC_DEV_USER_PASSWORD
  if [[ "${E2E_RUNNER:-docker}" == "host" ]]; then
    pnpm --filter @sit/web exec playwright test
  else
    deploy/ci/e2e.sh
  fi
fi
