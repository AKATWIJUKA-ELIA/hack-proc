# Quotebook

A procurement agent. State a need in plain language; Quotebook finds suppliers,
emails them for real quotes, reads the replies, and shows a live comparison
board.

> 50 × Dell Latitude 5550, i7/16GB/512GB, delivered to Kampala within 14 days,
> budget UGX 180,000,000

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 (App Router, React 19) |
| UI | Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| Backend | Convex — database, queries/mutations/actions, scheduling, workflows |
| Supplier discovery | Firecrawl (`@firecrawl/firecrawl-convex`) |
| Extraction & parsing | OpenAI structured outputs |
| Email | AgentMail (`@agentmail/convex`) |
| Durability | `@convex-dev/workflow` |
| Auth | Custom email + password, PBKDF2, session cookies |

## Running it with Docker

The backend already runs on Convex Cloud, so the image is just the frontend —
no database to provision, nothing to configure.

The Dockerfile clones the source itself, so it is the only file you need. Save
it anywhere and run:

```bash
docker build -t quotebook .
docker run -p 3000:3000 quotebook
```

Open http://localhost:3000 and create an account. Or with compose:

```bash
docker compose up --build
```

### Pointing it at your own Convex deployment

`NEXT_PUBLIC_CONVEX_URL` is substituted into the JavaScript bundle during
`next build`, so it is a **build** argument, not a runtime one — setting it at
`docker run` is too late.

```bash
docker build --build-arg NEXT_PUBLIC_CONVEX_URL=https://<yours>.convex.cloud -t quotebook .
```

Use the `.convex.cloud` host; `.convex.site` serves only the webhooks. The
build refuses a `.convex.site` URL rather than producing an image that cannot
reach its backend.

### Rebuilding after a push

The clone layer is cached, so a plain rebuild reuses the old source:

```bash
docker build --build-arg CACHE_BUST=$(date +%s) -t quotebook .
```

Other build args: `GIT_REPO` and `GIT_REF` to build a fork or pinned revision.

### Note on build-time network access

`next/font/google` downloads Inter and JetBrains Mono during the build, so the
build needs to reach `fonts.googleapis.com` alongside npm and GitHub. On a
network that blocks it, the build fails with
``Failed to fetch `JetBrains Mono` from Google Fonts``. Vendoring the fonts
with `next/font/local` would remove that dependency.

## Running it locally

```bash
npm install

# Terminal 1 — backend (watches convex/, regenerates types)
npm run dev:backend

# Terminal 2 — frontend
npm run dev
```

Then open http://localhost:3000 and create an account.

### Environment

`.env.local` (see `.env.example`):

```
NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
CONVEX_DEPLOYMENT=<set by `npx convex dev`>
```

Use the `.convex.cloud` host — `.convex.site` serves only HTTP actions
(the webhooks) and has no query endpoint.

Backend secrets live in the Convex deployment, never in the repo:

```bash
npx convex env set OPENAI_API_KEY sk-...
npx convex env set FIRECRAWL_API_KEY fc-...
npx convex env set AGENTMAIL_API_KEY ...
npx convex env set AGENTMAIL_WEBHOOK_SECRET whsec_...
npx convex env set AGENTMAIL_INBOX_ID ...   # optional, reuse one warmed inbox
```

## How it works

```
Request (free text)
  └─ intake.extractSpec        OpenAI → structured line items, budget, window
       └─ discovery workflow   Firecrawl search → scrape → extract → verify MX
            └─ writes suppliers, contacts, crawled quotes, RFQ drafts
                 └─ SEND GATE  ← the one human checkpoint, max 5 recipients
                      └─ rfqs.sendApproved   AgentMail
                           └─ /agentmail/webhook → inbound.parseMessage
                                └─ emailed quote supersedes the crawled row
                                     └─ recommendations.compute
```

### Two quote tracks

The board merges two sources and never confuses them:

- **Web price** — scraped from a supplier's site. Indicative, `confidence: low`.
- **Confirmed** — from the supplier's own emailed reply. `confidence: high`.

A confirmed quote *supersedes* the crawled row for that supplier rather than
overwriting it, so the board upgrades in front of the viewer and the audit
trail keeps both.

### The send gate

`rfqs` status is a state machine: `sent` is unreachable except through
`approved`, and only `approveAndSend` — a human-invoked mutation — writes that.
The five-recipient cap lives in the mutation, not the UI, so it cannot be
clicked around.

### Money

Never a float. Every amount is an integer count of minor units with its
currency, and any USD normalisation stores the FX rate and timestamp that
produced it, so a quote cannot silently change value when the shilling moves.

## Authentication

Custom, self-contained — no external identity provider.

- **Passwords**: PBKDF2-HMAC-SHA256, 210,000 iterations, per-user random salt.
  The iteration count is stored with the hash, so it can be raised later
  without locking anyone out.
- **Sessions**: 256-bit random tokens, stored **hashed** (SHA-256) so the
  `sessions` table cannot be used to impersonate anyone. 30-day expiry, swept
  nightly by a cron.
- **Transport**: the token lives in an httpOnly, SameSite=Lax cookie written by
  `/api/auth/session`. Page scripts cannot read it.
- **Authorization**: every public Convex function takes the session token and
  resolves it server-side. `requireOwnedRequest` gates all request-scoped data.
  "Not found" and "not yours" return the same message, so request ids cannot be
  probed.

`src/middleware.ts` redirects on cookie *presence* only — it is a convenience,
not the boundary. The backend is the boundary. It must live under `src/`
(this project has a `src` directory) and must not import from `@/lib/*`: the
Edge runtime forbids code generation from strings, and pulling in that
dependency graph makes every request 500.

## Appearance

Light, dark, and system, from the account menu at the bottom of the sidebar.
The choice is stored in `localStorage` and applied by an inline script in
`<head>` before first paint, so there is no white flash on navigation. With
"System" selected the app follows `prefers-color-scheme`.

## Deploying

**Backend:**

```bash
npx convex deploy
```

**Frontend** (Vercel or any Node host):

```bash
npm run build && npm start
```

Set `NEXT_PUBLIC_CONVEX_URL` in the host's environment to the production
deployment's `.convex.cloud` URL.

The Convex deployment no longer serves HTML. Its HTTP surface is exactly two
webhooks, at unchanged URLs:

- `POST https://<deployment>.convex.site/agentmail/webhook`
- `POST https://<deployment>.convex.site/firecrawl/webhook`

## Checks

```bash
npm run typecheck   # app + convex, both strict
npm run build
```
