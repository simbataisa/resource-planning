# syntax=docker/dockerfile:1.7
# SIT Sizing web image (design 12.1). Stages: base → deps → dev | build → runner.
# Build from the repository root:  docker build -f docker/Dockerfile --target runner .
# Stages: deps → dev | build → tools (migrate, seed) | runner (web).
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
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --store-dir /pnpm/store
ARG APP_VERSION="0.0.0-dev"
ENV APP_VERSION=${APP_VERSION} NODE_ENV=production
RUN pnpm --filter @sit/web build

# ---------------------------------------------------------------------------
# One-shot tasks: database migrations and the synthetic seed (design 12.1:
# migrations run as a separate step, never at app start).
FROM build AS tools
CMD ["pnpm", "db:migrate"]

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
