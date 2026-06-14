# syntax=docker.io/docker/dockerfile:1

FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# lib/db/client.ts throws at import when DATABASE_URL is unset. `next build`
# only needs the route modules to load (they're dynamic — no query runs at
# build), so give it a placeholder. Stays in this stage; the runner gets the
# real value from the container env at runtime.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

# Matching defaults: fuzzy-only, no embedding provider. Override at runtime
# (-e MATCHING_MODE=both -e EMBEDDING_SOURCE=transformers) to enable vector
# matching. Transformers downloads ~280MB to ~/.cache/huggingface on first
# request — mount a volume there to persist across container restarts.
ENV MATCHING_MODE=fuzzy
ENV EMBEDDING_SOURCE=off

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# --- Garmin sync (Python garminconnect via subprocess; see docs/agenda-integration.md) ---
# curl_cffi (garminconnect's TLS dep) is native. On Alpine/musl pip may build it
# from source, so build deps go in a virtual package that's removed afterwards;
# libstdc++ stays for the runtime wheel. If a working curl_cffi can't be produced
# here, switch this stage's base to node:22-bookworm-slim (glibc), where prebuilt
# wheels are reliable.
RUN apk add --no-cache python3 libstdc++ \
 && apk add --no-cache --virtual .py-build py3-pip gcc musl-dev libffi-dev \
 && python3 -m venv /opt/garmin-venv \
 && /opt/garmin-venv/bin/pip install --no-cache-dir "garminconnect==0.3.6" \
 && apk del .py-build
ENV GARMIN_PYTHON=/opt/garmin-venv/bin/python3

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts/garmin ./scripts/garmin

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# --- Migrate-on-start ---
# The standalone trace omits the migrator submodule + drizzle-kit (devDep), so
# ship the migration SQL, the runtime migrator, and the full drizzle-orm package
# (overlays the pruned copy with the migrator subpath). migrate-runtime.mjs runs
# before server.js on every boot — idempotent, applies pending migrations to the
# persistent DB volume. See docs / docker-compose for the deploy.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate-runtime.mjs ./scripts/migrate-runtime.mjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
# Apply pending migrations, then hand off to the server (exec → clean signals).
CMD ["sh", "-c", "node scripts/migrate-runtime.mjs && exec node server.js"]

