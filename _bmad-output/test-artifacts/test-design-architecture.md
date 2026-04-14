---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-12'
workflowType: 'testarch-test-design'
inputDocuments: ['docs/prd.md', 'docs/architecture.md', 'docs/epics.md', 'docs/stories/sprint-status.yaml']
---

# Test Design for Architecture: StockPlay

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-04-12
**Author:** Quinn (BMad QA / TEA Test Architect)
**Status:** Architecture Review Pending
**Project:** StockPlay — Student Investing App
**PRD Reference:** docs/prd.md (65 FRs, 8 NFRs)
**ADR Reference:** docs/architecture.md

---

## Executive Summary

**Scope:** Full system test design for StockPlay Phase 1 + Phase 2 foundation. Threads 1 and 2 (30 stories) are implemented and deployed; Threads 3 and 4 remain in backlog. This document covers regression safety for T1–T2 and forward-looking test architecture for T3–T4.

**Business Context** (from PRD):

- **Revenue/Impact:** Stripe Student Pro subscription ($4.99/mo); gamified engagement drives retention
- **Problem:** Students have no safe, educational paper-trading environment with AI coaching
- **GA Launch:** Phase 1 complete; Phase 2 (T3–T4) targeting next sprint cycle

**Architecture** (from docs/architecture.md):

- **Key Decision 1:** API-first monorepo — Express REST API (`/api/v1/*`) + Next.js 14 App Router, JWT auth
- **Key Decision 2:** Redis for market-quote caching (30s TTL) and leaderboard sorted sets
- **Key Decision 3:** Paper trades fill at market price ±0.1% simulated spread; XP events are immutable audit rows

**Expected Scale:**

- 100–10,000 concurrent student users (Phase 1–2); real-time market data via Alpaca + CoinGecko

**Risk Summary:**

- **Total risks**: 15
- **High-priority (≥6)**: 6 risks requiring immediate mitigation
- **Test effort**: ~98–160 hours (~3–4 weeks for 1 QA)

---

## Quick Guide

### 🚨 BLOCKERS — Team Must Decide (Can't Proceed Without)

**Pre-Implementation Critical Path** — these MUST be completed before QA can write integration or E2E tests:

1. **R-01: Zero E2E regression coverage** — 30 stories shipped with no automated regression suite; any refactor is invisible. Dev team must unblock `POST /api/v1/test/seed` endpoint (or equivalent factory pattern) and Playwright scaffold before QA can begin. (Owner: Backend + QA)
2. **R-07: No test data seeding API** — parallel E2E tests will conflict on shared DB state without isolated seed/teardown. Architecture must expose a test-mode seeding route or support per-test DB transactions. (Owner: Backend)
3. **R-10: No CI pipeline** — zero automated gates on PRs means regressions merge silently. DevOps must configure GitHub Actions with `pnpm test` + Playwright runs before QA test authoring begins. (Owner: DevOps)

**What we need from team:** Resolve these 3 items before QA test development starts.

---

### ⚠️ HIGH PRIORITY — Team Should Validate (We Provide Recommendation, You Approve)

1. **R-02: JWT isPro stale after token rotation** — Patched in T2.13 code review; verify `refreshAccessToken()` correctly re-decodes `isPro` from rotated access token in production. (Owner: Backend, validate in T3 sprint)
2. **R-03: Stripe webhook replay attacks** — Webhook signature verification (`stripe.webhooks.constructEvent`) must be confirmed in production handler. Risk: duplicate Pro upgrades or fraudulent downgrades. (Owner: Backend)
3. **R-06: FERPA — minor PII in leaderboard** — Public leaderboard must not expose full name or email for users under 18. Review leaderboard query and response shape. (Owner: Backend + PM)
4. **R-04: Badge XP idempotency** — Double XP awards possible on client retry or network error. Confirm `xp_events` idempotency key is enforced at DB level. (Owner: Backend)

**What we need from team:** Review each recommendation and confirm (or escalate if incorrect).

---

### 📋 INFO ONLY — Solutions Provided (Review, No Decisions Needed)

1. **Test strategy**: E2E for critical user journeys; API/integration for service contracts; unit for pure logic (portfolio math, XP calculation)
2. **Tooling**: Playwright (E2E + API integration), Vitest (unit), k6 (NFR performance)
3. **Tiered CI/CD**: Every PR < 15 min (Playwright, parallelized); Nightly (k6 load tests); Weekly (chaos/endurance)
4. **Coverage**: ~32 test scenarios prioritized P0–P3, risk-linked
5. **Quality gates**: P0 = 100% pass; P1 ≥ 95% pass; no open high-severity bugs on release

**What we need from team:** Acknowledge and proceed.

---

## For Architects and Devs — Open Topics 👷

### Risk Assessment

**Total risks identified**: 15 (6 high-priority score ≥6, 5 medium, 4 low)

#### High-Priority Risks (Score ≥6) — IMMEDIATE ATTENTION

| Risk ID  | Category | Description                                                                   | Probability | Impact | Score | Mitigation                                                       | Owner          | Timeline          |
| -------- | -------- | ----------------------------------------------------------------------------- | ----------- | ------ | ----- | ---------------------------------------------------------------- | -------------- | ----------------- |
| **R-01** | **TECH** | Zero automated E2E regression coverage — 30 shipped stories, 0 regression tests | **3**      | **3**  | **9** | Scaffold Playwright + seed API; write P0 suite before T3 starts  | Backend + QA   | Before T3 sprint  |
| **R-02** | **SEC**  | JWT isPro stale after token rotation — Pro features accessible post-downgrade  | **2**       | **3**  | **6** | Confirm re-decode of `isPro` from rotated token in prod          | Backend        | T3 sprint         |
| **R-03** | **SEC**  | Stripe webhook not verified — replay or forged upgrade/downgrade events possible | **2**      | **3**  | **6** | Enforce `stripe.webhooks.constructEvent` + idempotency key       | Backend        | T3 sprint         |
| **R-04** | **DATA** | Badge XP double-award on retry — `xp_events` not idempotency-key enforced      | **2**       | **3**  | **6** | Add unique constraint on `(user_id, event_type, reference_id)`   | Backend        | T3 sprint         |
| **R-06** | **SEC**  | FERPA — minor PII (full name/email) exposed in public leaderboard response      | **2**       | **3**  | **6** | Strip PII from leaderboard query; return display name only       | Backend + PM   | Before GA release |
| **R-07** | **TECH** | No test data seeding API — E2E tests share live DB, parallel execution unsafe   | **3**       | **2**  | **6** | Expose `POST /api/v1/test/seed` (test-env only) + auto-teardown  | Backend        | Before T3 sprint  |
| **R-10** | **OPS**  | No CI pipeline — regressions merge without any automated gate                   | **3**       | **2**  | **6** | Configure GitHub Actions: unit + Playwright + lint on every PR   | DevOps         | Before T3 sprint  |

#### Medium-Priority Risks (Score 3–5)

| Risk ID  | Category | Description                                                         | Probability | Impact | Score | Mitigation                                                        | Owner   |
| -------- | -------- | ------------------------------------------------------------------- | ----------- | ------ | ----- | ----------------------------------------------------------------- | ------- |
| **R-05** | **PERF** | Alpaca/CoinGecko rate limit cascade — market data outage causes 500s | 2           | 2      | 4     | Circuit-breaker + stale cache fallback with `Cache-Control: stale` | Backend |
| **R-08** | **PERF** | Redis cold start — cache miss storm causes N×external API calls     | 2           | 2      | 4     | Cache warm-up job on service start; rate-limit Alpaca calls        | Backend |
| **R-09** | **BUS**  | Paper trade spread calculation error — silent incorrect fill prices  | 2           | 2      | 4     | Unit test `applySpread()` with boundary inputs                     | QA      |
| **R-11** | **DATA** | DB migration with no rollback — schema change bricks prod on failure | 2           | 2      | 4     | Enforce `down()` migration for every `up()` in CI migration check  | Backend |
| **R-13** | **TECH** | NextAuth session/JWT desync — `isPro` shows stale post Pro upgrade   | 2           | 2      | 4     | Force session refresh on Stripe webhook success event              | Backend |

#### Low-Priority Risks (Score 1–2)

| Risk ID  | Category | Description                                                              | Probability | Impact | Score | Action   |
| -------- | -------- | ------------------------------------------------------------------------ | ----------- | ------ | ----- | -------- |
| **R-12** | **TECH** | `canvas.toBlob` null in some browsers — badge card share silently fails  | 2           | 1      | 2     | Patched in T2.12; monitor browser compat reports |
| **R-14** | **PERF** | Claude AI streaming failure under load — Phase 3 coach unavailable       | 1           | 2      | 2     | Phase 3 concern; add retry + graceful degradation message           |
| **R-15** | **OPS**  | No structured logging/monitoring — incidents invisible until user reports | 2           | 2      | 4     | Add `pino` structured logs + Datadog/Sentry (Phase 2 OPS story)    |
| **R-16** | **BUS**  | xp_reward null in lesson response — XP badge shows "0 XP" silently      | 2           | 1      | 2     | Patched in T2.13; DB column should have NOT NULL default = 0        |

#### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS — Architecture Team Must Address**

#### 1. Blockers to Fast Feedback

| Concern                            | Impact on Testing                                         | What Architecture Must Provide                                          | Owner        | Timeline         |
| ---------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ------------ | ---------------- |
| **No test data seeding endpoint**  | E2E tests cannot seed isolated users/portfolios/trades    | `POST /api/v1/test/seed` (enabled in `NODE_ENV=test` only) + teardown   | Backend      | Before T3 sprint |
| **No CI pipeline**                 | Tests only run locally; regressions merge undetected      | GitHub Actions workflow: lint → unit → Playwright (parallelized)        | DevOps       | Before T3 sprint |
| **No Playwright scaffold**         | QA cannot write or run E2E tests without base config      | `apps/web/playwright.config.ts` with base URL, fixtures, auth storage   | QA + Backend | Before T3 sprint |

#### 2. Architectural Improvements Needed

1. **Test-mode seed/teardown API**
   - **Current problem**: `apps/api` has no endpoint for seeding test users, portfolios, trades, or XP events
   - **Required change**: Add `POST /api/v1/test/seed` + `DELETE /api/v1/test/teardown` behind `NODE_ENV === 'test'` guard
   - **Impact if not fixed**: E2E tests run against shared data, cannot parallelize, tests are order-dependent
   - **Owner**: Backend
   - **Timeline**: Before T3 sprint

2. **Idempotency key on `xp_events`**
   - **Current problem**: No unique constraint on `(user_id, event_type, reference_id)` — double-award possible on API retry
   - **Required change**: `ALTER TABLE xp_events ADD CONSTRAINT xp_events_idempotent UNIQUE (user_id, event_type, reference_id)`
   - **Impact if not fixed**: Badge XP awards inflate silently; leaderboard scores become invalid
   - **Owner**: Backend
   - **Timeline**: T3 sprint

3. **Stripe webhook idempotency**
   - **Current problem**: Webhook handler does not persist processed event IDs — replay attack window open
   - **Required change**: Store `stripe_event_id` with unique constraint; skip already-processed events
   - **Impact if not fixed**: Pro subscription status can be manipulated; duplicate upgrades or downgrades
   - **Owner**: Backend
   - **Timeline**: T3 sprint

---

### Testability Assessment Summary

**📊 CURRENT STATE — FYI**

#### What Works Well

- ✅ API-first design with versioned REST endpoints (`/api/v1/*`) supports API-level integration testing without UI
- ✅ JWT auth pattern is testable — QA can obtain tokens via `POST /api/v1/auth/login` programmatically
- ✅ Redis sorted sets for leaderboard are deterministic — state is observable via API response
- ✅ XP events as immutable audit rows — database state verifiable without side effects
- ✅ Vitest already configured in `apps/api` (74 passing) and `apps/web` (99 passing) — unit test baseline exists

#### Accepted Trade-offs (No Action Required)

For StockPlay Phase 1–2, the following are acceptable:

- **No contract testing (Pact)** — single consumer/provider pair with no external consumers; API contract is internal and easily validated via integration tests
- **No visual regression baseline** — UI is in active development; visual regression would require constant snapshot updates; deferred to post-Phase 2 GA

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

#### R-01: Zero E2E regression coverage (Score: 9) — BLOCK

**Mitigation Strategy:**

1. Backend exposes `POST /api/v1/test/seed` endpoint (test-env only) for user/portfolio/trade seeding
2. QA scaffolds `apps/web/playwright.config.ts` with baseURL, auth storage state, and 2 parallel shards
3. QA writes P0 smoke suite (8 tests: login, paper trade, XP award, badge unlock, leaderboard, Pro gate, JWT rotation, FERPA) before T3 sprint begins
4. GitHub Actions CI runs Playwright on every PR (`pnpm --filter web test:e2e`)
5. All T1+T2 P0 scenarios passing before any T3 story is merged

**Owner:** QA (scaffold + tests) + Backend (seed API) + DevOps (CI)
**Timeline:** Before T3 sprint kick-off
**Status:** Planned
**Verification:** GitHub Actions shows green Playwright run on a T3 PR; all 8 P0 tests pass

---

#### R-02: JWT isPro stale after token rotation (Score: 6) — MITIGATE

**Mitigation Strategy:**

1. Confirm `refreshAccessToken()` in `apps/web/lib/auth.ts` re-decodes `isPro` from rotated `accessToken` JWT payload (patched in T2.13 code review)
2. Add integration test: Pro user token rotates → `isPro` remains `true` in session
3. Add integration test: Pro user downgrades via Stripe → next token rotation reflects `isPro = false`

**Owner:** Backend
**Timeline:** T3 sprint
**Status:** Patch applied; integration test pending
**Verification:** Integration test `isPro_persists_after_rotation` passes in CI

---

#### R-03: Stripe webhook replay attacks (Score: 6) — MITIGATE

**Mitigation Strategy:**

1. Confirm `stripe.webhooks.constructEvent(rawBody, sig, secret)` is called in webhook handler with raw body (not parsed JSON)
2. Add `processed_webhook_events` table with `(stripe_event_id TEXT UNIQUE NOT NULL)` to prevent replay
3. Integration test: replay same webhook event twice → second call returns 200 (idempotent) but does not re-process

**Owner:** Backend
**Timeline:** T3 sprint
**Status:** Planned
**Verification:** Integration test `webhook_replay_is_idempotent` passes; no duplicate `subscriptions` row created

---

#### R-04: Badge XP double-award (Score: 6) — MITIGATE

**Mitigation Strategy:**

1. Add migration: `UNIQUE (user_id, event_type, reference_id)` on `xp_events` table
2. API `POST /api/v1/xp/award` returns `409 Conflict` on duplicate (not `500`)
3. Unit test: `awardXP()` called twice with same reference_id → second call returns `{ duplicate: true }`
4. Integration test: parallel trade completions → XP awarded exactly once

**Owner:** Backend
**Timeline:** T3 sprint
**Status:** Planned
**Verification:** Unit and integration tests pass; DB constraint confirmed in migration

---

#### R-06: FERPA — minor PII in leaderboard (Score: 6) — MITIGATE

**Mitigation Strategy:**

1. Audit leaderboard API response: remove `email`, `full_name`, `date_of_birth` from public response
2. Return `display_name` (user-chosen) and `avatar_url` only
3. For users under 18 (if `date_of_birth` stored): verify `display_name` cannot be reverse-mapped to real identity
4. E2E test: unauthenticated request to `/api/v1/leaderboard` → response contains no `email` or `full_name` fields

**Owner:** Backend + PM
**Timeline:** Before GA release (Phase 1)
**Status:** Planned
**Verification:** E2E test `leaderboard_contains_no_pii` passes; PM confirms compliance

---

#### R-07: No test data seeding API (Score: 6) — MITIGATE

**Mitigation Strategy:**

1. Add `POST /api/v1/test/seed` handler (blocked by `NODE_ENV !== 'test'`)
2. Accepts seed spec: `{ users, portfolios, trades, xpEvents, badges }` — returns created entity IDs
3. Add `DELETE /api/v1/test/teardown` to clean up seeded data by test run ID
4. QA uses seed API in Playwright `beforeEach` / `afterEach` fixtures

**Owner:** Backend
**Timeline:** Before T3 sprint
**Status:** Planned
**Verification:** Playwright test `parallel_e2e_tests_do_not_conflict` passes with 4 workers

---

#### R-10: No CI pipeline (Score: 6) — MITIGATE

**Mitigation Strategy:**

1. Add `.github/workflows/ci.yml`: triggers on PR and push to `main`
2. Steps: `pnpm install` → `pnpm db:migrate` (test DB) → `pnpm --filter api test` → `pnpm --filter web test` → `pnpm --filter web test:e2e --shard=1/2` + `--shard=2/2`
3. Fail PR if any step fails (branch protection rule on `main`)
4. Total target: < 15 min end-to-end

**Owner:** DevOps
**Timeline:** Before T3 sprint
**Status:** Planned
**Verification:** CI green on a sample PR before T3 stories begin merging

---

### Assumptions and Dependencies

#### Assumptions

1. `NODE_ENV=test` is used for the test environment; seed API is gated on this value, never exposed in production
2. Alpaca Markets free-tier rate limits (200 req/min) are sufficient for test environments running against sandbox
3. PostgreSQL test database is a separate instance (not shared with development or production)
4. Stripe test mode keys are available for integration test environment
5. `xp_events.reference_id` is consistently populated by all XP-awarding code paths (required for idempotency key)

#### Dependencies

1. **Backend: test seed API** — required before QA starts E2E test authoring (before T3 sprint kick-off)
2. **DevOps: GitHub Actions CI workflow** — required before T3 stories begin merging
3. **Backend: `xp_events` idempotency migration** — required before T3 XP features ship
4. **Backend: Stripe webhook idempotency table** — required before T3 Stripe Pro features ship
5. **PM: FERPA leaderboard sign-off** — required before Phase 1 GA release

#### Risks to Plan

- **Risk**: Seed API exposes test data routes in production due to misconfigured `NODE_ENV`
  - **Impact**: Data integrity attack surface; potential PII exposure
  - **Contingency**: Add IP allowlist + API key guard in addition to `NODE_ENV` check; integration test verifies routes return 404 in non-test env

- **Risk**: CI pipeline adds >15 min to PR cycle time
  - **Impact**: Developer velocity degrades; CI bypass pressure
  - **Contingency**: Playwright shard to 4 workers; vitest in-band parallel workers; skip DB migration on non-schema PRs via path filter

---

**End of Architecture Document**

**Next Steps for Architecture Team:**

1. Review Quick Guide and prioritize the 3 blockers (R-01, R-07, R-10)
2. Assign owners and timelines for high-priority risks (R-02, R-03, R-04, R-06)
3. Validate FERPA assumption with PM/Legal
4. Provide feedback to QA on testability gaps before T3 sprint

**Next Steps for QA Team:**

1. Wait for seed API (R-07) and CI pipeline (R-10) to be unblocked
2. Refer to companion QA doc (`test-design-qa.md`) for test scenarios
3. Begin Playwright scaffold and factory setup in parallel
