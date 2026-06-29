# syntax=docker/dockerfile:1

# ---- build stage: compile native deps + build client & server ----
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Toolchain for better-sqlite3's native build.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app
# Install deps first (cached unless manifests change).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN pnpm install --frozen-lockfile

# Build both packages.
COPY . .
RUN pnpm --filter client build \
  && pnpm --filter server build

# ---- runtime stage: no toolchain, just node + built artifacts ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV DB_PATH=/data/focusarc.db
WORKDIR /app

# Built server + its compiled node_modules (native binaries already built above).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/assets ./server/assets
# Built frontend (served by Express).
COPY --from=build /app/client/dist ./client/dist

# The DB lives on a mounted volume.
RUN mkdir -p /data
VOLUME /data

EXPOSE 4000
CMD ["node", "server/dist/index.js"]
