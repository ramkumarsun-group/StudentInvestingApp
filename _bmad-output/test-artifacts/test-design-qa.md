---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-12'
workflowType: 'testarch-test-design'
inputDocuments: ['docs/prd.md', 'docs/architecture.md', 'docs/epics.md', 'docs/stories/sprint-status.yaml']
---

# Test Design for QA: StockPlay

**Purpose:** Test execution recipe for QA team. Defines what to test, how to test it, and what QA needs from other teams.

**Date:** 2026-04-12
**Author:** Quinn (BMad QA / TEA Test Architect)
**Status:** Draft
**Project:** StockPlay — Student Investing App

**Related:** See Architecture doc (`test-design-architecture.md`) for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** System-level test design covering Threads 1 and 2 (30 shipped stories) and forward-looking coverage for Threads 3 and 4 (backlog). Emphasis on P0 regression safety for shipped code before T3 begins.

**Risk Summary:**

- Total Risks: 15 (6 high-priority score ≥6, 5 medium, 4 low)
- Critical Categories: SEC (3), TECH (2), DATA (1)

**Coverage Summary:**

- P0 tests: ~8 (critical paths — auth, paper trade, XP idempotency, FERPA, Pro gate)
- P1 tests: ~12 (service contracts — leaderboard, cache, module completion, badge share)
- P2 tests: ~8 (edge cases — browser compat patches, error narrowing, streak dedup)
- P3 tests: ~4 (benchmarks — API p95, Redis hit rate, leaderboard load)
- **Total**: ~32 tests (~3–4 weeks with 1 QA, including scaffold)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **Claude AI coach (Phase 3)** | Not yet implemented; T3 backlog | Covered when Phase 3 stories are written |
| **Mobile app (React Native)** | Out of Phase 1–2 scope | `shared-types` and `shared-utils` tested via web + API |
| **Pact contract testing** | Single consumer/provider; no external consumers | Internal API contracts validated via API integration tests |
| **Visual regression** | UI under active development; snapshots would require constant updates | Manual visual review per PR; deferred post-Phase 2 GA |
| **Stripe live-mode payments** | Test mode sufficient for all test environments | Stripe test-mode keys cover all webhook scenarios |
| **CoinGecko/NewsAPI integration** | Third-party services; not owned by team | Mock responses in integration tests; manual smoke in staging |

---

## Dependencies & Test Blockers

**CRITICAL:** QA cannot proceed with E2E or integration tests without these.

### Backend/Architecture Dependencies (Pre-Implementation)

**Source:** See Architecture doc "Quick Guide" for detailed mitigation plans.

1. **Test data seed API** — Backend — Before T3 sprint
   - `POST /api/v1/test/seed` + `DELETE /api/v1/test/teardown` (guarded by `NODE_ENV=test`)
   - Blocks: all E2E tests that require isolated user/portfolio/trade state

2. **`xp_events` idempotency constraint** — Backend — T3 sprint
   - `UNIQUE (user_id, event_type, reference_id)` migration
   - Blocks: R-04 idempotency integration tests

3. **Stripe webhook idempotency table** — Backend — T3 sprint
   - `processed_webhook_events (stripe_event_id TEXT UNIQUE)` table
   - Blocks: R-03 Stripe replay integration tests

4. **GitHub Actions CI workflow** — DevOps — Before T3 sprint
   - Playwright must run in CI for test authoring to provide value
   - Blocks: effective PR-gating on all test types

### QA Infrastructure Setup (Pre-Implementation)

1. **Playwright scaffold** — QA
   - `apps/web/playwright.config.ts` with `baseURL`, auth storage state (`storageState`), 2 shards
   - Auth fixture: `test.use({ storageState: 'playwright/.auth/student.json' })`
   - Auto-cleanup fixture calling `DELETE /api/v1/test/teardown` in `afterEach`

2. **Test data factories** — QA
   - `User` factory: `{ email: faker.internet.email(), password, role: 'student' | 'teacher' }`
   - `Portfolio` factory: `{ userId, holdings: [{ symbol, shares, avgCost }] }`
   - `Trade` factory: `{ userId, symbol, action: 'buy' | 'sell', shares, price }`
   - `XpEvent` factory: `{ userId, event_type, reference_id, xp_amount }`

3. **Test environments** — QA
   - Local: `docker compose -f infra/docker-compose.yml up -d` (Postgres + Redis), `.env.test`
   - CI: GitHub Actions service containers (`postgres:16`, `redis:7`)
   - Staging: shared staging env for E2E smoke only (not parallel)

**Factory pattern (using project's existing test setup):**

```typescript
// tests/fixtures/factories.ts
import { faker } from '@faker-js/faker';

export function createStudent(overrides = {}) {
  return {
    email: faker.internet.email(),
    password: 'Password123!',
    displayName: faker.internet.username(),
    ...overrides,
  };
}

export function createTrade(overrides = {}) {
  return {
    symbol: 'AAPL',
    action: 'buy' as const,
    shares: 1,
    ...overrides,
  };
}
```

```typescript
// tests/fixtures/auth.fixture.ts
import { test as base, expect } from '@playwright/test';

type AuthFixtures = { studentToken: string };

export const test = base.extend<AuthFixtures>({
  studentToken: async ({ request }, use) => {
    const student = createStudent();
    await request.post('/api/v1/test/seed', { data: { users: [student] } });
    const res = await request.post('/api/v1/auth/login', {
      data: { email: student.email, password: student.password },
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    await use(data.accessToken);
    await request.delete('/api/v1/test/teardown', { data: { email: student.email } });
  },
});
```

---

## Risk Assessment

**Note:** Full risk details in Architecture doc. This section summarizes risks relevant to QA test planning.

### High-Priority Risks (Score ≥6)

| Risk ID  | Category | Description                                              | Score | QA Test Coverage                                                    |
| -------- | -------- | -------------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| **R-01** | TECH     | Zero E2E regression — 30 stories, 0 automated tests     | **9** | P0 smoke suite: 8 E2E tests covering all critical user paths        |
| **R-02** | SEC      | JWT isPro stale after rotation                           | **6** | P0 integration: `isPro_persists_after_token_rotation`               |
| **R-03** | SEC      | Stripe webhook replay — duplicate Pro upgrade possible   | **6** | P0 integration: `webhook_replay_is_idempotent`                      |
| **R-04** | DATA     | Badge XP double-award on retry                           | **6** | P0 integration: `xp_award_idempotent_on_duplicate_reference_id`     |
| **R-06** | SEC      | FERPA — minor PII in public leaderboard                  | **6** | P0 E2E: `leaderboard_contains_no_pii_fields`                        |
| **R-07** | TECH     | No test seed API — parallel tests unsafe                 | **6** | Unblocked by seed API; all E2E tests depend on it                   |
| **R-10** | OPS      | No CI pipeline — regressions merge silently              | **6** | All tests run in CI once workflow is configured                      |

### Medium/Low-Priority Risks

| Risk ID  | Category | Description                                              | Score | QA Test Coverage                                                    |
| -------- | -------- | -------------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| R-05     | PERF     | Alpaca rate limit cascade                                | 4     | P3 k6 load test; circuit-breaker mock in integration                |
| R-08     | PERF     | Redis cold start cache miss storm                        | 4     | P3 k6 spike test for market data endpoint                           |
| R-09     | BUS      | Paper trade spread calculation error                     | 4     | P1 unit: `applySpread()` boundary inputs                            |
| R-11     | DATA     | DB migration no rollback                                 | 4     | P2 integration: `migration_down_restores_schema`                    |
| R-13     | TECH     | NextAuth session desync after Pro upgrade                | 4     | P1 integration: `session_reflects_pro_after_stripe_webhook`         |
| R-12     | TECH     | `canvas.toBlob` null — badge share fails                 | 2     | P2 unit: `canvas_toBlob_null_rejects_promise` (patched T2.12)       |
| R-14     | PERF     | Claude streaming failure under load                      | 2     | P3 Phase 3 deferred                                                 |
| R-15     | OPS      | No structured logging                                    | 4     | Manual OPS validation; P3 monitoring check                          |
| R-16     | BUS      | `xp_reward` null in lesson response                      | 2     | P2 unit: `xp_reward_null_returns_zero` (patched T2.13)              |

---

## Entry Criteria

**QA testing cannot begin until ALL of the following are met:**

- [ ] All P0 requirements and assumptions agreed by QA, Dev, PM
- [ ] Test environments provisioned: local Docker Compose + CI service containers
- [ ] Test data factories implemented and auto-cleanup fixtures working
- [ ] `POST /api/v1/test/seed` and `DELETE /api/v1/test/teardown` endpoints available in test env
- [ ] Playwright scaffold (`playwright.config.ts`) committed and running locally
- [ ] GitHub Actions CI workflow configured (lint → unit → E2E shards)
- [ ] Feature deployed to test environment

## Exit Criteria

**Testing phase is complete when ALL of the following are met:**

- [ ] All 8 P0 tests passing in CI
- [ ] All 12 P1 tests passing or failures triaged and deferred (≥95% pass rate)
- [ ] No open P0 or P1 severity bugs
- [ ] R-01 mitigated: Playwright CI pipeline green on main
- [ ] R-06 mitigated: FERPA leaderboard test passing + PM sign-off
- [ ] Coverage ≥80% of P0/P1 requirements mapped to passing tests

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority and risk level** (what to focus on if time-constrained), NOT execution timing. See "Execution Strategy" for when tests run.

---

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (≥6) + No workaround + Affects majority of users

| Test ID      | Requirement                                                      | Test Level  | Risk Link | Notes                                            |
| ------------ | ---------------------------------------------------------------- | ----------- | --------- | ------------------------------------------------ |
| **P0-001**   | Student can log in with valid credentials and reach dashboard    | E2E         | R-01      | Auth storage state; verify JWT in localStorage   |
| **P0-002**   | Student executes a paper trade (buy AAPL) — fills at ±0.1% spread | E2E        | R-01, R-09| Verify portfolio updated; XP awarded             |
| **P0-003**   | XP award is idempotent — duplicate reference_id returns conflict  | Integration | R-04      | Call `POST /xp/award` twice; assert DB row count = 1 |
| **P0-004**   | JWT isPro persists after token rotation                          | Integration | R-02      | Rotate token; decode new JWT; assert `isPro = true` |
| **P0-005**   | Badge unlocks fire exactly once on threshold crossing            | Integration | R-04      | Complete 10 trades; verify badge row count = 1   |
| **P0-006**   | Public leaderboard response contains no PII fields               | E2E         | R-06      | Assert no `email`, `full_name` keys in response  |
| **P0-007**   | Pro module gating returns 403 for free-tier students             | Integration | R-02      | Free-tier token → `GET /api/v1/modules/pro-content` → 403 |
| **P0-008**   | Stripe webhook replayed returns 200 without re-processing        | Integration | R-03      | POST same webhook event_id twice; subscription row = 1 |

**Total P0:** ~8 tests

---

### P1 (High)

**Criteria:** Important features + Medium risk (3–4) + Common workflows + Workaround exists but difficult

| Test ID      | Requirement                                                          | Test Level  | Risk Link | Notes                                                  |
| ------------ | -------------------------------------------------------------------- | ----------- | --------- | ------------------------------------------------------ |
| **P1-001**   | Student registers, verifies email, and completes onboarding          | E2E         | R-01      | Full registration flow to dashboard                    |
| **P1-002**   | Leaderboard sorted correctly after multiple trades                   | Integration | R-01      | Seed 3 users with known portfolio values; assert rank order |
| **P1-003**   | Market quote cached for 30s — second request hits Redis, not Alpaca  | Integration | R-08      | Spy on Alpaca call count; verify = 1 for 2 requests within 30s |
| **P1-004**   | Learning module completion awards XP and unlocks next lesson         | E2E         | R-01      | Complete lesson → assert XP row in DB + next lesson unlocked |
| **P1-005**   | `applySpread()` returns price within ±0.1% of market price           | Unit        | R-09      | Boundary: exact 0.1%, above 0.1%, zero price           |
| **P1-006**   | Session reflects `isPro = true` after Stripe webhook success         | Integration | R-13      | Fire `customer.subscription.updated` webhook → fetch session → assert isPro |
| **P1-007**   | Badge card generates without error on Chrome, Firefox, Safari        | Component   | R-12      | Render canvas; assert blob non-null; roundRect shim active on missing support |
| **P1-008**   | Notification bell unread count increments on new XP event            | Component   | R-01      | Mount `NotificationBell`; dispatch XP event; assert badge count +1 |
| **P1-009**   | Streak counter increments on consecutive daily logins                | Integration | R-01      | Seed user with yesterday's login; login today; assert streak = 2 |
| **P1-010**   | Quiz submission awards XP exactly once (no double-fire from streak)  | Integration | R-04      | Submit quiz → assert one XP row, one streak row        |
| **P1-011**   | Redis cache hit rate ≥80% under normal load                          | Integration | R-08      | 10 sequential quote requests; count Alpaca calls ≤ 2   |
| **P1-012**   | DB migration `down()` restores schema to prior state                 | Integration | R-11      | Run latest migration up + down; assert table structure matches pre-migration snapshot |

**Total P1:** ~12 tests

---

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1–2) + Edge cases + Regression prevention

| Test ID      | Requirement                                                               | Test Level  | Risk Link | Notes                                               |
| ------------ | ------------------------------------------------------------------------- | ----------- | --------- | --------------------------------------------------- |
| **P2-001**   | `canvas.toBlob` null rejection is handled — promise rejects with message  | Unit        | R-12      | Mock `toBlob` to call callback with `null`; assert reject |
| **P2-002**   | `roundRect` shim draws correct path in browsers without native support    | Unit        | R-12      | Mock `ctx.roundRect = undefined`; call `roundedRect()`; assert `moveTo` called |
| **P2-003**   | Badge download uses body-appended anchor (Firefox fallback)               | Unit        | R-12      | Spy `document.body.appendChild`; trigger download path; assert called |
| **P2-004**   | `URL.revokeObjectURL` is deferred 100ms after download anchor click       | Unit        | R-12      | Use fake timers; assert revoke not called immediately; advance 100ms → called |
| **P2-005**   | Web Share API `AbortError` is swallowed silently (user cancel)            | Unit        | R-12      | Mock `navigator.share` to throw `AbortError`; assert no console.error |
| **P2-006**   | "Mark all read" button is always rendered, disabled when unread = 0       | Component   | R-01      | Mount `NotificationBell` with 0 notifications; assert button present + disabled |
| **P2-007**   | `isPro` 403 is distinguished from 500 in Pro module error UI              | Unit        | R-02      | Mock `error.response.status = 403`; assert paywall shown, not error toast |
| **P2-008**   | `xp_reward` null in lesson API response renders as 0 XP in UI            | Unit        | R-16      | Mock lesson with `xp_reward: null`; assert "0 XP" in rendered output |

**Total P2:** ~8 tests

---

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Performance benchmarks + Documentation validation

| Test ID      | Requirement                                                               | Test Level  | Notes                                                     |
| ------------ | ------------------------------------------------------------------------- | ----------- | --------------------------------------------------------- |
| **P3-001**   | API p95 response time < 200ms under 50 concurrent users                   | Performance | k6 load test; `POST /api/v1/trades` + `GET /api/v1/portfolio` |
| **P3-002**   | Redis cache hit rate ≥80% under 100 req/min market quote load             | Performance | k6 spike on `GET /api/v1/market/quote?symbol=AAPL`        |
| **P3-003**   | Leaderboard renders correctly with 1,000 seeded users                     | Performance | k6 VU test; assert p95 < 500ms for leaderboard query      |
| **P3-004**   | Alpaca circuit-breaker returns cached stale data on external service outage | Exploratory | Mock Alpaca to timeout; assert stale Redis value returned with 200 |

**Total P3:** ~4 tests

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless there's significant infrastructure overhead. Playwright with 2 shards runs ~32 tests in under 12 minutes.

### Every PR: Playwright + Vitest (~10–12 min)

All functional tests:

- Vitest unit tests (`pnpm --filter api test` + `pnpm --filter web test`) — ~3 min
- Playwright E2E + API integration tests (2 shards) — ~8 min
- Total: ~32 scenarios (P0, P1, P2, and select P3 exploratory)

**Why in PRs:** Fast feedback, no expensive infrastructure

### Nightly: k6 Performance Tests (~30–45 min)

All performance benchmarks:

- P3-001: API p95 load test (`--vus 50 --duration 5m`)
- P3-002: Redis cache hit rate spike test
- P3-003: Leaderboard 1,000-user query performance

**Why defer to nightly:** Requires k6 Cloud or dedicated runner; 5–10 min per test; not useful per-PR

### Weekly: Chaos & Long-Running (~1–2 hours)

- P3-004: Alpaca circuit-breaker exploratory (requires network-level mock infrastructure)
- R-11 DB migration rollback validation (full DB clone required)
- Manual: DevOps deployment validation, monitoring alerts, cost check

**Why defer to weekly:** Infrastructure setup time exceeds PR cycle; infrequent validation is sufficient

---

## QA Effort Estimate

**QA test development effort only** (excludes DevOps CI setup, Backend seed API, DB migrations):

| Priority  | Count | Effort Range        | Notes                                                         |
| --------- | ----- | ------------------- | ------------------------------------------------------------- |
| P0        | ~8    | ~25–40 hours        | Auth storage, seed fixtures, security scenarios, Stripe mock  |
| P1        | ~12   | ~30–50 hours        | Service contracts, Redis spy, migration test, E2E flows       |
| P2        | ~8    | ~10–20 hours        | Edge cases, browser compat unit tests, component mounts       |
| P3        | ~4    | ~8–15 hours         | k6 scripts, exploratory design                                |
| Scaffold  | —     | ~15–25 hours        | Playwright config, factory setup, auth fixtures, CI integration|
| **Total** | ~32   | **~88–150 hours**   | **1 QA engineer, ~3–4 weeks full-time**                       |

**Assumptions:**

- Includes test design refinement, implementation, debugging, CI integration
- Excludes ongoing maintenance (~10% effort per quarter)
- Assumes seed API (R-07) and CI pipeline (R-10) blockers resolved before authoring begins
- Assumes existing Vitest setup in `apps/api` and `apps/web` continues to pass

---

## Implementation Planning Handoff

| Work Item                                    | Owner        | Target Milestone      | Dependencies / Notes                            |
| -------------------------------------------- | ------------ | --------------------- | ----------------------------------------------- |
| Playwright scaffold + auth fixtures          | QA           | Before T3 sprint      | Depends on seed API (Backend)                   |
| Test data factories (User, Portfolio, Trade) | QA           | Before T3 sprint      | Depends on seed API                             |
| P0 smoke suite (8 tests)                     | QA           | T3 sprint, Week 1     | Unblocked by scaffold + seed API                |
| GitHub Actions CI workflow                   | DevOps       | Before T3 sprint      | Unblocks all PR-gating value                    |
| `xp_events` idempotency migration            | Backend      | T3 sprint             | Unblocks P0-003, P0-005, P1-010                 |
| Stripe webhook idempotency table             | Backend      | T3 sprint             | Unblocks P0-008                                 |
| P1 integration tests (12 tests)              | QA           | T3 sprint, Week 2     | Depends on P0 suite complete                    |
| P2 unit + component tests (8 tests)          | QA           | T3 sprint, Week 2–3   | Largely independent; no blockers                |
| k6 performance scripts (P3, 4 tests)         | QA           | Post-T3 sprint        | Nightly runner setup by DevOps                  |
| FERPA leaderboard PM sign-off                | PM + Backend | Before Phase 1 GA     | P0-006 must pass first                          |

---

## Tooling & Access

| Tool or Service           | Purpose                                  | Access Required                      | Status  |
| ------------------------- | ---------------------------------------- | ------------------------------------ | ------- |
| Playwright                | E2E + API integration tests              | `pnpm add -D @playwright/test`       | Ready   |
| Vitest                    | Unit + component tests                   | Already installed in both apps       | Ready   |
| k6                        | Performance / load testing               | k6 CLI install; k6 Cloud account     | Pending |
| Stripe CLI (test mode)    | Webhook replay for R-03 test             | `stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe` | Pending |
| Alpaca Sandbox            | Market data mock in test env             | Free sandbox API key                 | Pending |
| Faker.js                  | Test data generation in factories        | `pnpm add -D @faker-js/faker`        | Pending |

**Access requests needed:**

- [ ] k6 Cloud account (for nightly performance runs)
- [ ] Stripe test-mode API keys in CI secrets (`STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST`)
- [ ] Alpaca sandbox keys in CI secrets (`ALPACA_API_KEY_SANDBOX`, `ALPACA_API_SECRET_SANDBOX`)

---

## Interworking & Regression

| Service/Component       | Impact                                      | Regression Scope                                    | Validation Steps                                           |
| ----------------------- | ------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| **Express API**         | All test scenarios depend on API correctness | Existing 74 Vitest API tests must stay green         | `pnpm --filter api test` in CI                             |
| **Next.js web app**     | E2E and component tests run against web app  | Existing 99 Vitest web tests must stay green         | `pnpm --filter web test` in CI                             |
| **PostgreSQL**          | All integration tests use test DB            | Migration up/down must not break existing schema     | Migration CI step; P1-012 rollback test                    |
| **Redis**               | Cache tests depend on Redis state            | Flush before each test run in CI                     | `redis-cli FLUSHDB` in CI setup step                       |
| **NextAuth / JWT**      | Auth tests depend on token structure         | `refreshAccessToken()` must re-decode `isPro` (patched) | P0-004 integration test                                  |
| **Stripe webhooks**     | Pro subscription gating depends on webhooks  | Webhook handler must be idempotent                   | P0-008 replay test                                         |

**Regression test strategy:**

- All 74 API + 99 web Vitest tests must pass on every PR (already established baseline)
- P0 E2E + integration suite (8 tests) must pass before any T3 story merges
- Full P0+P1 suite (20 tests) must pass before Phase 1 GA release
- `pnpm --filter api test && pnpm --filter web test` gates established in CI before T3 sprint

---

## Appendix A: Code Examples & Tagging

**Playwright Tags for Selective Execution:**

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

test('@P0 @E2E @Auth student can log in and reach dashboard', async ({ page, request }) => {
  const student = createStudent();
  await request.post('/api/v1/test/seed', { data: { users: [student] } });

  await page.goto('/login');
  await page.fill('[data-testid="email"]', student.email);
  await page.fill('[data-testid="password"]', student.password);

  const loginPromise = page.waitForResponse('**/api/v1/auth/login');
  await page.click('[data-testid="login-button"]');
  await loginPromise;

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText(`Welcome`)).toBeVisible();

  await request.delete('/api/v1/test/teardown', { data: { email: student.email } });
});
```

```typescript
// tests/integration/xp-idempotency.spec.ts
import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

test('@P0 @Integration @Security XP award is idempotent on duplicate reference_id', async ({ request }) => {
  const student = createStudent();
  const seedRes = await request.post('/api/v1/test/seed', { data: { users: [student] } });
  const { data: { userId } } = await seedRes.json();

  const loginRes = await request.post('/api/v1/auth/login', {
    data: { email: student.email, password: student.password },
  });
  const { data: { accessToken } } = await loginRes.json();

  const xpPayload = { event_type: 'trade_complete', reference_id: 'trade-abc-123', xp_amount: 10 };

  const res1 = await request.post('/api/v1/xp/award', {
    data: xpPayload,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res1.status()).toBe(201);

  const res2 = await request.post('/api/v1/xp/award', {
    data: xpPayload,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res2.status()).toBe(409); // Conflict — idempotent

  await request.delete('/api/v1/test/teardown', { data: { email: student.email } });
});
```

```typescript
// tests/integration/leaderboard-pii.spec.ts
import { test, expect } from '@playwright/test';

test('@P0 @E2E @Security leaderboard contains no PII fields', async ({ request }) => {
  const res = await request.get('/api/v1/leaderboard');
  expect(res.status()).toBe(200);

  const { data: entries } = await res.json();
  for (const entry of entries) {
    expect(entry).not.toHaveProperty('email');
    expect(entry).not.toHaveProperty('full_name');
    expect(entry).not.toHaveProperty('date_of_birth');
    expect(entry).toHaveProperty('display_name');
  }
});
```

**Run specific tags:**

```bash
# Run only P0 tests
npx playwright test --grep @P0

# Run P0 + P1 tests
npx playwright test --grep "@P0|@P1"

# Run only security tests
npx playwright test --grep @Security

# Run all tests in PR (default)
npx playwright test

# Shard for CI
npx playwright test --shard=1/2
npx playwright test --shard=2/2
```

---

## Appendix B: Knowledge Base References

- **Risk Governance**: `risk-governance.md` — Risk scoring methodology (P×I matrix)
- **Test Priorities Matrix**: `test-priorities-matrix.md` — P0–P3 criteria
- **Test Levels Framework**: `test-levels-framework.md` — E2E vs API vs Unit selection
- **Test Quality**: `test-quality.md` — Definition of Done (no hard waits, <300 lines, <1.5 min per test)
- **Auth Session Fixtures**: `auth-session.md` — `storageState` pattern for NextAuth
- **Network-First Pattern**: `network-first.md` — Intercept before action to avoid flakiness
- **Data Factories**: `data-factories.md` — Faker-based factory patterns

---

**Generated by:** BMad TEA Agent
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
