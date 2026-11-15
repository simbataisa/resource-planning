#!/usr/bin/env bash
# Security gates on every build (design 11 "Pipeline security"):
#   1. secret scan (gitleaks)          2. dependency vulnerabilities (pnpm audit)
#   3. licence policy                  4. container image scan (trivy), once per image
# Steps 1 to 3 cover the whole workspace (every app's production dependencies).
# The platform team may swap tools (for example to the bank's SAST/DAST suite);
# keep the gates, not necessarily the tools.
set -euo pipefail
[[ $# -ge 1 ]] || { echo "usage: security-scans.sh <image:tag> [<image:tag> ...]" >&2; exit 2; }
IMAGES=("$@")
OUT=reports/security
mkdir -p "$OUT"

if [[ "${SECURITY_SCANS:-on}" == "off" ]]; then
  echo "WARNING: SECURITY_SCANS=off — scans skipped. Never use this on main or release branches."
  exit 0
fi

echo "--- 1/4 secret scan"
gitleaks detect --source . --redact --report-format json --report-path "$OUT/gitleaks.json"

echo "--- 2/4 dependency audit (fail on high or critical)"
deploy/ci/in-node.sh "pnpm audit --audit-level=high --json > $OUT/pnpm-audit.json || (cat $OUT/pnpm-audit.json; exit 1)"

echo "--- 3/4 licence policy"
deploy/ci/in-node.sh "pnpm licenses:check"

echo "--- 4/4 image scan (fail on high or critical with a fix available)"
# Every image is scanned and reported before the step fails, so one run shows all findings.
# The first image keeps the report name trivy.json; the others get trivy-<name>.json.
failed=()
for i in "${!IMAGES[@]}"; do
  image="${IMAGES[$i]}"
  report="$OUT/trivy.json"
  if (( i > 0 )); then
    name="${image##*/}"
    report="$OUT/trivy-${name%%:*}.json"
  fi
  echo "    $image -> $report"
  trivy image --exit-code 1 --ignore-unfixed --severity HIGH,CRITICAL \
    --format json --output "$report" "$image" || failed+=("$image")
done
if (( ${#failed[@]} )); then
  echo "image scan failed for: ${failed[*]}" >&2
  exit 1
fi

echo "security scans passed"
