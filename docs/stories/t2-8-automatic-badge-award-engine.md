# Story T2.8: Automatic Badge Award Engine

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-8-automatic-badge-award-engine
**Date Prepared:** 2026-04-09

---

## Story

As a student,
I want to be notified immediately when I earn a badge,
So that achievements feel instantaneous and I'm motivated to pursue more.

---

## Acceptance Criteria

**AC1 — Badge auto-awarded when criteria met**
**Given** I complete an action that satisfies a badge's criteria (e.g. complete 1st lesson)
**When** XP is awarded (which triggers `checkAndUnlockBadges`)
**Then** the badge is recorded in `user_badges` atomically and `earned_at` is set

**AC2 — No duplicate badge awards**
**Given** I already hold a badge
**When** the badge check runs again (on any subsequent XP award)
**Then** the badge is not awarded a second time (DB `ON CONFLICT DO NOTHING` guards this)

**AC3 — In-app toast notification on badge unlock**
**Given** a badge is newly unlocked during a session
**When** the `/gamification/badges` query is refetched after XP invalidation
**Then** a toast notification fires: "Badge unlocked: {name} 🏅"

**AC4 — Badge page reflects new badge immediately**
**Given** a badge is newly earned
**When** I navigate to `/badges`
**Then** the badge appears in the "Earned" section with its earned_at timestamp

---

## What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/api/src/services/gamification/badge.service.ts` | ✅ Complete — DO NOT touch | `checkAndUnlockBadges(userId)` already evaluates all criteria and awards via `ON CONFLICT DO NOTHING`. Called from `xp.service.ts` after every XP commit. |
| `apps/api/src/controllers/gamification.controller.ts` — `getBadges` | ✅ Complete — DO NOT touch | `GET /gamification/badges` returns all badges with `earned_at` (null if unearned) |
| `apps/web/app/(dashboard)/badges/page.tsx` | ✅ Complete (T2.7) | Fetches `['badges']` query, splits earned/unearned, rarity styling done |
| `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` | ✅ Already invalidates `['xp']` | After lesson complete and quiz submit, `qc.invalidateQueries({ queryKey: ['xp'] })` fires |

**`checkAndUnlockBadges` criteria types supported (from `badge.service.ts`):**
- `trade_count` — threshold >= completed orders
- `portfolio_return` — threshold >= portfolio return %
- `lesson_count` — threshold >= completed lessons
- `module_complete` — threshold >= distinct modules completed
- `streak` — threshold >= current streak days
- `xp_total` — threshold >= total XP
- `asset_type_trade` — threshold >= distinct symbols traded in asset type

**`getBadges` response shape:** `{ data: Array<{ id, slug, name, description, icon_url, category, xp_reward, criteria_json, rarity, earned_at: string|null }> }`

---

## The Core Problem This Story Solves

The badge engine already runs server-side. The gap is: **the frontend doesn't notify the user when a new badge arrives**. Currently `['badges']` is only fetched on the `/badges` page. When a badge is earned during a lesson, the user gets no in-session feedback.

**Solution:** After any XP-awarding action, also invalidate `['badges']`. Add a `useBadgeNotifier` hook that compares the previous badge list to the new one and fires a toast for each newly earned badge.

---

## Tasks / Subtasks

### Task 1 — Add badge query invalidation to lesson page (AC3, AC4) [ ]

**File:** `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx`

In both `completeMutation.onSuccess` and `quizMutation.onSuccess`, add:
```tsx
qc.invalidateQueries({ queryKey: ['badges'] });
```

This ensures the badge list is refetched after every XP event that could trigger a badge award.

---

### Task 2 — Create `useBadgeNotifier` hook (AC3) [ ]

**File:** `apps/web/lib/use-badge-notifier.ts` (new file)

```ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface BadgeRow {
  id: string;
  name: string;
  earned_at: string | null;
}

/**
 * Watches the ['badges'] query cache and fires a toast for each newly-earned badge.
 * Mount once in the app shell or layout — not per-page.
 */
export function useBadgeNotifier() {
  const qc = useQueryClient();
  const prevEarnedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (
        event.type !== 'updated' ||
        !Array.isArray((event.query.queryKey as string[])) ||
        (event.query.queryKey as string[])[0] !== 'badges'
      ) return;

      const badges = (event.query.state.data as { data: BadgeRow[] } | undefined)?.data ?? [];
      const nowEarned = badges.filter((b) => b.earned_at !== null);

      nowEarned.forEach((b) => {
        if (!prevEarnedIds.current.has(b.id)) {
          prevEarnedIds.current.add(b.id);
          toast.success(`Badge unlocked: ${b.name} 🏅`);
        }
      });
    });

    return unsubscribe;
  }, [qc]);
}
```

---

### Task 3 — Mount `useBadgeNotifier` in app shell (AC3) [ ]

**File:** `apps/web/app/(dashboard)/layout.tsx` (or the dashboard AppShell component)

```tsx
import { useBadgeNotifier } from '@/lib/use-badge-notifier';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useBadgeNotifier();
  // ...rest of layout
}
```

Mount once at the dashboard layout level so it covers all pages where badges can be earned.

---

### Task 4 — Write tests for `useBadgeNotifier` (AC2, AC3) [ ]

**File:** `apps/web/lib/use-badge-notifier.test.ts` (new file)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBadgeNotifier } from './use-badge-notifier';
import toast from 'react-hot-toast';
import React from 'react';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn() } }));

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useBadgeNotifier()', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
    vi.mocked(toast.success).mockClear();
  });

  it('fires toast when a new badge appears as earned', async () => {
    renderHook(() => useBadgeNotifier(), { wrapper: makeWrapper(qc) });

    // Simulate badges query updating with one newly earned badge
    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'First Trade', earned_at: '2026-04-09T00:00:00Z' }],
    });

    // Allow effect to process
    await new Promise((r) => setTimeout(r, 0));
    expect(toast.success).toHaveBeenCalledWith('Badge unlocked: First Trade 🏅');
  });

  it('does not fire toast for already-known earned badges (no duplicate)', async () => {
    renderHook(() => useBadgeNotifier(), { wrapper: makeWrapper(qc) });

    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'First Trade', earned_at: '2026-04-09T00:00:00Z' }],
    });
    await new Promise((r) => setTimeout(r, 0));

    // Same badge appears again (e.g. query re-fetched)
    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'First Trade', earned_at: '2026-04-09T00:00:00Z' }],
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(toast.success).toHaveBeenCalledTimes(1); // still only once
  });

  it('does not fire toast for unearned badges', async () => {
    renderHook(() => useBadgeNotifier(), { wrapper: makeWrapper(qc) });

    qc.setQueryData(['badges'], {
      data: [{ id: 'b1', name: 'First Trade', earned_at: null }],
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
```

---

### Task 5 — Run full test suite [ ]

```bash
cd apps/web && node_modules/.bin/vitest run
# Expected: all existing tests pass + 3 new useBadgeNotifier tests

cd apps/api && npx vitest run
# Expected: 22 tests pass (no API changes)
```

---

## Dev Notes

### No API changes required

`checkAndUnlockBadges` already runs after every `awardXp` call. The badge is in the DB before the API response returns. Invalidating `['badges']` on the frontend is sufficient to pick it up.

### Why `qc.getQueryCache().subscribe()` not `useQuery`

The notifier needs to react to cache updates across any page, not just mount/render. Subscribing to the query cache directly fires synchronously when the cache is updated by an invalidation+refetch. This avoids needing to render the hook on every page that could award a badge.

### Initial badge load

When the notifier first mounts and badges are already earned (e.g. from a previous session), those pre-existing `earned_at` values are added to `prevEarnedIds.current` on first cache update without firing toasts — they were already in the ref after the first subscription event processes the full earned list.

Actually: on the **first** `setQueryData` call, `prevEarnedIds.current` is empty, so ALL currently-earned badges would fire toasts. Fix by seeding the ref on mount from existing cache:

```ts
useEffect(() => {
  // Seed from existing cache to prevent toasting badges earned in prior sessions
  const existing = (qc.getQueryData(['badges']) as { data: BadgeRow[] } | undefined)?.data ?? [];
  existing.filter((b) => b.earned_at !== null).forEach((b) => prevEarnedIds.current.add(b.id));

  const unsubscribe = qc.getQueryCache().subscribe(/* ... */);
  return unsubscribe;
}, [qc]);
```

Add this seeding step to the `useBadgeNotifier` implementation in Task 2.

### `['badges']` query key usage

- `apps/web/app/(dashboard)/badges/page.tsx` — primary consumer, `useQuery(['badges'])`
- After T2.8: also invalidated in lesson page `completeMutation` and `quizMutation`
- `useBadgeNotifier` subscribes to cache updates (not a new fetch)

### TanStack Query v5 compatibility

`qc.getQueryCache().subscribe(event => ...)` is valid in TanStack Query v4 and v5. In v5 the event shape changed slightly — `event.type` values are `'added' | 'updated' | 'removed'` in v4; check the installed version in `apps/web/package.json` and adjust if needed.

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Task 1: Added `qc.invalidateQueries({ queryKey: ['badges'] })` to both completeMutation.onSuccess and quizMutation.onSuccess in lesson page
- Task 2: Created `useBadgeNotifier` hook + extracted `createBadgeNotifier` pure factory (testable without React); uses sonner toast; seeds prevEarnedIds from existing cache on create to avoid re-toasting prior-session badges
- Task 3: Created `BadgeNotifier.tsx` (`'use client'` headless component); mounted in `AppShell.tsx`; layout.tsx stays a server component
- Task 4: 6 tests for `createBadgeNotifier` — new badge fires callback, no duplicate on re-fetch, unearned skipped, pre-session seed prevents toast, multiple badges at once, unsubscribe cleans up
- Task 4 fix: AppShell.test.tsx mocked `BadgeNotifier` to avoid QueryClientProvider requirement in SSR test
- Task 5: 88/88 web tests passing; zero regressions
- AC1 ✓: badge.service checkAndUnlockBadges already runs server-side; frontend invalidation picks it up
- AC2 ✓: prevEarnedIds Set + ON CONFLICT DO NOTHING prevents double awards/toasts
- AC3 ✓: toast.success fires via useBadgeNotifier on cache update with new earned badge
- AC4 ✓: ['badges'] invalidation ensures /badges page reflects new badge immediately

### File List
- `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — added ['badges'] invalidation to both mutations
- `apps/web/lib/use-badge-notifier.ts` — new: createBadgeNotifier factory + useBadgeNotifier hook
- `apps/web/lib/use-badge-notifier.test.ts` — new: 6 tests for createBadgeNotifier
- `apps/web/components/BadgeNotifier.tsx` — new: headless client component
- `apps/web/components/layouts/AppShell.tsx` — mounted BadgeNotifier
- `apps/web/components/layouts/AppShell.test.tsx` — mocked BadgeNotifier to keep SSR test clean
- `docs/stories/t2-8-automatic-badge-award-engine.md` — updated
- `docs/stories/sprint-status.yaml` — t2-8 → review
