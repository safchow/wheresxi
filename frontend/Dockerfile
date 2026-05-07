# syntax=docker/dockerfile:1.7

# ─── build ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Copy the lockfile + every workspace manifest first so pnpm can validate
# the lockfile and the install layer caches until any of these change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/

# --filter frontend scopes installation to the frontend package only;
# backend's postinstall (prisma generate) is skipped on this build.
RUN pnpm install --frozen-lockfile --filter frontend

COPY frontend/ frontend/
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm --filter frontend build

# ─── runtime ──────────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime
# Default for local `docker run`. Railway overrides this with its own PORT.
ENV PORT=80
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
# Drop the config into nginx's templates dir — the official image's
# entrypoint envsubsts these into /etc/nginx/conf.d/ at startup, so
# `listen ${PORT}` resolves to whatever PORT is set in the environment.
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
