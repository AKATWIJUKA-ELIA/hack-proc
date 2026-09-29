# Quotebook frontend. The backend runs on Convex Cloud, so this image is the
# Next.js app alone and clones its own source:
#
#   docker build -t quotebook .
#   docker run -p 3000:3000 quotebook

FROM node:22-alpine

RUN apk add --no-cache git

ARG GIT_REPO=https://github.com/AKATWIJUKA-ELIA/hack-proc.git
ARG GIT_REF=trunk

# The clone layer is cached, so a rebuild after a push reuses stale source
# without this: docker build --build-arg CACHE_BUST=$(date +%s) .
ARG CACHE_BUST=0
RUN echo "cache bust: $CACHE_BUST"

RUN git clone --depth 1 --branch "$GIT_REF" "$GIT_REPO" /app
WORKDIR /app

RUN npm ci

# Next substitutes NEXT_PUBLIC_* into the bundle during `next build`, so this
# must be a build argument — a value passed to `docker run` arrives too late.
ARG NEXT_PUBLIC_CONVEX_URL=https://admired-partridge-220.convex.cloud
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL

# .convex.site serves only webhooks, so it would build an app that cannot reach
# its backend. Fail now, not at first page load.
RUN case "$NEXT_PUBLIC_CONVEX_URL" in \
      "" ) echo "ERROR: NEXT_PUBLIC_CONVEX_URL is empty." >&2; exit 1;; \
      *.convex.site* ) echo "ERROR: use the .convex.cloud host." >&2; exit 1;; \
    esac

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# output: "standalone" does not copy static assets into the standalone tree,
# so without this every page loads unstyled.
RUN cp -r .next/static .next/standalone/.next/static \
 && cp -r public .next/standalone/public

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs \
 && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000
# Next binds 127.0.0.1 by default, which -p 3000:3000 cannot reach.
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/sign-in').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Not `next start`, which refuses to serve a standalone build.
CMD ["node", ".next/standalone/server.js"]
