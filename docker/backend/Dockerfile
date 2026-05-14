# syntax=docker/dockerfile:1.7

# ---------- base ----------
FROM node:22-alpine AS base
RUN apk add --no-cache openssl tini libc6-compat
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /repo

# ---------- build ----------
FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY backend ./backend
COPY frontend ./frontend

RUN rm -f packages/shared/tsconfig.tsbuildinfo packages/shared/ts-out/.tsbuildinfo

RUN pnpm install --no-frozen-lockfile

RUN pnpm --filter @samkwang/shared build

WORKDIR /repo/backend
RUN pnpm prisma generate
RUN pnpm build

# ---------- runtime ----------
FROM base AS runtime
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/pnpm-lock.yaml /repo/tsconfig.base.json ./
COPY --from=build /repo/packages/shared/package.json ./packages/shared/
COPY --from=build /repo/packages/shared/ts-out ./packages/shared/ts-out
COPY --from=build /repo/backend/package.json ./backend/
COPY --from=build /repo/backend/dist ./backend/dist
COPY --from=build /repo/backend/prisma ./backend/prisma
COPY --from=build /repo/frontend/package.json ./frontend/package.json

RUN pnpm install --filter @samkwang/backend --prod --no-frozen-lockfile

WORKDIR /app/backend
RUN pnpm dlx prisma@6.19.3 generate

EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "pnpm dlx prisma@6.19.3 migrate deploy 2>/dev/null || true; node dist/main.js"]
