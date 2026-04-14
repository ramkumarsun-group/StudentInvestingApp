---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments: ['docs/prd.md', 'docs/architecture.md', 'docs/epics.md', 'docs/stories/sprint-status.yaml']
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect (Quinn)'
generatedAt: '2026-04-12'
projectName: 'StockPlay'
---

# TEA → BMAD Integration Handoff

## Purpose

This document bridges TEA's test design outputs with BMAD's epic/story decomposition workflow (`create-epics-and-stories`). It provides structured integration guidance so that quality requirements, risk assessments, and test strategies flow into implementation planning for Threads 3 and 4.

## TEA Artifacts Inventory

| Artifact                   | Path                                                      | BMAD Integration Point                                 |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Architecture Test Design   | `_bmad-output/test-artifacts/test-design-architecture.md` | Epic quality gates, architectural blockers, risk register |
| QA Test Design             | `_bmad-output/test-artifacts/test-design-qa.md`           | Story acceptance criteria, test coverage plan          |
| Risk Assessment            | Embedded in both docs above                               | Epic risk classification, story priority               |
| Coverage Strategy          | `test-design-qa.md` — Test Coverage Plan section          | Story test requirements, P0/P1 acceptance criteria     |

---

## Epic-Level Integration Guidance

### Risk References

The following P0/P1 risks must appear as **epic-level quality gates** when creating T3/T4 epics:

| Risk ID  | Score | Category | Epic-Level Gate                                                                        |
| -------- | ----- | -------- | -------------------------------------------------------------------------------------- |
| **R-01** | 9     | TECH     | **Epic must not ship without Playwright P0 smoke suite green in CI**                   |
| **R-02** | 6     | SEC      | **JWT rotation epic must include `isPro` re-decode integration test as acceptance criteria** |
| **R-03** | 6     | SEC      | **Stripe Pro epic must include webhook replay idempotency test**                        |
| **R-04** | 6     | DATA     | **XP/Badge epic must include idempotency constraint migration**                         |
| **R-06** | 6     | SEC      | **Leaderboard epic must include FERPA PII test + PM sign-off before GA**               |
| **R-07** | 6     | TECH     | **All T3 epics blocked until seed API is merged** (cross-cutting infrastructure)       |
| **R-10** | 6     | OPS      | **All T3 epics blocked until GitHub Actions CI workflow is configured**                |

### Quality Gates

Recommended quality gates per epic based on risk assessment:

| Epic Theme                    | Gate Criteria                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Authentication / JWT          | P0-001, P0-004 passing; `isPro` stale regression test added                                |
| Paper Trading                 | P0-002 passing; `applySpread()` unit tests ≥90% coverage of `packages/shared-utils`       |
| XP / Badges / Gamification    | P0-003, P0-005 passing; `xp_events` idempotency constraint in migration                    |
| Leaderboard                   | P0-006 passing; PM FERPA sign-off documented                                               |
| Learning Modules / Pro Gating | P0-007 passing; P1-006 session-refresh test passing                                        |
| Stripe Subscriptions          | P0-008 passing; no duplicate subscription rows verifiable in DB                            |
| Test Infrastructure           | Playwright config committed; seed API deployed to test env; CI pipeline green              |

---

## Story-Level Integration Guidance

### P0/P1 Test Scenarios → Story Acceptance Criteria

The following test scenarios from the QA doc **must** appear as acceptance criteria in T3/T4 stories:

| Test ID    | Test Description                                              | Maps To Story Theme           | AC Wording                                                                           |
| ---------- | ------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| **P0-001** | Student logs in and reaches dashboard                         | Auth / Onboarding              | "Given valid credentials, user reaches `/dashboard` within 3s"                       |
| **P0-002** | Paper trade fills at ±0.1% spread                             | Paper Trading                  | "Given a buy order, fill price is within ±0.1% of market quote; XP awarded in audit log" |
| **P0-003** | XP award idempotent on duplicate reference_id                 | XP / Gamification              | "Given same `reference_id`, second XP award returns 409; DB row count = 1"           |
| **P0-004** | JWT isPro persists after token rotation                       | Pro Gating / Auth              | "Given Pro token rotates, `isPro` decoded from new token is `true`"                  |
| **P0-005** | Badge unlock fires exactly once                               | Badges                         | "Given threshold crossed, badge row in DB = 1 regardless of retry count"             |
| **P0-006** | Leaderboard contains no PII                                   | Leaderboard                    | "Given unauthenticated GET /leaderboard, response has no `email` or `full_name`"     |
| **P0-007** | Pro module returns 403 for free tier                          | Pro Gating                     | "Given free-tier JWT, GET /modules/pro-content returns 403 with paywall flag"        |
| **P0-008** | Stripe webhook idempotent on replay                           | Subscriptions / Stripe          | "Given same Stripe event_id replayed, subscription table row count = 1"              |
| **P1-005** | `applySpread()` returns price within bounds                   | Paper Trading / Shared Utils    | "Given any positive market price, spread result is within ±0.1% of input"            |
| **P1-006** | Session reflects isPro after Stripe webhook                   | Pro Gating / Subscriptions      | "Given `customer.subscription.updated` webhook, next session fetch returns `isPro: true`" |

### Data-TestId Requirements

The following `data-testid` attributes are required for Playwright selectors to work. Ensure stories include these as implementation requirements:

| Component              | Required data-testid              | Used In Test  |
| ---------------------- | --------------------------------- | ------------- |
| Login form — email     | `data-testid="email"`             | P0-001        |
| Login form — password  | `data-testid="password"`          | P0-001        |
| Login form — submit    | `data-testid="login-button"`      | P0-001        |
| Trade form — symbol    | `data-testid="trade-symbol"`      | P0-002        |
| Trade form — shares    | `data-testid="trade-shares"`      | P0-002        |
| Trade form — submit    | `data-testid="trade-submit"`      | P0-002        |
| Pro paywall banner     | `data-testid="pro-paywall"`       | P0-007        |
| Notification bell      | `data-testid="notification-bell"` | P1-008        |
| Mark all read button   | `data-testid="mark-all-read"`     | P2-006        |
| Badge card canvas      | `data-testid="badge-canvas"`      | P1-007        |

---

## Risk-to-Story Mapping

| Risk ID  | Category | P×I | Recommended Story/Epic                                          | Test Level  |
| -------- | -------- | --- | --------------------------------------------------------------- | ----------- |
| R-01     | TECH     | 3×3 | New story: "Set up Playwright + CI pipeline" (T3, pre-sprint)   | E2E + CI    |
| R-02     | SEC      | 2×3 | Existing T2.13 (patched); add integration test in T3 auth story | Integration |
| R-03     | SEC      | 2×3 | New story: "Stripe webhook idempotency" (T3 Stripe epic)        | Integration |
| R-04     | DATA     | 2×3 | New story: "XP events idempotency constraint" (T3 XP epic)      | Integration |
| R-06     | SEC      | 2×3 | Update leaderboard story: add FERPA AC (T3 or T4)               | E2E         |
| R-07     | TECH     | 3×2 | New story: "Test seed/teardown API" (T3 infra, highest priority)| Integration |
| R-10     | OPS      | 3×2 | New story: "GitHub Actions CI workflow" (T3 infra, critical)    | CI/OPS      |
| R-05     | PERF     | 2×2 | Add circuit-breaker to existing market data story (T3/T4)       | Integration |
| R-08     | PERF     | 2×2 | Add Redis warm-up to cache story (T3/T4)                        | Integration |
| R-09     | BUS      | 2×2 | Add unit tests to `packages/shared-utils` paper trade story     | Unit        |
| R-11     | DATA     | 2×2 | Add down() migration requirement to all DB migration stories    | Integration |
| R-13     | TECH     | 2×2 | Add session refresh to Stripe webhook story (T3)                | Integration |
| R-12     | TECH     | 2×1 | Closed — patched in T2.12 code review                           | Unit        |
| R-16     | BUS      | 2×1 | Closed — patched in T2.13 code review                           | Unit        |

---

## Recommended BMAD → TEA Workflow Sequence

1. **TEA Test Design** (`TD`) → ✅ **COMPLETE** — produced this handoff document
2. **BMAD Create Epics & Stories** → consumes this handoff; embed quality gates and `data-testid` requirements into T3/T4 stories
3. **TEA ATDD** (`AT`) → generates failing acceptance tests for all P0 scenarios (run per story)
4. **BMAD Implementation** (`/bmad-dev`) → developers implement with test-first guidance; P0 tests must pass before PR merges
5. **TEA Automate** (`TA`) → generates full test suite from coverage plan
6. **TEA Trace** (`TR`) → validates coverage completeness against PRD requirements

---

## Phase Transition Quality Gates

| From Phase           | To Phase             | Gate Criteria                                                              |
| -------------------- | -------------------- | -------------------------------------------------------------------------- |
| Test Design          | T3 Epic/Story Creation | All P0 risks (R-01, R-02, R-03, R-04, R-06, R-07, R-10) have mitigation strategy assigned + owner |
| T3 Epic/Story Creation | ATDD               | T3 stories have acceptance criteria drawn from P0/P1 test scenarios in this doc |
| ATDD                 | Implementation       | Failing Playwright acceptance tests exist for all P0 scenarios             |
| Implementation       | Test Automation      | All 8 P0 acceptance tests pass in CI                                       |
| Test Automation      | Phase 1 GA Release   | Trace matrix shows ≥80% coverage of PRD FRs; all P0+P1 tests green; FERPA sign-off |
