# Story T2.9: Daily Streak Tracking

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-9-daily-streak-tracking
**Date Prepared:** 2026-04-09

---

## Story

As a student,
I want to see my daily activity streak prominently and be rewarded for consistency,
So that I build a habit of engaging with the platform every day.

---

## Acceptance Criteria

**AC1 — Streak increments on consecutive daily activity**
**Given** I completed any qualifying activity yesterday (trade, lesson, quiz)
**When** I complete a qualifying activity today
**Then** my streak increments by 1 and is reflected in the dashboard and nav

**AC2 — Streak resets on missed day**
**Given** I had an active streak but skipped a day
**When** the midnight UTC cron runs
**Then** my `current_streak` resets to 0

**AC3 — Flame icon with streak count visible on dashboard (streak ≥ 1)**
**Given** I have a streak of 1 or more days
**When** I view the dashboard
**Then** a flame icon (🔥) with my streak count is shown; tooltip or sub-label shows longest streak

**AC4 — Streak milestone toast fires at 3, 7, 14, 30, 60, 100 days**
**Given** my streak reaches a milestone (3, 7, 14, 30, 60, or 100 days)
**When** the activity is recorded
**Then** a toast fires: "🔥 {n}-day streak! +{n*10} XP bonus"

**AC5 — Same-day activity does not double-increment**
**Given** I already completed activity today
**When** I complete another activity the same day
**Then** the streak count stays unchanged

---

## What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/api/src/services/gamification/streak.service.ts` | ✅ Complete — DO NOT touch | `recordActivity(userId)` and `resetMissedStreaks()` are fully implemented |
| `apps/api/src/controllers/gamification.controller.ts` — `getStreak` | ✅ Complete — DO NOT touch | `GET /gamification/streak` returns `{ current_streak, longest_streak }` |
| `apps/api/src/routes/index.ts` | ✅ Routes registered | `GET /gamification/streak` and `POST /gamification/activity` both exist |
| `apps/api/src/jobs/index.ts` | ✅ Cron job exists | `resetMissedStreaks()` runs at midnight UTC (`0 0 * * *`) |
| `apps/api/src/controllers/learn.controller.ts` | ✅ `recordActivity` called | After `startLesson` (line 93) and `completeLesson` (line 123) |
| `apps/web/app/(dashboard)/dashboard/page.tsx` | ✅ Streak card exists | Fetches `['streak']` query, shows flame icon + current/longest streak |

**`recordActivity` signature:**
```ts
export async function recordActivity(userId: string): Promise<{ currentStreak: number; longestStreak: number }>
```

**Streak XP awards (already in streak.service.ts):**
- Milestone days (3, 7, 14, 30, 60, 100): `awardXp(userId, 'streak_${n}', n * 10)`
- All other days: `awardXp(userId, 'daily_activity', 5)`

**`getStreak` response:** `{ data: { current_streak: number, longest_streak: number } }`

---

## The Gap This Story Closes

The streak backend is fully functional. The gaps are:
1. **No streak invalidation** after lesson completion on the frontend — the dashboard streak count only updates on page load
2. **No milestone toast** in the UI — streak XP is awarded but the user sees no in-session notification
3. **No streak unit tests** — `streak.service.ts` and `gamification.controller.ts` have no test files

---

## Tasks / Subtasks

### Task 1 — Invalidate `['streak']` after lesson/quiz actions (AC1, AC3) [ ]

**File:** `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx`

In `completeMutation.onSuccess`, add:
```tsx
qc.invalidateQueries({ queryKey: ['streak'] });
```

In `quizMutation.onSuccess`, add:
```tsx
qc.invalidateQueries({ queryKey: ['streak'] });
```

This ensures the dashboard streak counter refreshes when streaks are earned during lessons.

---

### Task 2 — Add streak milestone toast (AC4) [ ]

**File:** `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx`

The `completeMutation.onSuccess` and `quizMutation.onSuccess` callbacks already receive XP data. The streak milestone is signalled by the `eventType` on the server (`streak_3`, `streak_7`, etc.) but the lesson API response doesn't expose it.

**Approach:** After invalidating `['streak']`, read the fresh streak value from the cache and fire the milestone toast if the streak is a milestone value:

```tsx
// In completeMutation.onSuccess (after streak invalidation):
await qc.refetchQueries({ queryKey: ['streak'] });
const freshStreak = qc.getQueryData<{ data: { current_streak: number } }>(['streak']);
const streakCount = freshStreak?.data?.current_streak ?? 0;
const MILESTONE_STREAKS = [3, 7, 14, 30, 60, 100];
if (MILESTONE_STREAKS.includes(streakCount)) {
  toast.success(`🔥 ${streakCount}-day streak! +${streakCount * 10} XP bonus`);
}
```

Apply the same pattern in `quizMutation.onSuccess`.

Note: `refetchQueries` is async — use `await` before reading the fresh data.

---

### Task 3 — Write streak service unit tests (AC1, AC2, AC5) [ ]

**File:** `apps/api/src/services/gamification/streak.service.test.ts` (new file)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db', () => ({
  db: { query: vi.fn() },
}));
vi.mock('./xp.service', () => ({
  awardXp: vi.fn().mockResolvedValue({ totalXp: 100, newLevel: 1, leveledUp: false }),
}));
vi.mock('dayjs', async () => {
  const actual = await vi.importActual<typeof import('dayjs')>('dayjs');
  const mockDayjs = vi.fn((...args: unknown[]) => actual.default(...(args as [])));
  (mockDayjs as typeof actual.default).extend = actual.default.extend.bind(actual.default);
  return { default: mockDayjs };
});

import { db } from '../../config/db';
import { awardXp } from './xp.service';
import { recordActivity, resetMissedStreaks } from './streak.service';
import dayjs from 'dayjs';

const mockDb = vi.mocked(db);

describe('recordActivity()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new streak row on first activity (AC1)', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [] } as never) // SELECT — no row
      .mockResolvedValueOnce({ rows: [] } as never); // INSERT

    const result = await recordActivity('user-1');
    expect(result).toEqual({ currentStreak: 1, longestStreak: 1 });
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO streaks'),
      expect.arrayContaining(['user-1']),
    );
  });

  it('does not increment if last activity was today (AC5)', async () => {
    const today = dayjs().format('YYYY-MM-DD');
    mockDb.query.mockResolvedValueOnce({
      rows: [{ current_streak: 3, longest_streak: 5, last_activity_date: today }],
    } as never);

    const result = await recordActivity('user-1');
    expect(result).toEqual({ currentStreak: 3, longestStreak: 5 });
    // No UPDATE call
    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });

  it('increments streak when last activity was yesterday (AC1)', async () => {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ current_streak: 2, longest_streak: 5, last_activity_date: yesterday }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never); // UPDATE

    const result = await recordActivity('user-1');
    expect(result.currentStreak).toBe(3);
    expect(awardXp).toHaveBeenCalledWith('user-1', 'daily_activity', 5);
  });

  it('resets streak to 1 when last activity was 2+ days ago (AC2 partial)', async () => {
    const twoDaysAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD');
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ current_streak: 7, longest_streak: 10, last_activity_date: twoDaysAgo }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await recordActivity('user-1');
    expect(result.currentStreak).toBe(1);
    expect(awardXp).toHaveBeenCalledWith('user-1', 'daily_activity', 5);
  });

  it('awards milestone XP at 7-day streak (AC4)', async () => {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ current_streak: 6, longest_streak: 6, last_activity_date: yesterday }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await recordActivity('user-1');
    expect(awardXp).toHaveBeenCalledWith('user-1', 'streak_7', 70);
  });
});

describe('resetMissedStreaks()', () => {
  it('calls UPDATE with yesterday date to reset stale streaks (AC2)', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] } as never);
    await resetMissedStreaks();
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE streaks'),
      expect.any(Array),
    );
  });
});
```

Run: `cd apps/api && npx vitest run src/services/gamification/streak.service.test.ts`

---

### Task 4 — Run full test suite [ ]

```bash
cd apps/api && npx vitest run
# Expected: 22 existing + 7 new streak tests = 29 total

cd apps/web && node_modules/.bin/vitest run
# Expected: all existing tests pass (invalidation changes don't affect tests)
```

---

## Dev Notes

### Files to modify

1. `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — add `['streak']` invalidation + milestone toast
2. `apps/api/src/services/gamification/streak.service.test.ts` — new test file (7 tests)

No API controller changes. No new routes. No new dependencies.

### `dayjs` in tests

`streak.service.ts` uses `dayjs` to compute `today` and `yesterday`. Mocking `dayjs` is tricky — prefer testing with real dates by seeding `last_activity_date` relative to `dayjs().subtract(1, 'day')` rather than freezing time. The test examples above follow this pattern.

### `refetchQueries` vs `invalidateQueries` for streak milestone

`invalidateQueries` marks the query stale and triggers a background refetch. To read the fresh value synchronously in the same `onSuccess` callback, use `await qc.refetchQueries(...)` which waits for completion before the next line. This is the correct pattern when you need the result immediately.

### Cron job (already running)

`apps/api/src/jobs/index.ts` runs `resetMissedStreaks()` at `0 0 * * *` (midnight UTC). This is AC2 implementation — already complete, no changes needed.

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Task 1: Added `qc.invalidateQueries({ queryKey: ['streak'] })` — replaced with `await qc.refetchQueries(...)` in both completeMutation and quizMutation so fresh data is available immediately
- Task 2: Milestone toast reads fresh streak from cache after refetch; fires "🔥 N-day streak! +XP bonus" for [3, 7, 14, 30, 60, 100]; MILESTONE_STREAKS constant defined once above completeMutation
- Task 3: 7 new streak.service tests — first activity (insert), same-day no-op (AC5), yesterday increment (AC1), 2+ days reset (AC2), milestone XP at 7 days (AC4), longest_streak update, resetMissedStreaks UPDATE query
- Task 3 fix: dayjs mock parses date strings in local time via `new Date(y, m-1, d)` to avoid UTC midnight timezone bug; also fixed increment test to start at streak 1→2 (not 2→3 which is a milestone)
- Task 4: 69/69 API tests passing; 88/88 web tests passing; zero regressions
- AC1 ✓: streak increments on consecutive daily activity via recordActivity (already wired in learn controller)
- AC2 ✓: resetMissedStreaks cron runs midnight UTC (already in jobs/index.ts)
- AC3 ✓: flame icon + streak count already on dashboard; refreshes via ['streak'] invalidation
- AC4 ✓: milestone toast fires in completeMutation and quizMutation after refetch
- AC5 ✓: same-day guard in streak.service returns early without UPDATE

### File List
- `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — streak refetch + milestone toast in both mutations; MILESTONE_STREAKS constant; made both onSuccess handlers async
- `apps/api/src/services/gamification/streak.service.test.ts` — new: 7 tests with timezone-safe dayjs mock
- `docs/stories/t2-9-daily-streak-tracking.md` — updated
- `docs/stories/sprint-status.yaml` — t2-9 → review
