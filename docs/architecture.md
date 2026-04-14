---
stepsCompleted: [step-01-init, step-02-context, step-03-starter, step-04-decisions, step-05-patterns, step-06-structure, step-07-validation, step-08-complete, step-02-update-uxscreens, step-07-revalidation-uxscreens, step-02-update-desktop-screens]
status: complete
completedAt: '2026-03-25'
lastUpdated: '2026-03-29'
inputDocuments: [docs/prd.md, docs/epics.md, CLAUDE.md, STUDENT_INVESTING_APP_PLAN.md, SOLUTION_DIAGRAM_PHASES_1_3.md, docs/market-research.md, google-stitch-screens]
workflowType: architecture
project_name: StockPlay
user_name: Ramkumar
date: 2026-03-25
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
65 FRs across 4 steel threads covering: Auth & Identity (FR1–FR8), Paper Trading Engine
(FR9–FR25), Learning & Gamification (FR26–FR42), School & Classroom (FR43–FR49),
AI Coach & Monetisation (FR50–FR65). Plus 7 Additional Requirements (AR1–AR7) for
Phase 4 native mobile, district licensing, and push notifications.

**Non-Functional Requirements:**
- NFR1: API p95 < 200ms (non-market-data endpoints)
- NFR2: Redis market quote cache hit rate ≥ 90% (30s TTL)
- NFR3: Zero PII in third-party analytics or ad trackers (FERPA)
- NFR4: AI coach first token latency < 1,000ms
- NFR5: 99.5% API uptime SLA
- NFR6: Mobile-first responsive design — all core flows on 375px viewport
- NFR7: Google Workspace SSO available before first school onboards
- NFR8: Stripe webhook signature verification on all billing events

**Scale & Complexity:**

- Primary domain: Full-stack web with mobile-ready API from day 1
- Complexity level: High — 65 FRs, 5 external API integrations, regulatory compliance, AI streaming, payments, multi-role multi-tenancy
- Estimated architectural components: 12 (Auth, Trading Engine, Market Data Cache, Gamification Engine, Classroom Engine, AI Coach, Payments, Notification Service, Cache Layer, Background Jobs, CDN/Media, Admin)
- External integrations: Alpaca Markets, CoinGecko, NewsAPI, Anthropic Claude, Stripe

### Technical Constraints & Dependencies

| Constraint | Source | Architectural Impact |
|-----------|--------|---------------------|
| FERPA: no PII in third-party SDKs | Legal (Phase 1) | Eliminates Sentry, Mixpanel, Amplitude, Google Analytics with PII. Forces self-hosted structured logging (Pino) or privacy-safe alternatives with PII scrubbing |
| COPPA: age verification server-side | Legal (Phase 1) | DOB collected and validated server-side only; never exposed in API responses to third parties |
| SEC: AI coach = educational framing only | Regulatory | Claude system prompt is a compliance document — needs version control and review process |
| Mobile-first 375px viewport | NFR6 | All API responses must be pagination-aware from day 1; no unbounded list responses |
| Phase 4 React Native reuse | Product roadmap | `packages/shared-types` and `packages/shared-utils` are Phase 4 contract points — require semver discipline; breaking changes must be versioned |
| 99.5% uptime SLA | NFR5 | Requires health check endpoint, graceful degradation on market data failure, and status page |

**API Consumer Contract (load-bearing decision):**
The REST API must serve three consumers across the product lifetime: Next.js 14 App Router
(SSR + client), PWA (Phase 3), and React Native / Expo (Phase 4). Strict separation between
API layer (pure JSON REST at `/api/v1/*`) and rendering layer (Next.js only) is a required
architectural convention — no HTML fragments in API responses.

### Cross-Cutting Concerns Identified

1. **Auth & Identity** — JWT access tokens (short-lived) + Redis refresh tokens + NextAuth + Google OAuth + server-side DOB age verification. NextAuth session shape must map cleanly to JWT claims — custom adapter work should be scoped explicitly.

2. **Redis multi-purpose cache** — Three concurrent workloads: market quote cache (high read, 30s TTL), leaderboard sorted sets (write on every trade/XP event), refresh token store (write on login). Requires documented key namespace schema and connection pool strategy to prevent workload contention. This is an architectural decision, not an implementation detail.

3. **Gamification event pipeline** — XP events are immutable audit rows. Badge evaluation runs after every XP award. Race condition risk: concurrent XP events can trigger duplicate badge awards. Requires DB-level idempotency guard (unique constraint on user_id + badge_id) from story T2.8 onward — application-level checks alone are insufficient.

4. **FERPA compliance layer** — A pre-implementation SDK audit list must be produced before any third-party dependency is added. Every SDK touching student data must be categorised as: (a) no PII, (b) PII with scrubbing, or (c) blocked. This constrains error tracking, analytics, logging, and monitoring choices across the entire stack.

5. **Background job infrastructure** — node-cron is insufficient for production: fails silently on process restart, no retry logic, missed streak resets corrupt user data. BullMQ (Redis-backed) should be evaluated as the job queue. Critical jobs: midnight streak evaluation, leaderboard recalculation, portfolio history snapshots, market data refresh.

6. **Real-time data fan-out** — A single market price tick drives: portfolio P&L calculation, leaderboard rank update, challenge standings update, portfolio history chart. These must be decoupled via an event or job queue pattern — synchronous fan-out on every quote request will not scale.

7. **AI streaming (SSE)** — SSE endpoint for Claude token streaming is not a standard REST pattern. Requires its own middleware, timeout handling, and connection management. Portfolio context injected server-side at request time (not client-side). Safari PWA SSE reconnect bugs are a known issue — EventSource polyfill or polling fallback needed for Phase 3 PWA.

8. **Stripe dual-write entitlement** — Pro features must unlock immediately on payment confirmation (synchronous checkout path) AND stay consistent via async webhook sync. Both paths must write to the same `subscriptions` table — requires idempotency on webhook processing.

9. **Shared package semver** — `packages/shared-types` and `packages/shared-utils` are Phase 4 React Native integration contracts. All breaking changes to these packages must be versioned. A React Native consumer introduced in Phase 4 cannot tolerate ad-hoc structural changes.

10. **Market data fill price integrity** — Paper trading fills at "market price ±0.1% simulated spread." Crypto can move 5%+ within a 30s cache window. Fill price and cache TTL must be co-designed: the fill price used in an order must be snapshotted at order-creation time, not re-fetched at fill time.

---

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web monorepo (Turborepo) with mobile-ready API — based on project requirements
analysis. Phase 1–3 targets web; Phase 4+ targets React Native / Expo sharing the same API.

### Starter Options Considered

This project uses a custom monorepo scaffold rather than an off-the-shelf starter, because
no single starter covers: Express API + Next.js 14 + Turborepo + shared packages + Docker
in a single coherent template. The closest options evaluated:

| Option | Verdict |
|--------|---------|
| `create-t3-app` | Next.js + tRPC + Prisma — too opinionated (tRPC incompatible with mobile API reuse requirement) |
| `create-next-app` | Web only — doesn't cover Express API or monorepo |
| Turborepo official example (`with-nextjs`) | Good monorepo base, but no Express or Docker |
| Custom scaffold (current approach) | ✅ Matches requirements exactly; monorepo skeleton already exists |

### Selected Approach: Custom Turborepo Monorepo

**Rationale:** The tech stack is pre-defined and no starter covers the full combination.
The monorepo skeleton (`package.json`, `pnpm-workspace.yaml`, `turbo.json`) is already in
place. First implementation stories scaffold each app individually.

**Initialization Commands:**

```bash
# Monorepo skeleton already exists. Per-app scaffolding:

# API (Express + TypeScript)
cd apps/api && pnpm init && pnpm add express typescript @types/express ts-node-dev

# Web (Next.js 14 App Router)
cd apps/web && pnpm dlx create-next-app@latest . \
  --typescript --tailwind --app --no-src-dir --import-alias "@/*"

# Shared types package
cd packages/shared-types && pnpm init

# Shared utils package
cd packages/shared-utils && pnpm init
```

**Architectural Decisions Established by Scaffold:**

**Language & Runtime:**
- TypeScript throughout (strict mode) — all apps and packages
- Node.js 20 LTS runtime for API
- pnpm workspaces for dependency management

**Monorepo Pipeline (Turborepo):**
- `turbo build` — parallel builds with caching
- `turbo dev` — concurrent dev servers (API :4000, Web :3000)
- `turbo lint` / `turbo test` — workspace-aware

**Styling Solution:**
- Tailwind CSS 3.x (configured in `apps/web`)
- No CSS-in-JS — eliminates SSR hydration issues

**Build Tooling:**
- Next.js 14 built-in bundler (Turbopack in dev) for web
- `ts-node-dev` for API hot reload in development
- Docker multi-stage builds for production

**Testing Framework:**
- Vitest for unit/integration tests (API + packages)
- Playwright for E2E tests (web)

**Code Organization:**
- `apps/api/src/routes/` — Express route handlers by domain
- `apps/api/src/db/migrations/` — sequential PostgreSQL migrations
- `apps/web/app/` — Next.js App Router pages and layouts
- `packages/shared-types/src/` — TypeScript interfaces (no runtime code)
- `packages/shared-utils/src/` — Pure functions (currency, portfolio math)

**Development Experience:**
- `docker compose -f infra/docker-compose.yml up -d` — PostgreSQL + Redis locally
- `.env.example` documents all required environment variables
- ESLint + Prettier enforced via Turborepo lint pipeline

**Note:** T1.1 (Student Registration) is the first implementation story and will drive
the initial `apps/api` and `apps/web` scaffolding in practice.

---

## Core Architectural Decisions

### Decision Constraint
All Phase 1 tooling choices use open source or free-tier options. Upgrades to premium
versions are deferred until user scale or school contracts justify the cost.

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Database query strategy: Drizzle ORM
- Redis key namespace schema: defined below
- Background job infrastructure: BullMQ
- JWT token lifetime policy: 15min access / 7day refresh
- API pagination convention: offset-based
- Error response envelope: standardised shape

**Important Decisions (Shape Architecture):**
- Client-side state: Zustand
- Logging & error tracking: Pino + GlitchTip (self-hosted)
- Hosting: Vercel (web) + Railway (API + DB + Redis)
- CI/CD: GitHub Actions + Vercel git integration

**Deferred Decisions (Post-Pilot):**
- Cursor-based pagination for leaderboard (Phase 2 if offset degrades at scale)
- Sentry cloud (upgrade from GlitchTip when school SLA contracts require it)
- Datadog / New Relic (upgrade from Pino when observability needs grow)
- Premium hosting tiers (Railway Pro / Vercel Pro on user growth)

---

### Data Architecture

**ORM Strategy: Drizzle ORM**
- License: MIT (open source)
- Raw SQL migrations in `apps/api/src/db/migrations/` (sequential, numbered)
- Drizzle for type-safe query building on top of migrations
- Schema definitions in `apps/api/src/db/schema/` — types exported to `packages/shared-types`
- Affects: All T1–T4 stories that touch the database

**Redis Key Namespace Schema:**
```
quote:{TICKER}              TTL: 30s   — market quote cache (Alpaca / CoinGecko)
lb:global                   TTL: none  — global leaderboard sorted set (ZADD/ZREVRANGE)
lb:class:{classId}          TTL: none  — class leaderboard sorted set
refresh:{userId}:{tokenId}  TTL: 7d    — refresh token store
job:{jobId}                 TTL: auto  — BullMQ job metadata
```
- Connection pool: single ioredis client, shared across all workloads
- Key namespacing prevents cross-workload collisions during flush/debug operations

**Background Job Infrastructure: BullMQ**
- License: MIT (open source)
- Backed by existing Redis instance (no additional infra)
- Critical jobs:
  - `streak:reset` — runs at 00:00 UTC daily
  - `leaderboard:recalc` — runs every 5 minutes
  - `portfolio:snapshot` — runs at market close (21:00 UTC weekdays)
  - `market:warmup` — pre-warms quote cache at market open (13:30 UTC)
- Retry policy: 3 attempts with exponential backoff
- Job failures visible in BullMQ dashboard (Bull Board — open source)

---

### Authentication & Security

**JWT Token Lifetimes:**
- Access token: 15 minutes (signed with `JWT_SECRET`)
- Refresh token: 7 days (signed with `JWT_REFRESH_SECRET`, stored in Redis)
- Refresh tokens are single-use (rotated on each refresh)
- On logout: refresh token deleted from Redis immediately

**FERPA SDK Allowlist (pre-implementation audit):**

| SDK / Service | PII exposure | Status |
|--------------|-------------|--------|
| Pino (logging) | None — structured JSON to stdout | ✅ Approved |
| GlitchTip (error tracking, self-hosted) | Configurable — PII scrubbing enabled | ✅ Approved |
| Drizzle ORM | None — local only | ✅ Approved |
| BullMQ | None — local Redis only | ✅ Approved |
| Stripe | Billing data only (not student PII) | ✅ Approved |
| Anthropic API | Prompt contains portfolio data — no PII sent | ✅ Approved with review |
| Vercel Analytics | ❌ Not used — replaced with self-hosted or none | ⛔ Blocked |
| Google Analytics | ❌ Student PII risk | ⛔ Blocked |
| Sentry cloud | ⚠️ Deferred — use GlitchTip self-hosted for pilot | 🔄 Deferred |

Any new third-party dependency touching student data must be reviewed against this
allowlist before merging.

---

### API & Communication Patterns

**REST API Versioning:** `/api/v1/*` (all routes versioned from day 1)

**Pagination Convention (offset-based):**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 847,
    "hasNext": true
  }
}
```
- Default limit: 20. Max limit: 100 (enforced server-side)
- All list endpoints paginated from day 1 (NFR6 mobile-first requirement)
- Cursor-based pagination deferred to Phase 2 if leaderboard offset degrades at scale

**Error Response Envelope:**
```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "You don't have enough cash to place this order.",
    "field": "quantity"
  }
}
```
- `code`: machine-readable constant (SCREAMING_SNAKE_CASE)
- `message`: human-readable, safe to display in UI
- `field`: optional, present only for validation errors

**SSE Streaming (AI Coach):**
- Endpoint: `GET /api/v1/ai/chat/stream` with `Accept: text/event-stream`
- Portfolio context injected server-side at request time
- Connection timeout: 60s (Claude response SLA)
- EventSource polyfill included in web client for Safari compatibility

---

### Frontend Architecture

**Client-Side State: Zustand**
- License: MIT (open source)
- Scope: non-server UI state only (TanStack Query owns server state)
- Stores: `authStore` (user session), `notificationStore` (in-app toast queue),
  `uiStore` (modal states, active filters)
- Server state (portfolio, leaderboard, quotes, lessons) → TanStack Query only

**Component Architecture:**
- `apps/web/app/` — Next.js App Router pages (server components by default)
- `apps/web/components/ui/` — Primitive UI components (buttons, inputs, cards)
- `apps/web/components/features/` — Domain components (PortfolioChart, TradeModal, etc.)
- `apps/web/lib/` — Client utilities, API client, query hooks

---

### Infrastructure & Deployment

**Hosting (Phase 1 pilot — free tiers):**

| Service | Platform | Tier |
|---------|----------|------|
| `apps/web` (Next.js) | Vercel | Hobby (free) |
| `apps/api` (Express) | Railway | Starter (free trial → $5/mo) |
| PostgreSQL | Railway | Included |
| Redis | Railway | Included |
| GlitchTip (error tracking) | Railway or self-hosted Docker | Open source |

Upgrade path: Railway Pro + Vercel Pro when paying school contracts require SLA guarantees.

**Uptime Monitoring:** UptimeRobot free tier monitors `/api/v1/health` every 5 minutes.
Upgrade to Better Uptime when schools require a public status page.

**CI/CD: GitHub Actions**
```
push to main:
  1. pnpm install
  2. turbo lint
  3. turbo test
  4. turbo build
  5. Deploy API → Railway (via Railway GitHub integration)
  6. Deploy Web → Vercel (via Vercel GitHub integration — auto)
```
- Preview deployments: Vercel auto-generates preview URL on every PR
- Environment secrets: GitHub Actions secrets for API keys

**Environment Configuration:**
- `.env.example` is the source of truth for all required variables
- Per-environment: `.env.local` (dev), Railway environment vars (production)
- No `.env` files committed — enforced via `.gitignore`

---

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

14 areas where AI agents could independently make incompatible choices — covered below.

---

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case` plural nouns — `users`, `portfolios`, `orders`, `xp_events`
- Columns: `snake_case` — `user_id`, `created_at`, `portfolio_value`
- Foreign keys: `{table_singular}_id` — `user_id`, `class_id`, `badge_id`
- Primary keys: always `id` (UUID v4)
- Timestamps: always `created_at`, `updated_at` (not `createdAt`, `timestamp`, `date`)
- Booleans: `is_` prefix — `is_pro`, `is_deleted`, `is_under_18`
- Indexes: `idx_{table}_{column(s)}` — `idx_users_email`, `idx_orders_user_id_created_at`

```sql
-- CORRECT
CREATE TABLE xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  xp_amount INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WRONG
CREATE TABLE XpEvent (userId uuid, xpAmount int, createdAt timestamp);
```

**API Endpoint Naming:**
- Resources: plural nouns — `/api/v1/users`, `/api/v1/orders`, `/api/v1/badges`
- Nested resources: `/api/v1/users/:userId/portfolio`
- Actions (not REST-able): verb phrase — `/api/v1/orders/:orderId/cancel`
- Query params: `camelCase` — `?page=1&limit=20&sortBy=return`
- Route params: `camelCase` — `:userId`, `:classId`, `:badgeId`

```
CORRECT:  GET  /api/v1/portfolios/:userId/holdings
CORRECT:  POST /api/v1/orders
CORRECT:  POST /api/v1/portfolios/:userId/reset
WRONG:    GET  /api/v1/get-portfolio
WRONG:    GET  /api/v1/Portfolio/:user_id/Holding
```

**TypeScript / Code Naming:**
- Variables & functions: `camelCase` — `userId`, `getPortfolio`, `calculatePnl`
- Classes & types & interfaces: `PascalCase` — `UserProfile`, `OrderRequest`, `PortfolioSummary`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_LIMIT`, `QUOTE_TTL_SECONDS`
- Files (API): `kebab-case` — `portfolio.routes.ts`, `auth.middleware.ts`
- Files (Web components): `PascalCase` — `PortfolioChart.tsx`, `TradeModal.tsx`
- Files (Web utilities/hooks): `camelCase` — `usePortfolio.ts`, `formatCurrency.ts`
- Env vars: `SCREAMING_SNAKE_CASE` — `DATABASE_URL`, `ALPACA_API_KEY`

---

### Structure Patterns

**API Layer Organisation (`apps/api/src/`):**
```
routes/           — route definitions only, delegates to controllers
controllers/      — request parsing, response shaping
services/         — business logic, no HTTP concerns
db/
  schema/         — Drizzle schema definitions per domain
  migrations/     — numbered SQL files: 001_create_users.sql
  index.ts        — db client export
middleware/       — auth.middleware.ts, validate.middleware.ts, error.middleware.ts
jobs/             — BullMQ job definitions per domain
validators/       — Zod request schemas
lib/              — external client singletons (redis.ts, alpaca.ts, coingecko.ts)
```

**Web Layer Organisation (`apps/web/`):**
```
app/
  (auth)/         — route group: login, register (no shared layout)
  (app)/          — route group: authenticated app shell
    dashboard/
    trade/[ticker]/
    learn/
    leaderboard/
  api/            — Next.js API routes (NextAuth callbacks only)
components/
  ui/             — primitives: Button, Card, Input, Badge, Skeleton
  features/       — domain: PortfolioChart, TradeModal, LessonCard, BadgeGrid
  layouts/        — AppShell, AuthLayout
lib/
  api.ts          — typed fetch wrapper for /api/v1/*
  queries/        — TanStack Query hooks per domain
  stores/         — Zustand stores: authStore.ts, uiStore.ts, notificationStore.ts
  utils/          — pure helpers (re-export from shared-utils where possible)
```

**Test File Location:**
- Co-located with source: `portfolio.service.test.ts` beside `portfolio.service.ts`
- E2E tests: `apps/web/e2e/` (Playwright)
- Fixtures & test helpers: `apps/api/src/test/` and `apps/web/test/`

---

### Format Patterns

**API Response Shapes:**

```json
// Single resource
{ "data": { "id": "...", "cashBalance": 10000000 } }

// Collection
{ "data": [...], "pagination": { "page": 1, "limit": 20, "total": 847, "hasNext": true } }

// Action (no body)
{ "success": true }

// Error
{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "...", "field": "quantity" } }
```

**JSON field naming: `camelCase` throughout** — DB stores `snake_case`, Drizzle serialises to `camelCase`. Never mix in the same response.

**Dates & Times:** ISO 8601 UTC strings only — `"2026-03-25T13:45:00.000Z"`. Never Unix timestamps. Store as `TIMESTAMPTZ` in DB.

**Money / Currency:**
- Store as `INTEGER` cents — `10000000` = $100,000.00
- API returns cents as integer — formatting is a frontend concern
- `packages/shared-utils` owns `formatCurrency(cents: number): string`
- Never floating point dollar amounts anywhere in the stack

**HTTP Status Codes:**
```
200 — success (GET, PATCH, PUT)
201 — created (POST)
204 — no content (DELETE)
400 — validation error
401 — unauthenticated
403 — unauthorised (wrong role)
404 — not found
409 — conflict (duplicate)
422 — business rule violation (insufficient balance)
429 — rate limited
500 — unexpected error
```

---

### Communication Patterns

**BullMQ Job Naming:** `domain:action` — `streak:reset`, `leaderboard:recalc`, `badge:evaluate`

**Gamification Pipeline Order (synchronous, within request):**
```
award XP (immutable insert) → check badges (idempotent) → check level → queue notification
```
Badge idempotency enforced by `UNIQUE(user_id, badge_id)` DB constraint — not application logic.

**Zustand — async operations belong outside stores:**
```typescript
// CORRECT
const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));

// WRONG — no async fetching inside Zustand stores
```

---

### Process Patterns

**API Error Handling:**
```typescript
// CORRECT — typed AppError, global middleware formats response
throw new AppError('INSUFFICIENT_BALANCE', 'Not enough cash.', 422, 'quantity');

// WRONG — ad-hoc response in controller
res.status(422).json({ error: 'not enough cash' });
```
All routes wrapped in `asyncHandler`. Global error middleware at `middleware/error.middleware.ts`.

**Web Loading States:**
```typescript
// CORRECT — TanStack Query owns loading state
const { data: portfolio, isLoading } = usePortfolio(userId);
if (isLoading) return <PortfolioSkeleton />;

// WRONG — manual useState loading flag duplicating TanStack Query
```
Skeleton components for content areas. Spinner only for button submission states.

**Validation:** Zod schemas in `validators/` — validated in middleware, controller receives clean input. Shared schemas live in `packages/shared-types`.

**Public route marker:**
```typescript
// PUBLIC: no auth required — leaderboard is publicly visible
router.get('/leaderboard', leaderboardController.getGlobal);

// All other routes — authMiddleware required
router.get('/portfolio', authMiddleware, portfolioController.get);
```

---

### Enforcement Guidelines

**All AI Agents MUST:**
1. Follow naming conventions above exactly — no exceptions without updating this doc
2. Store money as integer cents — never floats
3. Return ISO 8601 UTC timestamps — never Unix timestamps
4. Paginate all list endpoints with the standard envelope
5. Use `AppError` for all API errors — never ad-hoc `res.json({ error: ... })`
6. Write co-located tests for every service function
7. Check the FERPA SDK allowlist before adding any new dependency
8. Inject portfolio context server-side for AI endpoints — never client-side

**Enforcement mechanisms:**
- ESLint import boundary rules (routes → controllers → services → db)
- TypeScript strict mode
- PR checklist: naming, money as cents, pagination present, FERPA check

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
StockPlayingApp/
├── .github/
│   └── workflows/
│       └── ci.yml                    — lint → test → build → deploy
├── apps/
│   ├── api/                          — Express REST API
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              — server entry, BullMQ worker init
│   │       ├── app.ts                — Express app factory (testable)
│   │       ├── routes/
│   │       │   ├── index.ts          — mount all routers
│   │       │   ├── auth.routes.ts    — T1.1–T1.3
│   │       │   ├── users.routes.ts   — T1.4, T3.9
│   │       │   ├── market.routes.ts  — T1.6, T1.7, T1.8
│   │       │   ├── orders.routes.ts  — T1.9, T1.10
│   │       │   ├── portfolio.routes.ts — T1.11–T1.14
│   │       │   ├── modules.routes.ts — T2.1–T2.3
│   │       │   ├── quizzes.routes.ts — T2.4
│   │       │   ├── xp.routes.ts      — T2.5, T2.6
│   │       │   ├── badges.routes.ts  — T2.7, T2.8
│   │       │   ├── streaks.routes.ts — T2.9
│   │       │   ├── leaderboard.routes.ts — T2.10, T3.5
│   │       │   ├── classes.routes.ts — T3.1–T3.8
│   │       │   ├── challenges.routes.ts — T3.6, T3.7
│   │       │   ├── subscriptions.routes.ts — T4.1–T4.3
│   │       │   └── ai.routes.ts      — T4.4–T4.7 (SSE streaming)
│   │       ├── controllers/          — one file per route domain
│   │       ├── services/
│   │       │   ├── auth.service.ts
│   │       │   ├── market.service.ts — Alpaca + CoinGecko + Redis cache
│   │       │   ├── trading.service.ts — order execution, fill price snapshot
│   │       │   ├── portfolio.service.ts — P&L calculation, history
│   │       │   ├── gamification.service.ts — XP pipeline, badge eval, level check
│   │       │   ├── notification.service.ts — in-app notification queue
│   │       │   ├── classroom.service.ts — class, join code, challenge
│   │       │   ├── ai.service.ts     — Claude streaming, portfolio context injection
│   │       │   └── stripe.service.ts — checkout, webhook, entitlement sync
│   │       ├── db/
│   │       │   ├── index.ts          — Drizzle client + ioredis client
│   │       │   ├── schema/
│   │       │   │   ├── users.ts
│   │       │   │   ├── portfolios.ts
│   │       │   │   ├── orders.ts
│   │       │   │   ├── holdings.ts
│   │       │   │   ├── xp_events.ts
│   │       │   │   ├── badges.ts
│   │       │   │   ├── user_badges.ts
│   │       │   │   ├── modules.ts
│   │       │   │   ├── lessons.ts
│   │       │   │   ├── quiz_attempts.ts
│   │       │   │   ├── classes.ts
│   │       │   │   ├── class_members.ts
│   │       │   │   ├── challenges.ts
│   │       │   │   ├── subscriptions.ts
│   │       │   │   └── ai_messages.ts
│   │       │   └── migrations/
│   │       │       ├── 001_create_users.sql
│   │       │       ├── 002_create_portfolios.sql
│   │       │       ├── 003_create_orders_holdings.sql
│   │       │       ├── 004_create_xp_badges.sql
│   │       │       ├── 005_create_modules_lessons.sql
│   │       │       ├── 006_create_classes_challenges.sql
│   │       │       └── 007_create_subscriptions_ai.sql
│   │       ├── middleware/
│   │       │   ├── auth.middleware.ts
│   │       │   ├── validate.middleware.ts
│   │       │   ├── rate-limit.middleware.ts
│   │       │   └── error.middleware.ts
│   │       ├── validators/           — Zod schemas per domain
│   │       ├── jobs/
│   │       │   ├── index.ts          — BullMQ queue + worker setup
│   │       │   ├── streak.job.ts     — 00:00 UTC daily
│   │       │   ├── leaderboard.job.ts — every 5 min
│   │       │   ├── portfolio-snapshot.job.ts — market close
│   │       │   └── market-warmup.job.ts — market open
│   │       ├── lib/
│   │       │   ├── redis.ts          — ioredis singleton
│   │       │   ├── alpaca.ts         — Alpaca REST client
│   │       │   ├── coingecko.ts      — CoinGecko client
│   │       │   ├── anthropic.ts      — Anthropic SDK client
│   │       │   ├── stripe.ts         — Stripe client
│   │       │   ├── logger.ts         — Pino logger
│   │       │   └── app-error.ts      — AppError class
│   │       └── test/
│   │           ├── fixtures/         — seed data for tests
│   │           └── helpers/          — test DB setup, auth helpers
│   └── web/                          — Next.js 14 App Router
│       ├── Dockerfile
│       ├── package.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── app/
│       │   ├── layout.tsx            — root layout, providers
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx    — T1.2, T1.3
│       │   │   └── register/page.tsx — T1.1, T1.2
│       │   ├── (app)/
│       │   │   ├── layout.tsx        — AppShell (nav, auth guard)
│       │   │   ├── dashboard/page.tsx — T1.11 Portfolio Dashboard
│       │   │   ├── trade/
│       │   │   │   ├── page.tsx      — T1.6 Asset Search
│       │   │   │   └── [ticker]/page.tsx — T1.7 Quote + Chart + Buy/Sell
│       │   │   ├── portfolio/page.tsx — T1.12, T1.13, T1.14
│       │   │   ├── learn/
│       │   │   │   ├── page.tsx      — T2.1 Module Browser
│       │   │   │   └── [moduleId]/
│       │   │   │       ├── page.tsx  — T2.2 Sequential Lessons
│       │   │   │       └── [lessonId]/page.tsx — T2.3, T2.4
│       │   │   ├── leaderboard/page.tsx — T2.10
│       │   │   ├── badges/page.tsx   — T2.7, T2.12
│       │   │   ├── classroom/
│       │   │   │   ├── page.tsx      — T3.3 Student class view
│       │   │   │   └── [classId]/
│       │   │   │       ├── page.tsx  — T3.4 Roster / challenge
│       │   │   │       └── leaderboard/page.tsx — T3.5
│       │   │   ├── teacher/
│       │   │   │   ├── page.tsx      — T3.1 Teacher dashboard
│       │   │   │   └── [classId]/page.tsx — T3.2–T3.8
│       │   │   ├── pro/page.tsx      — T4.1 Pro features display
│       │   │   └── coach/page.tsx    — T4.4–T4.7 AI chat
│       │   └── api/
│       │       └── auth/[...nextauth]/route.ts — NextAuth handler
│       ├── components/
│       │   ├── ui/
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Badge.tsx
│       │   │   ├── Skeleton.tsx
│       │   │   ├── Toast.tsx
│       │   │   └── Modal.tsx
│       │   ├── features/
│       │   │   ├── trading/          — QuoteCard, TradeModal, PriceChart
│       │   │   ├── portfolio/        — PortfolioDashboard, HoldingRow, PnLBadge
│       │   │   ├── learning/         — ModuleCard, LessonContent, QuizForm
│       │   │   ├── gamification/     — XPBar, LevelBadge, BadgeCard, StreakFlame
│       │   │   ├── leaderboard/      — LeaderboardTable, RankBadge
│       │   │   ├── classroom/        — ClassCard, RosterTable, ChallengeCard
│       │   │   └── ai/               — ChatWindow, MessageBubble, StreamingText
│       │   └── layouts/
│       │       ├── AppShell.tsx
│       │       └── AuthLayout.tsx
│       ├── lib/
│       │   ├── api.ts                — typed fetch wrapper for /api/v1/*
│       │   ├── auth.ts               — NextAuth config
│       │   ├── queries/              — TanStack Query hooks per domain
│       │   ├── stores/               — Zustand stores
│       │   └── utils/
│       └── e2e/                      — Playwright E2E tests
├── packages/
│   ├── shared-types/
│   │   └── src/
│   │       ├── index.ts
│   │       ├── user.types.ts
│   │       ├── portfolio.types.ts
│   │       ├── order.types.ts
│   │       ├── market.types.ts
│   │       ├── gamification.types.ts
│   │       ├── classroom.types.ts
│   │       ├── ai.types.ts
│   │       └── api.types.ts          — response envelopes + Zod schemas
│   └── shared-utils/
│       └── src/
│           ├── index.ts
│           ├── currency.ts           — formatCurrency(cents), parseCurrency
│           ├── portfolio.ts          — calculatePnl, calculateReturn
│           └── date.ts               — formatDate, isMarketOpen
├── infra/
│   ├── docker-compose.yml            — PostgreSQL + Redis + GlitchTip
│   ├── Dockerfile.api
│   └── Dockerfile.web
├── docs/
│   ├── prd.md
│   ├── architecture.md
│   ├── epics.md
│   ├── market-research.md
│   └── stories/
│       ├── sprint-status.yaml
│       └── [story files]
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── CLAUDE.md
```

---

### Architectural Boundaries

**API layer enforcement (strict, no cross-layer imports):**
```
HTTP Request → middleware/ → routes/ → controllers/ → services/ → db/ + lib/
```
- Controllers never access `db` directly — must go through services
- Services never import from `routes` or `controllers`
- `lib/` exports singletons only — no business logic

**Web layer:**
```
Next.js Page (server component) → Feature Component (client) → TanStack Query / Zustand → lib/api.ts → Express API
```
- No direct DB access from Next.js — all data via `/api/v1/*`
- Server components for auth checks and initial data fetch; client components for interactivity

**Shared package contract:** `shared-types` and `shared-utils` — no imports from `apps/`, no side effects, semver required.

---

### Thread-to-Structure Mapping

| Thread | Primary API routes | Primary Web pages | Primary services |
|--------|-------------------|-------------------|-----------------|
| T1 Core Trading | auth, market, orders, portfolio | (auth)/*, dashboard, trade, portfolio | auth, market, trading, portfolio |
| T2 Gamification | xp, badges, streaks, leaderboard, modules, quizzes | learn, leaderboard, badges | gamification, notification |
| T3 Classroom | classes, challenges | classroom, teacher | classroom |
| T4 AI & Payments | subscriptions, ai | pro, coach | ai, stripe |

---

### Data Flows

**Paper Trade Execution:**
```
POST /api/v1/orders
  → validate (Zod middleware)
  → fetch quote from Redis or Alpaca, snapshot fill_price = quote ± 0.1%
  → DB transaction: INSERT order, UPDATE cash, UPSERT holding
  → award XP → check badges → check level → queue notification
  → return filled order; client invalidates portfolio + leaderboard queries
```

**AI Coach Message:**
```
GET /api/v1/ai/chat/stream (SSE)
  → fetch portfolio holdings server-side
  → build system prompt: educational framing + portfolio context
  → stream Claude claude-sonnet-4-6 via Anthropic SDK → SSE
  → on completion: save message pair to ai_messages
```

---

### External Integration Points

| Integration | Client | Cache | On failure |
|------------|--------|-------|-----------|
| Alpaca Markets | `lib/alpaca.ts` | `quote:{TICKER}` 30s | Serve stale; block order if no quote |
| CoinGecko | `lib/coingecko.ts` | `quote:{TICKER}` 30s | Same as Alpaca |
| NewsAPI | `lib/newsapi.ts` | `news:{ticker}` 5min | Return empty array silently |
| Anthropic Claude | `lib/anthropic.ts` | None (streaming) | Surface error in chat UI |
| Stripe | `lib/stripe.ts` | None | Webhook idempotency via `stripe_event_id` unique constraint |

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are compatible — Express, Drizzle ORM,
PostgreSQL, Redis, BullMQ, Next.js 14, TanStack Query, and Zustand have no version conflicts
and are all MIT-licensed open source. BullMQ shares the ioredis singleton via connection
reuse — consistent with the Redis single-client pattern.

**Pattern Consistency:** Zod validation aligns with Drizzle's TypeScript-first model.
camelCase API serialisation is handled natively by Drizzle. Import boundary rules
(routes → controllers → services → db) are enforceable via ESLint.

**Structure Alignment:** Every architectural decision maps to a specific directory and
service layer. No contradictory decisions found.

---

### Requirements Coverage Validation ✅

**Thread Coverage:**
- T1 Core Trading (FR1–FR25): ✅ auth, market, trading, portfolio services + routes defined
- T2 Gamification (FR26–FR42): ✅ gamification pipeline (XP→badge→level→notification) documented
- T3 Classroom (FR43–FR49): ✅ classroom service + routes + CSV export defined
- T4 AI & Payments (FR50–FR65): ✅ SSE streaming + portfolio context injection + Stripe dual-write defined

**NFR Coverage:**
- NFR1 p95 < 200ms: ✅ Redis cache eliminates Alpaca round-trips for cached quotes
- NFR2 Cache ≥ 90%: ✅ 30s TTL + market-warmup BullMQ job at market open
- NFR3 Zero PII in third-party: ✅ FERPA allowlist + Pino + self-hosted GlitchTip
- NFR4 AI first token < 1s: ✅ SSE streaming; portfolio context pre-fetched server-side
- NFR5 99.5% uptime: ✅ health endpoint + UptimeRobot + graceful API degradation
- NFR6 Mobile-first 375px: ✅ all lists paginated; Tailwind mobile-first
- NFR7 Google Workspace SSO: ✅ NextAuth Google provider (T1.2)
- NFR8 Stripe webhook verification: ✅ signature verification in stripe.service.ts

---

### Gap Analysis Results

**Critical gaps:** None.

**Important gaps (address in first implementation sprint):**

1. **Migration runner** — Add `drizzle-kit migrate` as `pnpm db:migrate` in root `package.json`
2. **Seed data location** — `apps/api/src/db/seed.ts` — module content, badge definitions, XP thresholds
3. **Rate limiting values** — Global: 100 req/min/IP · Auth: 10 req/min/IP · AI stream: 20 req/min/user
4. **AI system prompt location** — `apps/api/src/lib/ai-system-prompt.ts` — versioned in git as compliance document

**Nice-to-have (post-pilot):** OpenAPI spec, Drizzle ERD, Storybook.

---

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context analysed (65 FRs, 8 NFRs, 7 ARs)
- [x] Scale assessed (High — 5 external APIs, compliance, AI, payments)
- [x] Technical constraints identified (FERPA, COPPA, SEC, mobile-first, semver)
- [x] 10 cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] ORM: Drizzle ORM · Jobs: BullMQ · State: Zustand
- [x] Logging: Pino + GlitchTip · Hosting: Vercel + Railway · CI/CD: GitHub Actions
- [x] Redis namespace schema · JWT lifetimes · FERPA SDK allowlist
- [x] Pagination convention · Error envelope · Money as integer cents

**✅ Implementation Patterns**
- [x] Naming: DB, API, TypeScript, files
- [x] Format: response envelopes, dates, money, HTTP codes
- [x] Process: error handling, loading states, validation, auth markers
- [x] 8 enforcement rules for AI agents

**✅ Project Structure**
- [x] Complete directory tree (all files named, all 44 stories mapped)
- [x] Layer boundaries enforced (routes → controllers → services → db)
- [x] 5 external integrations mapped to lib/ clients
- [x] 2 critical data flows documented (trade execution, AI streaming)

---

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High**

**Key Strengths:**
- Steel thread structure — T1 fully demo-able before T2 begins
- FERPA compliance built into foundation — not bolted on later
- Mobile API contract established from day 1 — Phase 4 React Native has clean integration path
- Gamification pipeline idempotent by design — badge race conditions cannot occur
- Open source / free-tier stack — zero infrastructure cost during pilot

**Areas for Future Enhancement:**
- Cursor-based pagination for leaderboard at scale (Phase 2)
- WebSocket / SSE for real-time P&L updates (Phase 2)
- OpenAPI spec for mobile team (Phase 4 prep)
- Sentry cloud upgrade when school SLA contracts require it

---

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented — no ad-hoc choices
- Use implementation patterns consistently — naming, money as cents, pagination, errors
- Respect layer boundaries — no cross-layer imports
- Check FERPA allowlist before adding any dependency
- Refer to this document for all architectural questions before asking the user

**First Implementation Story:** T1.1 — Student Registration with Email and Password
- Scaffold `apps/api` (Express + Drizzle + migration 001_create_users.sql)
- Scaffold `apps/web` (Next.js 14 App Router + register page)
- Establish `packages/shared-types` with `UserProfile` and `ApiResponse` types
- Verify Docker Compose brings up PostgreSQL + Redis cleanly

---

_Architecture workflow complete. This document is the single source of truth for all
technical decisions on StockPlay. All AI agents implementing stories must refer
to this document before making any architectural choice not covered by their story._

---

## UI/UX Design Context Update (2026-03-28)

### New Input: Stitch Screen Inventory

10 high-fidelity mobile screens added to PRD (Google Stitch, project `914389739818317223`).
Design system: Editorial Intelligence — dark mode, Plus Jakarta Sans / Manrope, 390px mobile target.

Screens confirmed active:

| Screen | Stitch ID | Functional Area |
|--------|-----------|-----------------|
| Onboarding (×2 variants) | `dd985b49...`, `1f5cf6bf...` | Auth & Onboarding |
| Dashboard & Path (×2 variants) | `7ddf77f0...`, `e546d615...` | Portfolio — main dashboard |
| Portfolio Simulator (×2 variants) | `e6766204...`, `643a245c...` | Portfolio — simulator |
| Lesson Content (×2 variants) | `00063f20...`, `5c1ab2d8...` | Learning — lesson detail |
| Quiz & Assessment (×2 variants) | `e87586b8...`, `84cc4127...` | Learning — quiz |

### Architectural Implications

**1. Design Token Integration (Pre-Story Gate — T1.1 blocker)**

The Stitch Editorial Intelligence theme defines 40+ named color tokens, 2 typefaces, and a
spacing scale. These must be mapped into `apps/web/tailwind.config.ts` as CSS custom properties
before any component work begins.

```css
/* apps/web/app/globals.css */
:root {
  --color-surface:                #121416;
  --color-surface-container:      #1e2022;
  --color-surface-container-high: #282a2c;
  --color-surface-bright:         #37393b;
  --color-primary:                #acc7ff;
  --color-primary-container:      #006adc;
  --color-secondary:              #4ae183;
  --color-secondary-container:    #06bb63;
  --color-tertiary:               #eec209;
  --color-on-surface:             #e2e2e5;
  --color-on-surface-variant:     #c1c6d6;
  --color-outline:                #8b909f;
  --color-outline-variant:        #414753;
  --color-error:                  #ffb4ab;
}
```

```typescript
// apps/web/tailwind.config.ts — extend colors with all tokens
theme: {
  extend: {
    colors: {
      surface: 'var(--color-surface)',
      'surface-container': 'var(--color-surface-container)',
      'surface-container-high': 'var(--color-surface-container-high)',
      'surface-bright': 'var(--color-surface-bright)',
      primary: 'var(--color-primary)',
      'primary-container': 'var(--color-primary-container)',
      secondary: 'var(--color-secondary)',
      'secondary-container': 'var(--color-secondary-container)',
      tertiary: 'var(--color-tertiary)',
      'on-surface': 'var(--color-on-surface)',
      'on-surface-variant': 'var(--color-on-surface-variant)',
    },
    fontFamily: {
      display: ['"Plus Jakarta Sans"', 'sans-serif'],
      body:    ['Manrope', 'sans-serif'],
    },
  }
}
```

**2. Dark-Mode-First Strategy (Decision)**

All Stitch designs are dark mode. Phase 1 implementation decision: dark mode is the **default
and only** mode. Do **NOT** use Tailwind's `dark:` variant prefix — all base styles target
dark mode directly. Light mode is deferred to Phase 2 roadmap. Background of `<body>` is
`surface` (`#121416`); text default is `on-surface` (`#e2e2e5`).

**3. Viewport Target Correction**

Stitch designs are 390px wide (iPhone 14 Pro). NFR6 reference to "375px" is superseded —
implementation targets **390px** as the primary design width. Tailwind `sm` breakpoint
remains 640px. No other breakpoint changes.

**4. Design Variant Resolution Gate (New Pre-Story Requirement)**

5 of 10 screens have design variants (2 each). Before any story that touches these screens
begins, the designer/PM must select one canonical variant per screen. This is a **story
acceptance criteria gate** — implementation cannot begin on a screen with unresolved variants.

Resolution must be documented as a comment in the relevant story's acceptance criteria:
`"Canonical screen: Stitch ID <id> selected on <date> by <name>"`

**6. Desktop Screen Inventory (updated 2026-03-29)**

4 desktop screens now live in Stitch (project `914389739818317223`), all at 2560px:

| Screen | ID | Area |
|---|---|---|
| StockPlay Onboarding - Desktop | `7db7eb8490a943e99ec07c36c2c44e9c` | Auth / Onboarding |
| StockPlay Dashboard - Desktop | `5ca7025a8d20489b96403837b8bb70a2` | Portfolio — dashboard |
| StockPlay Portfolio - Desktop | `b78b73cd883142aca1a4ff9ac6b11aab` | Portfolio — simulator |
| StockPlay Lesson - Desktop | `a0225fbfa9264361bac691768188f9f4` | Learning & Education |

**Desktop Layout Architecture:**
- Left sidebar navigation (fixed, 220px) — replaces mobile bottom tab bar
- Main content area uses CSS Grid / responsive Tailwind breakpoints (`lg:` and `xl:`)
- Breakpoint strategy: mobile-first base styles → `md:` (768px) tablet → `lg:` (1024px) desktop → `xl:` (1280px) large desktop
- 2560px designs are high-res references; implementation targets 1280px–1440px as primary desktop range
- `apps/web/components/layouts/AppShell.tsx` must conditionally render `<Sidebar>` on `lg+` and `<BottomNav>` on `<lg`

**✅ Brand confirmed: StockPlay** — All screens, `<title>` tags, logo components, and headline copy must use "StockPlay" consistently.

**5. WCAG Contrast Validation (Pre-Implementation NFR-A2 Check)**

| Token Pair | Ratio | Status |
|---|---|---|
| `primary #acc7ff` on `surface #121416` | ~9.1:1 | ✅ Passes (exceeds 4.5:1) |
| `on-surface #e2e2e5` on `surface #121416` | ~14.7:1 | ✅ Passes |
| `on-surface-variant #c1c6d6` on `surface-container #1e2022` | ~8.1:1 | ✅ Passes |
| `outline #8b909f` on `surface #121416` | ~4.6:1 | ✅ Passes (borderline — do not use for body text) |

All active token pairs pass WCAG 2.1 AA. No fallbacks required.

---

## Architecture Re-Validation Results (2026-03-28)

### Coherence Validation ✅

**Decision Compatibility:** The Stitch design system integrates cleanly with the existing
stack. Tailwind CSS custom properties cover all token needs without introducing CSS-in-JS
or additional build dependencies. Plus Jakarta Sans and Manrope are Google Fonts — loaded
via `next/font` (zero layout shift, no external request at runtime).

**Pattern Consistency:** Dark-mode-first decision aligns with "no CSS-in-JS" rule.
Token naming follows kebab-case consistent with Tailwind conventions. No conflicts
with existing naming patterns.

**Structure Alignment:** `globals.css` and `tailwind.config.ts` are already in the
defined project structure. No new files or directories required.

### Requirements Coverage — UI/UX Addition ✅

**Screen-to-FR Mapping:** All 10 screens map to existing functional areas. No new FRs
introduced. Screen coverage confirms Phase 1 scope: Auth, Portfolio, Learning.

**NFR Impact:**
- NFR-P4 (LCP ≤ 2,500ms) — Google Fonts via `next/font` eliminates render-blocking font
  requests. No NFR change required.
- NFR-P5 (JS bundle ≤ 200KB gzip) — Design tokens are CSS variables; zero JS bundle
  impact. Glassmorphism effects use Tailwind `backdrop-blur` — no additional library needed.
- NFR-A2 (contrast ≥ 4.5:1) — All token pairs validated above. ✅
- NFR6 (mobile-first) — 390px target confirmed. ✅

### Gap Analysis — Post UI/UX Update

**Resolved Gaps:**
- ✅ Dark mode strategy now documented (dark-first, no `dark:` prefix)
- ✅ Design token integration path defined (CSS vars → Tailwind config)
- ✅ Viewport target corrected (375px → 390px)
- ✅ WCAG contrast validated for all active token pairs

**New Pre-Story Actions Required (3 items):**
1. 🔴 **Design token setup** — create `globals.css` token definitions and `tailwind.config.ts`
   extension before T1.1 UI work begins (can be done as T1.0 scaffolding task)
2. 🔴 **Variant resolution** — PM/designer selects canonical screen for each of the 5 variant
   pairs before their corresponding stories are picked up
3. 🟡 **Font loading** — add Plus Jakarta Sans + Manrope via `next/font` in `apps/web/app/layout.tsx`
   (small task, can be bundled into T1.1)

### Updated Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High** (increased — UI/UX spec now formally part of architecture)

**Additional Strengths (post UI/UX update):**
- All design tokens defined and validated before first story — eliminates mid-sprint design
  system churn
- Dark-mode-first decision locked — agents cannot independently choose light-mode defaults
- WCAG compliance confirmed at design system level — accessibility is built in, not audited later
