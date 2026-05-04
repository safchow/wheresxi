# syntax=docker/dockerfile:1.7

# ─── build ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# ─── runtime ──────────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime
# Default for local `docker run`. Railway overrides this with its own PORT.
ENV PORT=80
COPY --from=build /app/dist /usr/share/nginx/html
# Drop the config into nginx's templates dir — the official image's
# entrypoint envsubsts these into /etc/nginx/conf.d/ at startup, so
# `listen ${PORT}` resolves to whatever PORT is set in the environment.
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
