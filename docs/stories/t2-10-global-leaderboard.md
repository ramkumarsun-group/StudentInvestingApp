# Story T2.10: Global Leaderboard

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-10-global-leaderboard
**Date Prepared:** 2026-04-08

---

## Story

As a student,
I want to see how my portfolio performance ranks among all students,
So that I'm motivated to learn and trade more strategically.

---

## Acceptance Criteria

**AC1 — Leaderboard shows top 100 students ranked by return %**
**Given** I open the leaderboard
**When** the page loads
**Then** I see a ranked list (with medals for top 3) showing each student's username, level, portfolio value, and return %

**AC2 — My rank shown in the header**
**Given** I am logged in
**When** I view the leaderboard
**Then** my current rank is shown in the top-right of the page

**AC3 — Leaderboard refreshes automatically**
**Given** portfolio values change as the market moves
**When** the leaderboard cron runs (every 5 minutes)
**Then** Redis sorted set `leaderboard:global` is updated, and the page refetches every 60 seconds to reflect the latest rankings

---

## What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/web/app/(dashboard)/leaderboard/page.tsx` | ✅ Complete — DO NOT touch | Full page: ranked list, medal emojis, my-rank display, `refetchInterval: 60000`. |
| `apps/api/src/controllers/leaderboard.controller.ts` | ✅ Complete — DO NOT touch | `getGlobalLeaderboard` (Redis first, DB fallback), `getMyRank` (Redis rank + DB fallback), `refreshLeaderboard` (rebuilds Redis sorted set). |
| `apps/api/src/jobs/index.ts` | ✅ Complete — DO NOT touch | `cron.schedule('*/5 * * * *', refreshLeaderboard)` — 5-min refresh already scheduled. |
| `apps/api/src/routes/index.ts` | ✅ Complete — DO NOT touch | `GET /leaderboard/global` (no auth required), `GET /leaderboard/global/me` (auth required) registered. |
| `apps/web/lib/nav-items.ts` | ✅ Complete — DO NOT touch | `/leaderboard` already in NAV_ITEMS. |

---

## Tasks / Subtasks

### Task 1 — Write API tests for leaderboard controller (AC1, AC2, AC3) ✅ [x]

Create `apps/api/src/controllers/leaderboard.controller.test.ts`.

The leaderboard controller uses both Redis and DB. Tests should cover:
- `getGlobalLeaderboard` returns ranked entries from DB when Redis is empty (DB fallback path)
- `getMyRank` returns rank + returnPct from DB when not in Redis
- `refreshLeaderboard` writes scores to Redis correctly

Follow the pattern in `learn.controller.test.ts` for HTTP integration tests using `supertest` and a test database. Mock Redis with `ioredis-mock` or spy on the module-level `redis` import.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { redis } from '../config/redis';

// Mock Redis to return empty (forces DB fallback path)
vi.mock('../config/redis', () => ({
  redis: {
    zrevrange: vi.fn().mockResolvedValue([]),
    zrevrank: vi.fn().mockResolvedValue(null),
    zscore: vi.fn().mockResolvedValue(null),
    pipeline: vi.fn().mockReturnValue({
      del: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
  },
}));

describe('GET /api/v1/leaderboard/global', () => {
  it('returns 200 with ranked entries array (no auth required)', async () => {
    const res = await request(app).get('/api/v1/leaderboard/global');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns entries with required fields when portfolios exist', async () => {
    const res = await request(app).get('/api/v1/leaderboard/global');
    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      const entry = res.body.data[0];
      expect(entry).toHaveProperty('user_id');
      expect(entry).toHaveProperty('username');
      expect(entry).toHaveProperty('return_pct');
      expect(entry).toHaveProperty('rank');
    }
  });
});

describe('GET /api/v1/leaderboard/global/me', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/leaderboard/global/me');
    expect(res.status).toBe(401);
  });

  it('returns rank and returnPct when authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/leaderboard/global/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('rank');
    expect(res.body.data).toHaveProperty('returnPct');
    expect(typeof res.body.data.rank).toBe('number');
  });
});

describe('refreshLeaderboard()', () => {
  it('calls Redis pipeline with del + zadd per portfolio', async () => {
    const { refreshLeaderboard } = await import('./leaderboard.controller');
    await refreshLeaderboard();
    // pipeline.del was called once
    expect(redis.pipeline().del).toHaveBeenCalledWith('leaderboard:global');
  });
});
```

Note: Obtain `token` from the existing test helper pattern in `learn.controller.test.ts` (register + login in `beforeAll`).

---

### Task 2 — Write frontend smoke tests (AC1, AC2) ✅ [x]

Create `apps/web/app/(dashboard)/leaderboard/page.test.tsx`.

Test the pure display logic (rank emoji helper and entry structure) without mocking React Query:

```tsx
import { describe, it, expect } from 'vitest';

// Extract rankEmoji pure function for testing
function rankEmoji(rank: number): string | null {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

describe('rankEmoji()', () => {
  it('returns gold medal for rank 1', () => {
    expect(rankEmoji(1)).toBe('🥇');
  });

  it('returns silver medal for rank 2', () => {
    expect(rankEmoji(2)).toBe('🥈');
  });

  it('returns bronze medal for rank 3', () => {
    expect(rankEmoji(3)).toBe('🥉');
  });

  it('returns null for rank 4 and beyond', () => {
    expect(rankEmoji(4)).toBeNull();
    expect(rankEmoji(100)).toBeNull();
  });

  it('returns null for rank 0 (edge case)', () => {
    expect(rankEmoji(0)).toBeNull();
  });
});
```

Note: `rankEmoji` is defined inline in `leaderboard/page.tsx`. Either inline-copy it in the test (as above) or extract it to `apps/web/lib/leaderboard-utils.ts` and import it. Both approaches are acceptable — prefer the extraction if it makes the test cleaner.

---

## Dev Notes

### The ONLY files to create

1. `apps/api/src/controllers/leaderboard.controller.test.ts` — new (5 tests)
2. `apps/web/app/(dashboard)/leaderboard/page.test.tsx` — new (5 tests, or extract helper)

No production code changes needed.

### Redis mock strategy

The controller tests use `vi.mock('../config/redis', ...)` to intercept the module-level `redis` import. The mock returns empty arrays from `zrevrange`/`zrevrank`, which forces the DB fallback path. This keeps tests deterministic without a real Redis instance.

If the existing `learn.controller.test.ts` already has a Redis mock setup or a shared test helper, reuse it.

### `getGlobalLeaderboard` — Redis vs DB path

Two code paths:
1. **Redis path**: `redis.zrevrange(...)` returns entries (score = `return_pct * 100`). Enriches each with user/level/portfolio data from DB.
2. **DB fallback**: when Redis returns empty. Full SQL query with `ROW_NUMBER()` window function.

Tests above mock Redis as empty → exercises the DB fallback. If you want to test the Redis path, populate the mock: `zrevrange.mockResolvedValue(['user-id-1', '1050', 'user-id-2', '800'])`.

### `refreshLeaderboard` is not an HTTP endpoint

It's called by the cron and exposed as a named export. Test it directly by importing the function, not via `supertest`.

### `formatUSD` / `formatPercent` — already tested in shared-utils

`formatUSD` and `formatPercent` are from `@student-investing/shared-utils` — tested in the shared package. No need to test them here.

### Test runner

```bash
cd apps/api && npx vitest run src/controllers/leaderboard.controller.test.ts
# Expected: 5 tests pass

cd apps/web && node_modules/.bin/vitest run app/'(dashboard)'/leaderboard/page.test.tsx
# Expected: 5 tests pass
```

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
- Task 1: Created `leaderboard.controller.test.ts` — 7 tests covering: DB fallback when Redis empty (returns ranked data), empty portfolio table, Redis enriched path (2 entries with correct returnPct/rank calculation), getMyRank from Redis (0-indexed +1), getMyRank DB fallback, refreshLeaderboard pipeline (del + zadd per portfolio), empty portfolios (no zadd calls). Fixed floating-point assertion to use `expect.closeTo(-120, 1)`.
- Task 2: Created `leaderboard/page.test.tsx` — 5 tests for `rankEmoji()` pure helper: gold/silver/bronze for ranks 1-3, null for 4+, null for rank 0 edge case.
- 35/35 learn+leaderboard+portfolio API tests pass. 68/68 web tests pass. Pre-existing 4 API failures (missing zod/jwt/axios packages) are unrelated to this story and pre-date it.
- AC1 ✓: getGlobalLeaderboard returns top 100 ranked by return_pct; frontend page already renders medals + all required fields
- AC2 ✓: getMyRank returns rank from Redis or DB fallback; page already shows it in header
- AC3 ✓: `cron.schedule('*/5 * * * *', refreshLeaderboard)` already configured in jobs/index.ts; page refetchInterval: 60000

### File List
- `apps/api/src/controllers/leaderboard.controller.test.ts` — created (5 tests)
- `apps/web/app/(dashboard)/leaderboard/page.test.tsx` — created (5 tests)
- `docs/stories/t2-10-global-leaderboard.md` — updated
- `docs/stories/sprint-status.yaml` — updated (t2-10 → in-progress)

## Change Log
- 2026-04-08: Story prepared by SM (claude-sonnet-4-6)
- 2026-04-08: T2.10 implemented — 7 API leaderboard tests, 5 frontend rankEmoji tests (35 API + 68 web all passing) (claude-sonnet-4-6)
