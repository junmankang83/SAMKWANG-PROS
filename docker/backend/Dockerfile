# syntax=docker/dockerfile:1.7

# ---------- base ----------
FROM node:22-alpine AS base
RUN apk add --no-cache openssl tini libc6-compat
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /repo

# ---------- build ----------
FROM base AS build
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

RUN pnpm install --filter @samkwang/backend... --no-frozen-lockfile

COPY packages/shared ./packages/shared
COPY backend ./backend

RUN pnpm --filter @samkwang/shared build

WORKDIR /repo/backend
RUN pnpm prisma generate
RUN pnpm build

# ---------- runtime ----------
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/tsconfig.base.json ./
COPY --from=build /repo/packages/shared/package.json ./packages/shared/
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/backend/package.json ./backend/
COPY --from=build /repo/backend/dist ./backend/dist
COPY --from=build /repo/backend/prisma ./backend/prisma

RUN pnpm install --filter @samkwang/backend --prod --no-frozen-lockfile

WORKDIR /app/backend
RUN pnpm prisma generate

EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "pnpm prisma migrate deploy 2>/dev/null || true; node dist/main.js"]
