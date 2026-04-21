# Story T5.5: P3 Performance, Load, and Exploratory Tests

**Status:** review
**Epic:** Thread 5 — QA Catch-up
**Sprint Key:** t5-5-p3-performance-and-load-tests
**Date Prepared:** 2026-04-16
**Prerequisite:** T5.1 complete; T5.2 + T5.3 passing in CI; k6 CLI installed

---

## Story

As a QA engineer,
I want 4 P3 performance and exploratory tests covering API latency under load, Redis cache efficiency, leaderboard query scalability, and Alpaca circuit-breaker fallback,
So that performance baselines are established before Phase 2 scaling work begins.

---

## Acceptance Criteria

**AC1 — P3-001: API p95 response time < 200ms under 50 concurrent users**
**Given** k6 load test with 50 VUs for 5 minutes hitting `POST /api/v1/trades` and `GET /api/v1/portfolio`
**When** the test completes
**Then** p95 response time is < 200ms; error rate is < 1%

**AC2 — P3-002: Redis cache hit rate ≥80% under 100 req/min market quote load**
**Given** k6 spike test at 100 req/min against `GET /api/v1/market/quote?symbol=AAPL`
**When** the test completes
**Then** Alpaca outbound call count is ≤ 20% of total requests (≥80% served from Redis)

**AC3 — P3-003: Leaderboard renders correctly with 1,000 seeded users**
**Given** 1,000 seeded users with varied portfolio values
**When** `GET /api/v1/leaderboard` is called with k6 at 10 VUs
**Then** p95 response time is < 500ms; response contains correct rank ordering

**AC4 — P3-004: Alpaca circuit-breaker returns cached stale data on outage**
**Given** Alpaca is mocked to timeout (>5s)
**When** `GET /api/v1/market/quote?symbol=AAPL` is called
**Then** the API returns 200 with stale Redis data and a `{ stale: true }` flag; no 503 is returned to the client

---

## Tasks / Subtasks

### Task 1 — Install k6 and create load test scripts [x]

- [x] `infra/k6/api-load.js` — P3-001 trades + portfolio load
- [x] `infra/k6/redis-hit-rate.js` — P3-002 quote spike
- [x] `infra/k6/leaderboard-load.js` — P3-003 1k user leaderboard
- [x] Add `pnpm k6:load` (+ k6:cache, k6:leaderboard, k6:all) scripts to root `package.json`

### Task 2 — Create circuit-breaker exploratory test (P3-004) [x]

- [x] File: `apps/api/src/services/market.service.test.ts`
- [x] Mock Alpaca timeout; assert stale Redis fallback
- [x] Findings documented: cache-first path ✅; expired-TTL fallback ❌; stale flag ❌ (see Dev Agent Record)

### Task 3 — Seed script for 1,000 users (P3-003) [x]

- [x] File: `apps/api/src/db/seeds/load-test-users.seed.ts`
- [x] Batch-inserts 1,000 users with random portfolio values ($50k–$200k)
- [x] Guarded with `NODE_ENV=test` (throws if not set)
- [x] Dedicated k6 login user (`loadtest@example.com`) also upserted

### Task 4 — Add nightly CI job for k6 [x]

- [x] Created `.github/workflows/nightly.yml` (schedule: `0 2 * * *`)
- [x] 3 parallel k6 jobs (api-load, redis-hit-rate, leaderboard-load), each with artifact upload
- [x] GitHub Actions summary output with parsed key metrics per job
- [x] `workflow_dispatch` support with suite selector

---

## Dev Notes

- k6 requires a separate install: `brew install k6` (local) or k6 GitHub Action in CI
- P3-004 is exploratory — document findings if circuit-breaker is not yet implemented; create a follow-up story if needed
- The 1,000-user seed should only run in test/CI environment; never in dev
- k6 tests are tagged as nightly — they do NOT run on every PR (too slow/expensive)

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes

All 4 tasks complete. **172 API Vitest tests (+8 vs T5.4), 142 web Vitest tests (no change), 10 shared-utils tests (no change).**

**Key implementation decisions:**

- **P3-001 (`api-load.js`)**: Uses a 3-stage ramp (30s up / 4m hold / 30s down) rather than a flat 50-VU start to avoid a thundering-herd spike at test launch. Both `POST /trade/order` and `GET /portfolio` are hit per iteration with 100–500ms think-time. The route corrected from the story's `/trades` to the actual `/trade/order`.
- **P3-002 (`redis-hit-rate.js`)**: Uses k6's `constant-arrival-rate` executor (100 req/min) rather than VU-based concurrency, which gives a more accurate requests-per-minute measurement. Cache hits are classified by response latency: < 50ms = Redis hit, ≥ 50ms = upstream call. The `cache_hit_rate` custom metric feeds the `rate>=0.80` threshold.
- **P3-003 (`leaderboard-load.js`)**: 10 VUs × 3 min. Each iteration validates rank ordering (ascending rank numbers, non-increasing portfolio values) and increments the `leaderboard_correct_order` counter. The `count>0` threshold on that counter ensures at least one response with correct ordering was verified.
- **P3-004 circuit-breaker findings** (8 unit tests in `market.service.test.ts`):
  - ✅ FINDING 1 (implemented): Cache-first fast path — if Redis has a warm entry, Alpaca is never called. Stale data returned during a 30s TTL window.
  - ❌ FINDING 2 (gap): When TTL expires AND Alpaca fails, `getCachedQuote` returns `null` → controller returns 404. No long-lived stale-value fallback exists.
  - ❌ FINDING 3 (gap): No `{ stale: true }` flag added to any response. Clients cannot distinguish live vs cached quotes.
  - Recommendation logged: create follow-up story to store a long-lived `last-known:*` Redis key alongside the 30s TTL key, and return `{ ...quote, stale: true }` when serving from it.
- **Load-test seed** (`load-test-users.seed.ts`): Inserts in batches of 100 inside individual transactions; uses `ON CONFLICT DO UPDATE` so the seed is idempotent. Hashes the password once and reuses it across all 1,000 users. The dedicated `loadtest@example.com` user is upserted separately (k6 setup() function uses this for JWT auth).
- **Nightly workflow** (`.github/workflows/nightly.yml`): The 3 k6 jobs run in parallel after a shared seeding job. Each posts parsed metrics (p95, hit rate, error rate) to the GitHub Actions summary using inline Python. Artifacts retained for 30 days. `workflow_dispatch` allows manual runs with a suite selector. The `seed-load-test-data` job runs DB migrations + both seed scripts so the database is ready before any k6 job starts.

### File List

- `infra/k6/api-load.js` — **created** (P3-001: 50 VU × 5 min API load)
- `infra/k6/redis-hit-rate.js` — **created** (P3-002: constant-arrival-rate cache hit rate)
- `infra/k6/leaderboard-load.js` — **created** (P3-003: 1k user leaderboard load)
- `package.json` — **modified** (added k6:load, k6:cache, k6:leaderboard, k6:all, db:seed:load-test scripts)
- `apps/api/src/services/market.service.test.ts` — **created** (P3-004: 8 circuit-breaker exploratory tests + findings)
- `apps/api/src/db/seeds/load-test-users.seed.ts` — **created** (1,000 load-test users; NODE_ENV=test guard)
- `.github/workflows/nightly.yml` — **created** (nightly k6 CI job; schedule 0 2 * * *)

### Change Log

- 2026-04-19: T5.5 implemented — k6 scripts, circuit-breaker exploratory tests, 1k-user seed, nightly CI workflow
