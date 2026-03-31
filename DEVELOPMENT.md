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

| App | URL | Description |
|-----|-----|-------------|
| **Web** (Next.js) | http://localhost:3000 | Student-facing UI |
| **API** (Express) | http://localhost:4000 | REST API |

The terminal uses Turborepo's TUI — you'll see logs for both `web` and `api` side by side. Press `q` to quit.

---

## 7. Verify It's Working

1. Open http://localhost:3000
2. Click **Register** — create an account with any email/password
3. You'll land on the Dashboard — portfolio starts at **$100,000 virtual cash**
4. Navigate to **Trade** — search works if Alpaca keys are set; without keys the quote section will be empty
5. Navigate to **Learn** — modules appear from the seed data

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

**`pnpm dev` — API starts but web shows blank page**
```bash
# NEXTAUTH_URL must match the port Next.js is running on
NEXTAUTH_URL=http://localhost:3000
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
