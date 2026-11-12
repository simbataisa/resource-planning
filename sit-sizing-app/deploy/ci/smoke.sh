#!/usr/bin/env bash
# Starts the production-like compose stack with the image under test and checks
# liveness and readiness (design 12.5 "E2E smoke against the compose stack").
# Playwright E2E replaces/extends this in step 1.5.
set -euo pipefail
IMAGE="${1:?usage: smoke.sh <image:tag>}"
PROJECT="sit-ci-${BUILD_NUMBER:-local}"
ENV_FILE="$(mktemp)"
COMPOSE=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f docker/compose.yaml)
cleanup() {
  "${COMPOSE[@]}" logs --no-color web > reports/smoke-web.log 2>&1 || true
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
WEB_PORT=0
DB_PORT=0
APP_ENV=dev
APP_VERSION=${APP_VERSION:-smoke}
LOG_LEVEL=info
REGISTRY_PREFIX=${REGISTRY_PREFIX:-}
ENV

# Use the image built earlier instead of rebuilding.
docker tag "$IMAGE" sit-sizing-web:local
# The migrate service uses the tools stage; it shares the build cache with the image under test.
"${COMPOSE[@]}" build migrate
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 120 db web

WEB_PORT=$("${COMPOSE[@]}" port web 3000 | awk -F: '{print $NF}')
BASE="http://127.0.0.1:${WEB_PORT}"

curl -fsS "$BASE/api/v1/health" | tee /dev/stderr | grep -q '"status":"ok"'
curl -fsS "$BASE/api/v1/ready"  | tee /dev/stderr | grep -q '"status":"ready"'
curl -fsS -o /dev/null -D - "$BASE/" | grep -qi '^content-security-policy:'
curl -fsS -o /dev/null -D - "$BASE/api/v1/health" | grep -qi '^x-request-id:'

echo
echo "smoke test passed"
