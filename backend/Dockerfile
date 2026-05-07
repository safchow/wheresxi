# syntax=docker/dockerfile:1.7

# ─── deps + build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable
RUN apk add --no-cache python3 make g++
WORKDIR /repo

# Copy lockfile + workspace manifests first so the install layer caches
# until any of them change. backend/prisma is needed for backend's
# postinstall script (prisma generate).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY backend/prisma backend/prisma

RUN pnpm install --frozen-lockfile --filter backend

COPY backend/ backend/
RUN pnpm --filter backend exec node ace build --ignore-ts-errors=false

# ─── production deps ──────────────────────────────────────────────────────
FROM node:22-alpine AS prod-deps
RUN corepack enable
RUN apk add --no-cache python3 make g++
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY backend/prisma backend/prisma

RUN pnpm install --frozen-lockfile --filter backend --prod

# ─── runtime ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    LOG_LEVEL=info

# Reproduce the pnpm workspace layout so symlinks under backend/node_modules
# resolve back into the root .pnpm store. Both directories are required.
COPY --from=prod-deps /repo/node_modules /app/node_modules
COPY --from=prod-deps /repo/backend/node_modules /app/backend/node_modules
COPY --from=prod-deps /repo/backend/package.json /app/backend/package.json
COPY --from=prod-deps /repo/backend/prisma /app/backend/prisma
COPY --from=build /repo/backend/build /app/backend/build

WORKDIR /app/backend/build

# Run migrations on startup, then boot the server.
CMD ["sh", "-c", "../node_modules/.bin/prisma migrate deploy --schema=../prisma/schema.prisma && node bin/server.js"]

EXPOSE 3333
