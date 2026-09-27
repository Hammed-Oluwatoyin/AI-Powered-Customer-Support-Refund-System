# syntax=docker/dockerfile:1

# ---- Build: all dependencies, generated Prisma client, compiled TypeScript --
FROM node:24-alpine AS build
WORKDIR /app

# The Prisma schema is copied before `npm ci` because its postinstall step runs
# `prisma generate`.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

# ---- Production dependencies only (no Prisma CLI or other dev tooling) -------
FROM node:24-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
# --omit=optional drops the Prisma CLI, which npm otherwise installs as an
# optional peer of @prisma/client. Scripts are skipped because the generated
# client is already compiled into dist.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --omit=optional --ignore-scripts

# ---- Release: one-off migrate + seed step, run before the app starts --------
# Twelve-Factor V: the release step is separate from the run step. It reuses
# the build stage because it needs the Prisma CLI.
FROM build AS migrate
USER node
CMD ["npm", "run", "db:release"]

# ---- Runtime: production dependencies and compiled output only --------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3001}/api/health" || exit 1

CMD ["node", "dist/src/main.js"]
