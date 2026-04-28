# Story T5.1: QA Scaffold, Test Seed API, and CI Pipeline

**Status:** done
**Epic:** Thread 5 — QA Catch-up
**Sprint Key:** t5-1-qa-scaffold-and-ci-pipeline
**Date Prepared:** 2026-04-16

---

## Story

As a developer,
I want a Playwright E2E scaffold, a test-only seed/teardown API, and a GitHub Actions CI pipeline,
So that all future QA stories have a safe, isolated, repeatable foundation to run against.

---

## Acceptance Criteria

**AC1 — Playwright scaffold installed and runnable**
**Given** the project root
**When** `pnpm --filter web exec playwright test --list` is run
**Then** it outputs the test list without errors; `apps/web/playwright.config.ts` exists with `baseURL: 'http://localhost:3000'`, `storageState` auth setup, and 2-shard configuration

**AC2 — Test seed API endpoint available in test environment**
**Given** `NODE_ENV=test`
**When** `POST /api/v1/test/seed` is called with a user payload
**Then** the user is created in the DB and the response returns `{ userId, email }`; the endpoint returns 404 in `NODE_ENV=production` or `NODE_ENV=development`

**AC3 — Test teardown API endpoint cleans up isolated state**
**Given** a seeded test user
**When** `DELETE /api/v1/test/teardown` is called with `{ email }`
**Then** all rows for that user are removed from `users`, `portfolios`, `trades`, `xp_events`, `user_badges`, `user_lesson_progress`, `streaks`; response is `{ ok: true }`; the endpoint returns 404 outside `NODE_ENV=test`

**AC4 — Auth storage state fixture works**
**Given** the Playwright scaffold
**When** the auth fixture runs
**Then** it seeds a student via the seed API, logs in via credentials, and stores `storageState` to `playwright/.auth/student.json`; subsequent tests reuse this state without re-logging in

**AC5 — Test data factories implemented**
**Given** `tests/fixtures/factories.ts`
**When** `createStudent()`, `createTrade()`, `createPortfolio()` are called
**Then** they return valid objects with faker-generated fields; all factories have TypeScript types matching `@student-investing/shared-types`

**AC6 — GitHub Actions CI workflow runs on every PR**
**Given** a PR is opened against `main`
**When** the CI workflow triggers
**Then** it runs: lint → `pnpm --filter api test` → `pnpm --filter web test` → Playwright E2E (2 shards); all steps must pass for the PR to be mergeable; Postgres 16 and Redis 7 service containers are provisioned in CI

---

## Tasks / Subtasks

### Task 1 — Install Playwright and configure scaffold [x]

- [x] `pnpm --filter web add -D @playwright/test`
- [x] Create `apps/web/playwright.config.ts` with baseURL, storageState, 2 shards, webServer auto-start
- [x] Create `apps/web/tests/fixtures/` directory with `factories.ts` and `auth.fixture.ts`
- [x] Add `@faker-js/faker` as dev dependency

### Task 2 — Add test seed/teardown API endpoints [x]

- [x] Create `apps/api/src/routes/test.routes.ts` — guard with `if (process.env.NODE_ENV !== 'test') return res.status(404)`
- [x] `POST /api/v1/test/seed` — insert user, portfolio, optional holdings
- [x] `DELETE /api/v1/test/teardown` — cascading delete by email
- [x] Register routes in `apps/api/src/routes/index.ts` under `/test`

### Task 3 — Create test data factories [x]

- [x] `apps/web/tests/fixtures/factories.ts` — `createStudent()`, `createTrade()`, `createPortfolio()`
- [x] `apps/web/tests/fixtures/auth.fixture.ts` — `test.extend` with `studentToken` fixture using seed API + credentials login + storage state

### Task 4 — Create GitHub Actions CI workflow [x]

- [x] Create `.github/workflows/ci.yml`
- [x] Jobs: lint, test-api, test-web, e2e (2 shards)
- [x] Service containers: `postgres:16` with `POSTGRES_DB=studentinvesting_test`, `redis:7`
- [x] Environment: all required secrets from `.env.example`

### Task 5 — Add `.env.test` template [x]

- [x] Create `.env.test.example` at project root with `NODE_ENV=test`, `DATABASE_URL` pointing to test DB, `REDIS_URL`
- [x] Document in `DEVELOPMENT.md` under a new "Running Tests" section

---

## Dev Notes

- Seed/teardown routes MUST check `NODE_ENV === 'test'` — never expose in production
- Use a separate test database (`studentinvesting_test`) to avoid polluting dev data
- Playwright `storageState` avoids re-login on every test — critical for speed
- The 2-shard config halves E2E runtime in CI (~8 min → ~4 min per shard)
- `afterEach` in the auth fixture must call teardown even if the test fails — use `try/finally`

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes

All 5 tasks complete. Full test suites still passing: **154 API tests, 99 web tests — zero regressions**.

- `@playwright/test` + `@faker-js/faker` installed as dev dependencies in `apps/web`
- Chromium browser installed via `playwright install chromium`
- `playwright.config.ts` — baseURL `http://localhost:3000`, 2-shard CI config, `setup` project for auth state, `chromium` project consuming `playwright/.auth/student.json`
- `tests/auth.setup.ts` — seeds stable fixture student (`e2e-fixture@stockplay.test`), logs in via UI, saves `storageState`
- `tests/fixtures/factories.ts` — `createStudent()` (faker email, 20yr-old DOB), `createTrade()`, `createPortfolio()`, `createHolding()`
- `tests/fixtures/auth.fixture.ts` — `test.extend` with `student`, `studentToken`, `apiWithAuth` fixtures; teardown in `try/finally`
- `apps/api/src/routes/test.routes.ts` — `POST /test/seed` (idempotent, bcrypt rounds=4 for speed) + `DELETE /test/teardown` (FK-safe cascade); both 404 outside `NODE_ENV=test`; db import fixed to `../config/db`
- `apps/api/src/routes/index.ts` — test routes registered under `/test`
- `.github/workflows/ci.yml` — lint + test-api + test-web + e2e (2×shard matrix); Postgres 16 + Redis 7 service containers; Playwright report uploaded as artifact
- `.env.test.example` — test DB URL, Playwright env vars
- `DEVELOPMENT.md` — Section 9 "Running Tests" added with unit, E2E, CI, and seed API docs
- `apps/web/playwright/.auth/.gitkeep` + gitignore entries for auth state and reports

### File List

- `apps/web/playwright.config.ts` — **created**
- `apps/web/tests/auth.setup.ts` — **created**
- `apps/web/tests/fixtures/factories.ts` — **created**
- `apps/web/tests/fixtures/auth.fixture.ts` — **created**
- `apps/web/playwright/.auth/.gitkeep` — **created**
- `apps/api/src/routes/test.routes.ts` — **created**
- `apps/api/src/routes/index.ts` — **modified** (import + route registration)
- `.github/workflows/ci.yml` — **created**
- `.env.test.example` — **created**
- `DEVELOPMENT.md` — **modified** (Section 9 added)
- `apps/web/.gitignore` — **modified** (Playwright artifacts)
- `.gitignore` — **modified** (Playwright artifacts)

### Change Log

- 2026-04-17: T5.1 implemented — Playwright scaffold, test seed/teardown API, GitHub Actions CI pipeline
- 2026-04-27: T5.1 code review — 13 patches applied: virtual_cash column name, health URL, API build step, ESLint in lint job, try/finally teardown, seed response shape, quiz ON CONFLICT, playwright shard config removed, router-level NODE_ENV guard, unused baseURL param removed, shared-types for factories, displayName removed, dead 200 check removed
