# syntax=docker/dockerfile:1.7
# SIT Sizing images (design 12.1). Build from the repository root, for example:
#   docker build -f docker/Dockerfile --target runner .
# Stages: deps → dev | workspace → tools (migrate, seed, worker) | build → runner (web)
#         | mcp-build → mcp (MCP server).
#
# REGISTRY_PREFIX  internal registry prefix, e.g. "nexus.example.internal/docker-proxy/" (trailing slash). Empty = Docker Hub.
# NPM_REGISTRY     npm proxy URL (Nexus). Used by pnpm and corepack.
#
# Corporate TLS inspection: put the organisation's root CA certificates (PEM, *.pem or *.crt)
# in docker/certs/ (git-ignored). They are trusted by Node in every stage through
# NODE_EXTRA_CA_CERTS. `pnpm dev:env` exports them automatically on macOS.
ARG REGISTRY_PREFIX=""
ARG NODE_IMAGE="node:24-bookworm-slim"

# ---------------------------------------------------------------------------
FROM ${REGISTRY_PREFIX}${NODE_IMAGE} AS base
ARG NPM_REGISTRY="https://registry.npmjs.org/"
ARG PRISMA_ENGINES_MIRROR=""
COPY docker/certs/ /usr/local/share/sit-certs/
RUN cat /usr/local/share/sit-certs/*.pem /usr/local/share/sit-certs/*.crt > /usr/local/share/sit-certs/bundle.pem 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/sit-certs/bundle.pem \
    PNPM_HOME=/pnpm \
    PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR} \
    PATH=/pnpm:$PATH \
    npm_config_registry=${NPM_REGISTRY} \
    COREPACK_NPM_REGISTRY=${NPM_REGISTRY} \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# ---------------------------------------------------------------------------
# Dependency download only depends on the lockfile, so this layer is cached
# until pnpm-lock.yaml changes.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store

# ---------------------------------------------------------------------------
# Development image: compose.dev.yaml bind-mounts the repository over /repo.
FROM deps AS dev
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --store-dir /pnpm/store
EXPOSE 3000
CMD ["pnpm", "--filter", "@sit/web", "dev", "--hostname", "0.0.0.0", "--port", "3000"]

# ---------------------------------------------------------------------------
# Source and installed dependencies, without the Next.js build.
FROM deps AS workspace
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --store-dir /pnpm/store

# ---------------------------------------------------------------------------
FROM workspace AS build
ARG APP_VERSION="0.0.0-dev"
ENV APP_VERSION=${APP_VERSION} NODE_ENV=production
RUN pnpm --filter @sit/web build

# ---------------------------------------------------------------------------
# Tasks that need the workspace but not the Next.js build: database migrations and
# the synthetic seed (design 12.1: migrations run as a separate step, never at app
# start) and the notification worker (N-01, run with tsx). Building it never runs
# `next build`, so it can be built next to the web image without doubling memory.
FROM workspace AS tools
CMD ["pnpm", "db:migrate"]

# ---------------------------------------------------------------------------
# MCP server (ADR-0016): `pnpm deploy` copies apps/mcp with only its production
# dependencies (the workspace packages @sit/engine and @sit/schemas injected as copies),
# offline from the fetched store and pinned by the lockfile. No web app, no database
# client, no dev tools; run with tsx (no build). Scripts are skipped (none are needed).
# Tests, the glossary build script (it reads apps/web) and test configs are left out.
FROM deps AS mcp-build
COPY packages/config/ packages/config/
COPY packages/schemas/ packages/schemas/
COPY packages/engine/ packages/engine/
COPY apps/mcp/ apps/mcp/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @sit/mcp deploy --prod --offline --ignore-scripts \
      --config.inject-workspace-packages=true --store-dir /pnpm/store /out \
 && rm -rf /out/tests /out/scripts /out/vitest.config.ts /out/vitest.e2e.config.ts

# Runtime: non-root, files owned by root (read-only for the server). Run with a read-only
# root filesystem and a tmpfs on /tmp, where tsx keeps its compile cache (see compose.yaml).
FROM ${REGISTRY_PREFIX}${NODE_IMAGE} AS mcp
ARG APP_VERSION="0.0.0-dev"
LABEL org.opencontainers.image.title="sit-sizing-mcp" \
      org.opencontainers.image.version="${APP_VERSION}"
COPY --from=base /usr/local/share/sit-certs/bundle.pem /usr/local/share/sit-certs/bundle.pem
ENV NODE_ENV=production \
    NODE_EXTRA_CA_CERTS=/usr/local/share/sit-certs/bundle.pem \
    MCP_PORT=3100 \
    APP_VERSION=${APP_VERSION}
COPY --from=mcp-build /out /app
WORKDIR /app
USER node
EXPOSE 3100
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3100/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node_modules/.bin/tsx", "src/main.ts"]

# ---------------------------------------------------------------------------
# Runtime: slim base, non-root user, files owned by root (read-only for the app),
# Next.js standalone output. Run with a read-only root filesystem (see compose.yaml).
FROM ${REGISTRY_PREFIX}${NODE_IMAGE} AS runner
ARG APP_VERSION="0.0.0-dev"
LABEL org.opencontainers.image.title="sit-sizing-web" \
      org.opencontainers.image.version="${APP_VERSION}"
COPY --from=base /usr/local/share/sit-certs/bundle.pem /usr/local/share/sit-certs/bundle.pem
ENV NODE_ENV=production \
    NODE_EXTRA_CA_CERTS=/usr/local/share/sit-certs/bundle.pem \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
