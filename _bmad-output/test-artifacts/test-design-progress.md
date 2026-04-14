---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-12'
inputDocuments: ['docs/prd.md', 'docs/architecture.md', 'docs/epics.md', 'docs/stories/sprint-status.yaml', '_bmad/tea/config.yaml', 'knowledge/risk-governance.md', 'knowledge/probability-impact.md', 'knowledge/test-levels-framework.md', 'knowledge/test-quality.md']
outputDocuments: ['_bmad-output/test-artifacts/test-design-architecture.md', '_bmad-output/test-artifacts/test-design-qa.md', '_bmad-output/test-artifacts/test-design/StockPlay-handoff.md']
---

# Test Design Progress — StockPlay

## Step 1: Mode Detection

- **Mode selected:** System-Level
- **Reason:** Both PRD+Architecture and Epics+Stories present; rule: prefer System-Level when both available
- **Inputs confirmed:**
  - PRD: docs/prd.md (65 FRs, 8 NFRs)
  - Architecture: docs/architecture.md
  - Epics: docs/epics.md (47 stories, 4 threads)
  - Sprint status: docs/stories/sprint-status.yaml (T1+T2 done, T3+T4 backlog)

## Step 2: Context Loaded

- Stack: fullstack (Next.js 14 + Express + PostgreSQL + Redis)
- Auth: JWT + NextAuth
- Payments: Stripe
- Market data: Alpaca + CoinGecko
- CI: none configured (R-10)
- Existing tests: 74 API + 99 web (Vitest only, no E2E)

## Step 3: Risk Register

- **15 risks identified** — 6 high-priority (≥6), 5 medium (3–5), 4 low (1–2)
- **R-01 BLOCK (score 9):** Zero E2E regression coverage — 30 shipped stories, 0 automated regression tests
- **R-02 (score 6):** JWT isPro stale after token rotation (patched T2.13, needs integration test)
- **R-03 (score 6):** Stripe webhook replay attack — no idempotency table
- **R-04 (score 6):** Badge XP double-award — no idempotency key on xp_events
- **R-06 (score 6):** FERPA — minor PII in public leaderboard
- **R-07 (score 6):** No test seed API — parallel E2E tests unsafe
- **R-10 (score 6):** No CI pipeline — regressions merge silently

## Step 4: Coverage Plan

- **32 test scenarios across P0–P3**
- P0: 8 tests (auth E2E, paper trade E2E, XP idempotency, JWT rotation, badge idempotency, FERPA leaderboard, Pro gate, Stripe replay)
- P1: 12 tests (registration, leaderboard sort, Redis cache, module completion, spread calc unit, session refresh, badge card component, notifications, streak, quiz dedup, cache hit rate, DB migration)
- P2: 8 tests (canvas.toBlob null, roundRect shim, Firefox anchor, URL revoke timing, AbortError swallow, mark-all-read disabled, 403 vs 500 narrowing, xp_reward null)
- P3: 4 tests (API p95 k6, Redis hit rate k6, leaderboard load k6, Alpaca circuit-breaker exploratory)
- **Execution strategy:** PR (Playwright + Vitest, ~10–12 min) / Nightly (k6, ~30–45 min) / Weekly (chaos, manual)
- **Resource estimate:** ~88–150 hours (~3–4 weeks, 1 QA)
- **Quality gates:** P0 = 100%; P1 ≥ 95%; ≥80% PRD FR coverage

## Step 5: Output Generated — COMPLETE ✓

- `_bmad-output/test-artifacts/test-design-architecture.md` (Architecture team doc)
- `_bmad-output/test-artifacts/test-design-qa.md` (QA execution recipe)
- `_bmad-output/test-artifacts/test-design/StockPlay-handoff.md` (BMAD integration handoff)
- Checklist validated: all required sections present, anti-bloat rules followed
- Workflow complete: 2026-04-12
