#!/usr/bin/env bash
# Runs a command inside the pinned Node image with the workspace mounted, so CI
# uses the same Node and pnpm as the Dockerfile. `--docker` also mounts the
# Docker socket (Testcontainers).
set -euo pipefail

DOCKER_ARGS=()
if [[ "${1:-}" == "--docker" ]]; then
  DOCKER_ARGS+=(-v /var/run/docker.sock:/var/run/docker.sock -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal --add-host=host.docker.internal:host-gateway)
  shift
fi

# Mount the whole Git repository (the engine parity check reads ../sit-sizing-reference)
# and work in the current folder.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Corporate TLS inspection on the agent: pass the CA bundle through if the agent has one.
if [[ -n "${NODE_EXTRA_CA_CERTS:-}" && -f "${NODE_EXTRA_CA_CERTS}" ]]; then
  DOCKER_ARGS+=(-v "${NODE_EXTRA_CA_CERTS}:/etc/sit-extra-ca.pem:ro" -e NODE_EXTRA_CA_CERTS=/etc/sit-extra-ca.pem)
fi

docker run --rm \
  -v "$ROOT":"$ROOT" -w "$PWD" \
  -v pnpm-store-ci:/pnpm/store \
  -e CI=true \
  -e npm_config_registry="${NPM_REGISTRY:-https://registry.npmjs.org/}" \
  -e COREPACK_NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}" \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e npm_config_store_dir=/pnpm/store \
  -u "$(id -u):$(id -g)" -e HOME=/tmp \
  "${DOCKER_ARGS[@]}" \
  "${NODE_IMAGE:-node:24-bookworm-slim}" \
  bash -c "corepack enable --install-directory /tmp/bin && export PATH=/tmp/bin:\$PATH && $1"
