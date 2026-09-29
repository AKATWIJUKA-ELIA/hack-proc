# Quotebook — frontend only.
#
# The backend (database, functions, workflows, supplier discovery, email)
# already runs on Convex Cloud. This image is just the Next.js app that talks
# to it, so there is nothing to provision and no database to start.
#
# This Dockerfile clones the source itself, which means it is the only file you
# need. Save it anywhere and run:
#
#   docker build -t quotebook .
#   docker run -p 3000:3000 quotebook
#
# Then open http://localhost:3000 and create an account.
#
# ---------------------------------------------------------------------------
# Why the Convex URL is a build argument
#
# `NEXT_PUBLIC_*` values are substituted into the JavaScript bundle during
# `next build` — they are not read from the environment when the server starts.
# Passing one at `docker run` would arrive too late: the bundle would already
# contain `undefined` and the app would show its "backend not configured"
# notice. So it is baked in below, defaulted to the deployment this project
# ships against.
#
# To point the image at a different Convex deployment:
#
#   docker build --build-arg NEXT_PUBLIC_CONVEX_URL=https://<yours>.convex.cloud -t quotebook .
#
# Use the `.convex.cloud` host. `.convex.site` serves only HTTP actions (the
# AgentMail and Firecrawl webhooks) and has no query endpoint.
# ---------------------------------------------------------------------------

FROM node:22-alpine

# git is needed for the clone below and nowhere else. `--no-cache` avoids
# leaving an apk index in the layer.
RUN apk add --no-cache git

# Which source to build. Override any of these to build a fork or a pinned
# revision:
#   docker build --build-arg GIT_REF=v1.0.0 -t quotebook .
ARG GIT_REPO=https://github.com/AKATWIJUKA-ELIA/hack-proc.git
ARG GIT_REF=trunk

# Busts the Docker cache when the branch moves. Without it, a rebuild would
# reuse the cached clone layer and silently build stale code:
#   docker build --build-arg CACHE_BUST=$(date +%s) -t quotebook .
ARG CACHE_BUST=0
RUN echo "cache bust: $CACHE_BUST"

# --depth 1 keeps the image from carrying the repository's history.
RUN git clone --depth 1 --branch "$GIT_REF" "$GIT_REPO" /app

WORKDIR /app

# `npm ci` installs exactly what package-lock.json pins, so this build is
# reproducible rather than "whatever resolved today".
RUN npm ci

ARG NEXT_PUBLIC_CONVEX_URL=https://admired-partridge-220.convex.cloud
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL

# Fail at build time rather than shipping an image whose bundle points at
# nothing — a wrong host here is invisible until someone opens the app.
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
ENV NODE_ENV=production

RUN npm run build

# Never run the server as root: a process that only reads its own bundle and
# answers HTTP has no business owning the filesystem.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs \
 && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000
# Without this Next binds 127.0.0.1 inside the container, and `-p 3000:3000`
# would map to a port nothing outside the container can reach.
ENV HOSTNAME=0.0.0.0

# /sign-in is the right probe target: it is reachable without a session, so it
# stays 200 whether or not anyone is signed in.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/sign-in').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
