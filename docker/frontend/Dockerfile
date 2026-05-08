# syntax=docker/dockerfile:1.7

# ---------- base ----------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /repo

# ---------- build ----------
FROM base AS build
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/

RUN pnpm install --filter @samkwang/frontend... --no-frozen-lockfile

COPY packages/shared ./packages/shared
COPY frontend ./frontend

RUN pnpm --filter @samkwang/shared build

WORKDIR /repo/frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output (monorepo: frontend/.next/standalone/{frontend,packages,node_modules})
COPY --from=build /repo/frontend/.next/standalone ./
COPY --from=build /repo/frontend/.next/static ./frontend/.next/static
COPY --from=build /repo/frontend/public ./frontend/public

EXPOSE 3000
CMD ["node", "frontend/server.js"]
