# syntax=docker/dockerfile:1
# Tipping Point app — VPS image (L39). Build with bun (the repo's package
# manager and lockfile), run `next start` on Node (the runtime Vercel used).
# See docs/DEPLOY-VPS.md.
#
#   docker build -t tipping-point-app .
#   docker run -d --name tp-app -p 127.0.0.1:3000:3000 --env-file .env.production tipping-point-app

ARG BUN_VERSION=1.4.4
ARG NODE_VERSION=24

# --- deps: exact lockfile install ------------------------------------------
FROM docker.io/oven/bun:${BUN_VERSION} AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- build: next build (fonts are fetched from Google Fonts at build time) ---
FROM docker.io/oven/bun:${BUN_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* are inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_REFRESH_HOURS=
ENV NEXT_PUBLIC_REFRESH_HOURS=${NEXT_PUBLIC_REFRESH_HOURS} \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_REPO=/nonexistent
# prebuild (sync-data) finds no sibling data repo and keeps the committed
# public/data fallback copy, exactly as on Vercel.
RUN bun run build && rm -rf .next/cache

# --- runtime: Node, non-root ------------------------------------------------
FROM docker.io/library/node:${NODE_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
# db/schema.sql: read at runtime by the SQLite subscriber store (no DATABASE_URL).
COPY --from=build --chown=node:node /app/db ./db
# .next/cache: Next's on-disk server cache; .data: default SQLite file.
RUN mkdir -p .next/cache .data && chown -R node:node .next/cache .data
USER node
EXPOSE 3000
# /api/health answers 200 {"ok":true} while the server is up (liveness only).
HEALTHCHECK --interval=30s --timeout=20s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
