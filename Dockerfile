# Quotebook — frontend only.
#
# The backend (database, functions, workflows, email) already runs on Convex
# Cloud, so this image contains just the Next.js app. Nothing to provision:
#
#   docker build -t quotebook .
#   docker run -p 3000:3000 quotebook
#
# Then open http://localhost:3000 and create an account.
#
# ---------------------------------------------------------------------------
# Why the Convex URL is a build argument and not just an env var
#
# `NEXT_PUBLIC_*` values are substituted into the JavaScript bundle during
# `next build`, not read from the environment when the server starts. Passing
# one only at `docker run` would arrive far too late — the bundle would already
# contain `undefined` and the app would render its "backend not configured"
# notice.
#
# So it is baked in here, defaulted to the deployment this project ships
# against. To point the image at a different Convex deployment, rebuild with:
#
#   docker build --build-arg NEXT_PUBLIC_CONVEX_URL=https://<yours>.convex.cloud -t quotebook .
#
# Use the `.convex.cloud` host. `.convex.site` serves only HTTP actions (the
# AgentMail and Firecrawl webhooks) and has no query endpoint, so the app would
# connect to nothing.
# ---------------------------------------------------------------------------

# Pinned to a digest-stable minor. Alpine keeps the final image small; Next's
# standalone output has no native dependencies that need glibc.
FROM node:22-alpine AS base

# --- deps -------------------------------------------------------------------
# Isolated so that a source-only change reuses the cached npm install.
FROM base AS deps
WORKDIR /app

# Only the manifests, for the same reason: editing a component must not
# invalidate this layer.
COPY package.json package-lock.json ./

# `npm ci` installs exactly the lockfile, which is what makes someone else's
# build byte-identical to this one.
RUN npm ci

# --- builder ----------------------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_CONVEX_URL=https://admired-partridge-220.convex.cloud
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL

# Fail loudly at build time rather than shipping an image whose bundle points
# at nothing. A wrong host here is invisible until a user opens the app.
RUN if [ -z "$NEXT_PUBLIC_CONVEX_URL" ]; then \
      echo "ERROR: NEXT_PUBLIC_CONVEX_URL is empty; the bundle would have no backend." >&2; \
      exit 1; \
    fi; \
    case "$NEXT_PUBLIC_CONVEX_URL" in \
      *.convex.site*) \
        echo "ERROR: NEXT_PUBLIC_CONVEX_URL points at .convex.site, which serves only" >&2; \
        echo "       webhooks. Use the .convex.cloud host instead." >&2; \
        exit 1;; \
    esac

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runner -----------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Never run the server as root: a process that only needs to read its own
# bundle and answer HTTP has no business owning the filesystem.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Three paths are all the standalone output needs. `public` is copied only if
# it exists — this project has none, and a missing source would fail the build.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
# Without this the server binds 127.0.0.1 inside the container, and `-p 3000:3000`
# would map to a port nothing outside the container can reach.
ENV HOSTNAME=0.0.0.0

# Reports unhealthy if the app stops answering. /sign-in is the right target:
# it is reachable without a session, so it stays 200 whether or not anyone is
# signed in.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/sign-in').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
