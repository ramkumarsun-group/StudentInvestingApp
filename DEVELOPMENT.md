# StockPlay — Local Development Guide

## Prerequisites

Make sure the following are installed before you begin:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20.x | https://nodejs.org |
| pnpm | ≥ 9.x | `npm install -g pnpm@9` |
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |

Verify versions:
```bash
node -v      # v20.x.x
pnpm -v      # 9.x.x
docker -v    # Docker version 27.x.x
```

---

## 1. Install Dependencies

From the project root:
```bash
pnpm install
```

This installs dependencies for all workspaces (`apps/api`, `apps/web`, `packages/*`) in one shot via Turborepo.

---

## 2. Environment Variables

Copy the example env file and fill in values:
```bash
cp .env.example .env
```

The `.env` file lives at the **project root** and is shared across both apps.

### Required for core dev flow

These must be set to run the app at all:

```env
# Database & cache — no changes needed if using Docker below
DATABASE_URL=postgresql://postgres:password@localhost:5432/studentinvesting
REDIS_URL=redis://localhost:6379

# Auth secrets — change to any random string locally
JWT_SECRET=any-random-string-32-chars-minimum
JWT_REFRESH_SECRET=any-random-string-32-chars-minimum
NEXTAUTH_SECRET=any-random-string
NEXTAUTH_URL=http://localhost:3000
INTERNAL_API_SECRET=any-random-16-chars

# Ports
API_PORT=4000
API_URL=http://localhost:4000
WEB_URL=http://localhost:3000
NODE_ENV=development
```

### Optional (features degrade gracefully without these)

```env
# Google OAuth (login with Google)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Market data — app loads but prices/charts show empty
ALPACA_API_KEY=
ALPACA_API_SECRET=
COINGECKO_API_KEY=

# News headlines
NEWS_API_KEY=

# AI coach (Phase 3 only)
ANTHROPIC_API_KEY=

# Stripe billing (Phase 3 only)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STUDENT_PRO_PRICE_ID=

# Email
SENDGRID_API_KEY=
```

---

## 3. Start Infrastructure (Postgres + Redis)

The project ships a Docker Compose file that starts both services:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Verify they are healthy:
```bash
docker ps
# studentinvesting_postgres   Up (healthy)
# studentinvesting_redis       Up (healthy)
```

To stop infrastructure later:
```bash
docker compose -f infra/docker-compose.yml down
```

---

## 4. Run Database Migrations

Apply all SQL migrations to create the schema:
```bash
pnpm db:migrate
```

This runs `apps/api/src/db/migrate.ts` which applies any unapplied migration files in `apps/api/src/db/migrations/` in order.

---

## 5. Seed the Database

Populate lookup tables (levels, badges, learning modules):
```bash
pnpm db:seed
```

This seeds: XP levels, badge catalog, and the learning module/lesson library. Safe to re-run — seeds are idempotent.

---

## 6. Start the App

```bash
pnpm dev
```

Turborepo starts both apps in parallel:

| App               | URL                   | Description       |
| ----------------- | --------------------- | ----------------- |
| **Web** (Next.js) | http://localhost:3000 | Student-facing UI |
| **API** (Express) | http://localhost:4000 | REST API          |

The terminal uses Turborepo's TUI — you'll see logs for both `web` and `api` side by side. Press `q` to quit.

---

## 7. Verify It's Working

1. Open http://localhost:3000
2. Click **Register** — create an account with any email/password
3. You'll land on the Dashboard — portfolio starts at **$100,000 virtual cash**
4. Navigate to **Trade** — search works if Alpaca keys are set; without keys the quote section will be empty
5. Navigate to **Learn** — modules appear from the seed data

---

## 8. Testing on Mobile / Physical Device

StockPlay is mobile-first. Physical device testing on your local network requires no configuration changes — the app auto-detects the host from the browser's request.

### Find your Mac's local IP

```bash
ipconfig getifaddr en0
# e.g. 192.168.7.32
```

### Open on your phone

Make sure your phone and Mac are on the **same Wi-Fi network**, then open:

```
http://<your-mac-ip>:3000
# e.g. http://192.168.7.32:3000
```

> **How it works:** `NEXTAUTH_URL` is determined dynamically from the incoming request's `Host` header on every auth call. The `.env` value (`localhost:3000`) is only a fallback — no manual changes needed when switching between laptop and phone.

### Key flows to validate on mobile

| Flow | Path | What to check |
|------|------|---------------|
| Registration | `/register` | Form usability, keyboard behaviour, tap targets |
| Login | `/login` | Touch-friendly inputs, post-login redirect works |
| Dashboard | `/dashboard` | Portfolio value renders, bottom nav visible |
| Trade | `/trade` | Ticker search, buy/sell form on small screen |
| Learn | `/learn` | Module list scrolls, lesson text readable |
| Quiz | `/learn/[module]/[lesson]` | Answer tap targets ≥ 44px, XP toast fires |
| Leaderboard | `/leaderboard` | Table fits without horizontal scroll |
| Badges | `/badges` | Badge grid wraps correctly, share sheet opens |

### Simulate mobile in the browser (no phone needed)

1. Open http://localhost:3000
2. Press `F12` → click the **device toolbar** icon (or `Cmd+Shift+M` in Chrome)
3. Pick a preset: **iPhone 14 Pro** (390×844) or **Samsung Galaxy S21** (360×800)
4. Optionally throttle network to **Slow 3G** under the Network tab

### Troubleshooting mobile issues

**Blank page after login on phone (email/password)**
The app handles this automatically via dynamic `NEXTAUTH_URL` detection. If you still see a blank page, confirm your phone and Mac are on the same Wi-Fi segment and the URL in the browser matches the IP shown by `ipconfig getifaddr en0`.

**"Access Blocked / invalid_request" when using Login with Google on phone**
Google OAuth rejects private IP addresses (192.168.x.x) as redirect URIs. Email/password login works fine on mobile. To test Google OAuth on a physical device you need a public tunnel:
```bash
# Install ngrok (one-time)
brew install ngrok

# Start a tunnel to port 3000
ngrok http 3000
# Forwarding: https://abc123.ngrok-free.app -> localhost:3000
```
Then:
1. Add `https://abc123.ngrok-free.app/api/auth/callback/google` to your Google Cloud Console → OAuth 2.0 → Authorized redirect URIs
2. Set `NEXTAUTH_URL=https://abc123.ngrok-free.app` in `.env`
3. Restart `pnpm dev` and open the ngrok URL on your phone

**Touch targets feel too small**
Enable **Show paint flashing** in Chrome DevTools → Rendering tab to identify elements that repaint on tap. Minimum tap target is 44×44px (Apple HIG).

**iOS Safari: bottom content hidden behind home indicator**
The app uses `pb-[env(safe-area-inset-bottom)]` on the bottom nav and `pb-[calc(4rem+env(safe-area-inset-bottom))]` on the main content area. If content is still clipped, verify your iOS version supports CSS environment variables (iOS 11.2+).

**API calls fail on phone ("Network Error")**
Check the Next.js rewrite proxy is running. All client API calls go to `/api/backend/*` (same-origin), which Next.js proxies to `http://localhost:4000` on the server — the phone never talks to port 4000 directly.

---

## Common Commands

```bash
# Start everything
pnpm dev

# Run all tests (API + Web)
pnpm test

# Run web tests only
pnpm --filter web test

# Run API tests only
pnpm --filter api test

# Build for production
pnpm build

# Lint all packages
pnpm lint

# Re-run migrations (after pulling new migration files)
pnpm db:migrate

# Re-seed (safe to repeat)
pnpm db:seed

# Stop Docker services
docker compose -f infra/docker-compose.yml down

# Wipe database and start fresh
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed
```

---

## Project Structure

```
StudentInvestingApp/
├── apps/
│   ├── api/          # Express REST API (port 4000)
│   └── web/          # Next.js 14 frontend (port 3000)
├── packages/
│   ├── shared-types/ # Shared TypeScript types
│   └── shared-utils/ # Shared utility functions
├── infra/
│   └── docker-compose.yml   # Postgres + Redis
├── docs/             # PRD, architecture, stories
├── .env.example      # Environment variable template
├── package.json      # Root workspace (Turborepo)
└── pnpm-workspace.yaml
```

---

## Troubleshooting

**`pnpm install` fails with workspace errors**
```bash
# Make sure you're in the project root, not inside apps/
cd /path/to/StudentInvestingApp
pnpm install
```

**`db:migrate` fails — connection refused**
```bash
# Docker services aren't running
docker compose -f infra/docker-compose.yml up -d
# Wait a few seconds for Postgres to be ready, then retry
pnpm db:migrate
```

**`pnpm dev` — API starts but web shows blank page on laptop**
```bash
# NEXTAUTH_URL in .env must match the port Next.js is running on
NEXTAUTH_URL=http://localhost:3000
```

**`pnpm dev` — blank page after login on a phone / tablet**
```bash
# No .env change needed — NEXTAUTH_URL is detected automatically from the
# incoming request Host header. Just make sure your device is on the same
# Wi-Fi as your Mac and use your Mac's LAN IP, not localhost.
ipconfig getifaddr en0   # prints your Mac's IP, e.g. 192.168.7.32
# Then open http://192.168.7.32:3000 on your device
```

**Port already in use**
```bash
# Kill whatever is on port 3000 or 4000
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

**Want to reset everything and start fresh**
```bash
docker compose -f infra/docker-compose.yml down -v   # wipes DB volumes
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed
```

---

## 9. Running Tests

### Unit & Integration Tests (Vitest)

```bash
# Run all API unit tests
pnpm --filter api test

# Run all web unit/component tests
pnpm --filter web test

# Run both with watch mode
pnpm --filter api test -- --watch
pnpm --filter web test -- --watch
```

### E2E Tests (Playwright)

**Prerequisites:**
1. Start the DB and Redis:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
2. Create a test database:
   ```bash
   createdb studentinvesting_test   # or via psql
   ```
3. Copy and fill in the test env file:
   ```bash
   cp .env.test.example .env.test
   # Edit DATABASE_URL to point to studentinvesting_test
   ```
4. Run migrations on the test DB:
   ```bash
   DATABASE_URL=postgresql://postgres:password@localhost:5432/studentinvesting_test pnpm db:migrate
   ```

**Run E2E tests:**
```bash
# Run all tests (starts dev server automatically)
pnpm --filter web exec playwright test

# Run only P0 critical tests
pnpm --filter web exec playwright test --grep @P0

# Run specific test file
pnpm --filter web exec playwright test tests/e2e/auth.spec.ts

# Run with UI (interactive debugger)
pnpm --filter web exec playwright test --ui

# Run with 2 shards (mirrors CI)
pnpm --filter web exec playwright test --shard=1/2
pnpm --filter web exec playwright test --shard=2/2
```

**View test report:**
```bash
pnpm --filter web exec playwright show-report
```

### CI Pipeline

Every PR against `main` runs automatically via GitHub Actions (`.github/workflows/ci.yml`):

| Job | What it does | ~Time |
|-----|-------------|-------|
| `lint` | TypeScript type-check (api + web) | ~1 min |
| `test-api` | Vitest API tests with Postgres + Redis | ~2 min |
| `test-web` | Vitest web tests | ~1 min |
| `e2e (1/2)` | Playwright shard 1 | ~4 min |
| `e2e (2/2)` | Playwright shard 2 | ~4 min |

**Required GitHub secrets** (add in repo Settings → Secrets):
- `ALPACA_API_KEY`, `ALPACA_API_SECRET`
- `COINGECKO_API_KEY`
- `NEWS_API_KEY`

### Test Seed API

E2E tests use a test-only seed/teardown API (available only when `NODE_ENV=test`):

```bash
# Seed a test user
curl -X POST http://localhost:4000/api/v1/test/seed \
  -H "Content-Type: application/json" \
  -d '{"users":[{"email":"test@example.com","password":"Password123!"}]}'

# Tear down (cleans all user data)
curl -X DELETE http://localhost:4000/api/v1/test/teardown \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

> ⚠️ These endpoints return 404 in `development` and `production` — they are test-only.
