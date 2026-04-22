# Story T5.2: P0 Critical Path E2E and Integration Tests

**Status:** review
**Epic:** Thread 5 — QA Catch-up
**Sprint Key:** t5-2-p0-critical-path-tests
**Date Prepared:** 2026-04-16
**Prerequisite:** T5.1 complete (scaffold + seed API + CI)

---

## Story

As a QA engineer,
I want 8 P0-priority automated tests covering auth, paper trading, XP idempotency, JWT security, badge deduplication, FERPA compliance, Pro gating, and Stripe replay protection,
So that the highest-risk regressions are automatically caught on every PR.

---

## Acceptance Criteria

**AC1 — P0-001: Student can log in with valid credentials and reach dashboard**
**Given** a seeded student account
**When** the student submits valid email/password on `/login`
**Then** they are redirected to `/dashboard`; JWT is present in session; the portfolio balance "$100,000" is visible

**AC2 — P0-002: Student executes a paper trade (buy AAPL) and portfolio updates**
**Given** a logged-in student with $100,000 virtual cash
**When** they submit a buy order for 1 share of AAPL via `POST /api/v1/trades`
**Then** the response is 201; the portfolio cash decreases by the fill price (±0.1% spread); an XP row is created in `xp_events`

**AC3 — P0-003: XP award is idempotent on duplicate reference_id**
**Given** a logged-in student
**When** `POST /api/v1/xp/award` is called twice with identical `{ event_type, reference_id, xp_amount }`
**Then** the first call returns 201; the second call returns 409 Conflict; the DB contains exactly 1 `xp_events` row for that reference_id

**AC4 — P0-004: JWT isPro persists correctly after token rotation**
**Given** a Pro student whose access token has expired
**When** `refreshAccessToken()` issues a new token
**Then** the new token's decoded payload contains `isPro: true`; `session.user.isPro` remains `true` without re-login

**AC5 — P0-005: Badge unlocks fire exactly once at threshold**
**Given** a student who has completed 9 trades
**When** they complete their 10th trade
**Then** exactly 1 badge row exists in `user_badges` for the "10 Trades" badge; a second trade does not create a duplicate badge row

**AC6 — P0-006: Public leaderboard response contains no PII**
**Given** the leaderboard endpoint `GET /api/v1/leaderboard`
**When** the response is parsed
**Then** no entry contains `email`, `full_name`, or `date_of_birth` fields; every entry has `display_name` and `portfolio_value`

**AC7 — P0-007: Pro module returns 403 for free-tier student**
**Given** a free-tier student's access token
**When** they call `GET /api/v1/learn/modules/:slug` for a Pro-gated module
**Then** the API returns HTTP 403 `{ error: 'Student Pro subscription required' }`

**AC8 — P0-008: Stripe webhook replayed returns 200 without re-processing**
**Given** a `customer.subscription.updated` Stripe event that has already been processed
**When** the identical webhook event_id is POSTed again to `/api/v1/webhooks/stripe`
**Then** the response is 200; no duplicate subscription row is created; `processed_webhook_events` table has exactly 1 row for that event_id

---

## Tasks / Subtasks

### Task 1 — Create E2E auth test (P0-001) [x]

- [x] File: `apps/web/tests/e2e/auth.spec.ts`
- [x] Tag: `@P0 @E2E @Auth`
- [x] Use auth fixture from T5.1; assert URL = `/dashboard`; assert portfolio value visible

### Task 2 — Create paper trade integration test (P0-002) [x]

- [x] File: `apps/web/tests/integration/paper-trade.spec.ts`
- [x] Tag: `@P0 @Integration @Trade`
- [x] Seed student + AAPL price in Redis; POST trade; assert 201 + portfolio cash delta within ±0.1%

### Task 3 — Create XP idempotency test (P0-003) [x]

- [x] File: `apps/web/tests/integration/xp-idempotency.spec.ts`
- [x] Tag: `@P0 @Integration @Security`
- [x] POST xp/award twice with same reference_id; assert 201 then 409

### Task 4 — Create JWT isPro rotation test (P0-004) [x]

- [x] File: `apps/web/lib/auth.test.ts` (Vitest — no browser needed)
- [x] Tag: `@P0 @Security`
- [x] Mock fetch; call refresh logic; assert isPro re-decoded from new token

### Task 5 — Create badge deduplication test (P0-005) [x]

- [x] File: `apps/web/tests/integration/badge-dedup.spec.ts`
- [x] Tag: `@P0 @Integration @Data`
- [x] Seed student + price; place 10 trades; assert badge count ≤ 1

### Task 6 — Create FERPA leaderboard test (P0-006) [x]

- [x] File: `apps/web/tests/integration/leaderboard-pii.spec.ts`
- [x] Tag: `@P0 @Integration @Security @FERPA`
- [x] GET /leaderboard/global; assert no PII fields on any entry

### Task 7 — Create Pro gate test (P0-007) [x]

- [x] File: `apps/web/tests/integration/pro-gate.spec.ts`
- [x] Tag: `@P0 @Integration @Security`
- [x] Seed Pro module via test seed; free-tier student; GET module; assert 403

### Task 8 — Create Stripe replay test (P0-008) [x]

- [x] File: `apps/web/tests/integration/stripe-replay.spec.ts` + `apps/api/src/controllers/subscription.controller.test.ts`
- [x] Tag: `@P0 @Integration @Security`
- [x] Unit test: mock Stripe; assert idempotency check fires; assert no double DB update

---

## Dev Notes

- P0-008 requires the `processed_webhook_events (stripe_event_id TEXT UNIQUE)` migration — create it as part of this story if not already done
- P0-003 requires the `xp_events UNIQUE(user_id, event_type, reference_id)` migration — create it as part of this story if not already done
- All tests must call teardown in `afterEach` via `try/finally`
- Tests must pass with `npx playwright test --grep @P0` in under 5 minutes
- P0-004 can be a Vitest unit test (no browser needed) — place in `apps/api/src/` test suite

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes

All 8 tasks complete. Full test suites passing: **157 API tests (+3 new), 102 web tests (+3 new)**.

**Migrations added:**
- `014_xp_events_unique.sql` — partial UNIQUE index on `xp_events(user_id, event_type, reference_id) WHERE reference_id IS NOT NULL`
- `015_processed_webhooks.sql` — `processed_webhook_events (stripe_event_id TEXT PRIMARY KEY)`

**Backend changes:**
- `gamification.controller.ts` — added `POST /gamification/xp/award` endpoint (validates schema, returns 409 on duplicate)
- `xp.service.ts` — catches pg error code `23505`, re-throws as typed `XP_DUPLICATE` error
- `subscription.controller.ts` — idempotency check before switch; records event_id after processing
- `routes/index.ts` — registered `POST /gamification/xp/award`
- `routes/test.routes.ts` — extended seed to accept `quotes[]` (Redis injection) and `proModuleSlug`; teardown accepts `stripeEventIds[]`

**Playwright tests (8 tests, all @P0):**
- `tests/e2e/auth.spec.ts` — P0-001 credentials login → dashboard
- `tests/integration/paper-trade.spec.ts` — P0-002 buy AAPL with injected Redis price
- `tests/integration/xp-idempotency.spec.ts` — P0-003 duplicate reference_id → 409
- `tests/integration/badge-dedup.spec.ts` — P0-005 badge awarded ≤ once for 10 trades
- `tests/integration/leaderboard-pii.spec.ts` — P0-006 no PII in leaderboard entries
- `tests/integration/pro-gate.spec.ts` — P0-007 free-tier → 403 on Pro module
- `tests/integration/stripe-replay.spec.ts` — P0-008 integration layer check

**Vitest tests:**
- `lib/auth.test.ts` — P0-004 isPro re-decoded on token rotation (3 cases)
- `controllers/subscription.controller.test.ts` — P0-008 unit: replay → 200+no-double-write; new event → 3 DB calls; bad sig → 400

**vitest.config.ts** — added `exclude: ['tests/**']` to prevent Playwright specs from running under Vitest.

### File List

- `apps/api/src/db/migrations/014_xp_events_unique.sql` — **created**
- `apps/api/src/db/migrations/015_processed_webhooks.sql` — **created**
- `apps/api/src/services/gamification/xp.service.ts` — **modified** (XP_DUPLICATE error)
- `apps/api/src/controllers/gamification.controller.ts` — **modified** (xpAwardEndpoint added)
- `apps/api/src/controllers/subscription.controller.ts` — **modified** (idempotency check + record)
- `apps/api/src/controllers/subscription.controller.test.ts` — **created**
- `apps/api/src/routes/index.ts` — **modified** (POST /gamification/xp/award)
- `apps/api/src/routes/test.routes.ts` — **modified** (quotes + proModuleSlug + stripeEventIds)
- `apps/web/tests/e2e/auth.spec.ts` — **created**
- `apps/web/tests/integration/paper-trade.spec.ts` — **created**
- `apps/web/tests/integration/xp-idempotency.spec.ts` — **created**
- `apps/web/tests/integration/badge-dedup.spec.ts` — **created**
- `apps/web/tests/integration/leaderboard-pii.spec.ts` — **created**
- `apps/web/tests/integration/pro-gate.spec.ts` — **created**
- `apps/web/tests/integration/stripe-replay.spec.ts` — **created**
- `apps/web/lib/auth.test.ts` — **created**
- `apps/web/vitest.config.ts` — **modified** (exclude Playwright specs)

### Change Log

- 2026-04-17: T5.2 implemented — 8 P0 Playwright tests, 2 DB migrations, XP idempotency, Stripe replay protection, JWT isPro rotation Vitest tests
