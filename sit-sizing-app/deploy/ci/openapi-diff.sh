#!/usr/bin/env bash
# Breaking-change check for the API contract (design 9.4): compares the committed
# docs/api/openapi.json with the one on the main branch. Fails on breaking changes
# unless the PR carries an approved ADR (label or override set by a code owner).
set -euo pipefail
BASE_REF="${BASE_REF:-origin/main}"
SPEC="docs/api/openapi.json"
REL="$(git rev-parse --show-prefix)${SPEC}"
mkdir -p reports/openapi
if ! git show "${BASE_REF}:${REL}" > reports/openapi/base.json 2>/dev/null; then
  echo "No ${SPEC} on ${BASE_REF} yet — nothing to compare."
  exit 0
fi
if [[ "${OPENAPI_BREAKING_APPROVED:-false}" == "true" ]]; then
  echo "Breaking changes approved for this build (OPENAPI_BREAKING_APPROVED=true); reporting only."
  FAIL_ON=""
else
  FAIL_ON="--fail-on ERR"
fi
docker run --rm -v "$PWD":/specs "${REGISTRY_PREFIX:-}tufin/oasdiff:${OASDIFF_TAG:-v1.35.0}" \
  breaking /specs/reports/openapi/base.json "/specs/${SPEC}" ${FAIL_ON}
