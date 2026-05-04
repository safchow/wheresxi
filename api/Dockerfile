# syntax=docker/dockerfile:1.7

# ─── deps ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN apk add --no-cache python3 make g++ \
 && npm ci

# ─── build ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
 && node ace build --ignore-ts-errors=false

# ─── production deps ──────────────────────────────────────────────────────
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN apk add --no-cache python3 make g++ \
 && npm ci --omit=dev \
 && npx prisma generate

# ─── runtime ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    LOG_LEVEL=info

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./
COPY package.json ./
COPY prisma ./prisma

# Run migrations on startup, then boot the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node bin/server.js"]

EXPOSE 3333
