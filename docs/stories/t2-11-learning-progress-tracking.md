# Story T2.11: Learning Progress Tracking

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-11-learning-progress-tracking
**Date Prepared:** 2026-04-09

---

## Story

As a student,
I want to see my learning progress on the Learn page and within each module,
So that I can see how far I've come and what remains.

---

## Acceptance Criteria

**AC1 — Module cards on /learn show completion percentage**
**Given** I have completed some lessons in a module
**When** I view the Learn page
**Then** each module card shows "X/Y lessons complete" and a progress bar at the correct percentage

**AC2 — Completing a lesson updates /learn progress without full reload**
**Given** I complete a lesson
**When** I navigate back to the Learn page
**Then** the module card shows the updated completion percentage (no stale data)

**AC3 — Module detail page shows per-lesson status**
**Given** I open a module detail page (`/learn/[moduleSlug]`)
**When** the page loads
**Then** completed lessons show a "✓" or "Completed" indicator; in-progress show "In Progress"; locked show a lock icon

**AC4 — 100% complete module shows a completion indicator**
**Given** I complete the final lesson in a module
**When** I view the module card on the Learn page
**Then** the card shows a "Complete ✓" badge or full green progress bar

---

## What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/api/src/controllers/learn.controller.ts` — `getModules` | ✅ Complete | Returns `completion_pct`, `lesson_count`, `completed_lessons` per module |
| `apps/api/src/controllers/learn.controller.ts` — `getProgress` | ✅ Complete | Returns `{ id, slug, title, lesson_count, completed_lessons }` array |
| `apps/api/src/routes/index.ts` | ✅ Routes registered | `GET /learn/modules` and `GET /learn/progress` both exist with `authMiddleware` |
| `apps/web/app/(dashboard)/learn/page.tsx` | ✅ Fetches `['modules']` | Module list page; shows title, difficulty, XP reward. **Missing:** completion progress bar/count |
| `apps/web/app/(dashboard)/learn/[moduleSlug]/page.tsx` | ✅ Fetches `['module', moduleSlug]` | Lesson list with `computeUnlocked()`. **Missing:** per-lesson status indicators (completed ✓, in-progress, locked) |
| `apps/web/app/(dashboard)/dashboard/page.tsx` | ✅ Fetches `['learn-progress']` | Dashboard widget already shows learning progress — do not change this |
| `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` | ✅ Invalidates `['modules']` + `['module', moduleSlug]` | On lesson complete, both caches invalidated — progress updates cascade automatically |

**`getModules` response per module:**
```ts
{
  id, slug, title, description, difficulty, xp_reward, sort_order,
  is_published, requires_pro, lesson_count: number, completed_lessons: number, completion_pct: number
}
```

**`['module', moduleSlug]` response lesson shape:**
```ts
{ id, slug, title, sort_order, estimated_minutes, status: 'not_started'|'in_progress'|'completed'|null, xp_earned }
```

---

## Tasks / Subtasks

### Task 1 — Add progress bar + lesson count to module cards on /learn (AC1, AC2, AC4) [ ]

**File:** `apps/web/app/(dashboard)/learn/page.tsx`

The module data from `['modules']` already includes `completion_pct`, `lesson_count`, and `completed_lessons`. Add to each module card:

```tsx
{/* Inside the module card, after title/difficulty/XP row: */}
<div className="space-y-1 mt-2">
  <div className="flex justify-between text-xs text-slate-400">
    <span>{mod.completed_lessons}/{mod.lesson_count} lessons</span>
    {mod.completion_pct === 100 && (
      <span className="text-green-400 font-medium">Complete ✓</span>
    )}
  </div>
  <div className="w-full bg-slate-700 rounded-full h-1.5">
    <div
      className={`h-1.5 rounded-full transition-all ${mod.completion_pct === 100 ? 'bg-green-400' : 'bg-brand-500'}`}
      style={{ width: `${mod.completion_pct}%` }}
    />
  </div>
</div>
```

No new query needed — `['modules']` already provides this data. When `completeMutation` fires in the lesson page, it invalidates `['modules']`, so the progress bar here refreshes automatically (AC2).

---

### Task 2 — Add per-lesson status indicators to module detail page (AC3) [ ]

**File:** `apps/web/app/(dashboard)/learn/[moduleSlug]/page.tsx`

Each lesson in `module.lessons` has a `status` field (`null`, `'not_started'`, `'in_progress'`, `'completed'`). `computeUnlocked()` determines if it's accessible. Add a status badge to each lesson row:

```tsx
import { CheckCircle, Lock, Clock } from 'lucide-react';
import { computeUnlocked } from '@/lib/learn-utils';

// In the lesson list render:
{module.lessons.map((lesson, idx) => {
  const unlocked = computeUnlocked(module.lessons, idx);
  return (
    <Link
      key={lesson.id}
      href={unlocked ? `/learn/${moduleSlug}/${lesson.slug}` : '#'}
      className={`flex items-center justify-between p-3 rounded-lg ${
        unlocked ? 'hover:bg-surface-700 cursor-pointer' : 'opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="flex items-center gap-3">
        {lesson.status === 'completed' ? (
          <CheckCircle size={18} className="text-green-400 shrink-0" />
        ) : unlocked ? (
          <div className="w-4.5 h-4.5 rounded-full border-2 border-slate-500 shrink-0" />
        ) : (
          <Lock size={18} className="text-slate-500 shrink-0" />
        )}
        <div>
          <p className={`text-sm font-medium ${unlocked ? 'text-white' : 'text-slate-500'}`}>
            {lesson.title}
          </p>
          <p className="text-xs text-slate-500">{lesson.estimated_minutes} min</p>
        </div>
      </div>
      <div className="text-xs text-slate-400">
        {lesson.status === 'completed' && <span className="text-green-400">Completed</span>}
        {lesson.status === 'in_progress' && (
          <span className="text-brand-400 flex items-center gap-1"><Clock size={12} />In Progress</span>
        )}
      </div>
    </Link>
  );
})}
```

---

### Task 3 — Write tests for learn page progress display (AC1, AC4) [ ]

**File:** `apps/web/app/(dashboard)/learn/page.test.tsx` (new file)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: {
      data: [
        {
          id: 'm1', slug: 'stocks-101', title: 'Stocks 101',
          difficulty: 'beginner', xp_reward: 200, total_estimated_minutes: 30,
          lesson_count: 4, completed_lessons: 2, completion_pct: 50,
          is_published: true, requires_pro: false,
        },
        {
          id: 'm2', slug: 'bonds-basics', title: 'Bonds Basics',
          difficulty: 'intermediate', xp_reward: 300, total_estimated_minutes: 45,
          lesson_count: 3, completed_lessons: 3, completion_pct: 100,
          is_published: true, requires_pro: false,
        },
      ],
    },
    isLoading: false,
  })),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

import LearnPage from './page';

describe('LearnPage progress display', () => {
  it('shows lesson count for partially complete module (AC1)', () => {
    render(<LearnPage />);
    expect(screen.getByText('2/4 lessons')).toBeDefined();
  });

  it('shows "Complete ✓" for 100% module (AC4)', () => {
    render(<LearnPage />);
    expect(screen.getByText('Complete ✓')).toBeDefined();
  });
});
```

---

### Task 4 — Run full test suite [ ]

```bash
cd apps/web && node_modules/.bin/vitest run
# Expected: all existing tests pass + 2 new learn page tests

cd apps/api && npx vitest run
# Expected: 22 tests pass (no API changes)
```

---

## Dev Notes

### Files to modify — ONLY these two

1. `apps/web/app/(dashboard)/learn/page.tsx` — add progress bar + lesson count to module cards
2. `apps/web/app/(dashboard)/learn/[moduleSlug]/page.tsx` — add per-lesson status icons
3. `apps/web/app/(dashboard)/learn/page.test.tsx` — new test file (2 tests)

**No API changes. No new queries.**

### Why no new `['progress']` query in the learn page

The `/learn/modules` response (`['modules']` query) already includes `completion_pct`, `lesson_count`, and `completed_lessons` from `getModules()`. There is no need to also call `GET /learn/progress` in the learn page — that would be a redundant network request. The dashboard already uses `['learn-progress']` for its own widget.

### Cache invalidation chain (already wired)

When `completeMutation` fires in `[lessonSlug]/page.tsx`:
1. `qc.invalidateQueries(['modules'])` → `/learn` module cards refresh (AC2)
2. `qc.invalidateQueries(['module', moduleSlug])` → module detail lessons refresh (AC3)
3. `qc.invalidateQueries(['lesson', lessonId])` → lesson page status refreshes

No additional wiring needed.

### `status` field from API

`getModule` returns lessons with `ulp.status` from the JOIN. If the user has no progress row, `status` is `null`. The status indicator logic handles: `null` (not started), `'in_progress'`, `'completed'`. `'not_started'` is a legacy value — treat same as `null`.

### `computeUnlocked` import

Already exported from `apps/web/lib/learn-utils.ts`. The module detail page likely already imports it — verify before re-importing.

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Task 1: `/learn/page.tsx` — module cards already had lesson count + progress bar (AC1); added "Complete ✓" green text label when completion_pct === 100 (AC4), replacing the bare percentage
- Task 2: `[moduleSlug]/page.tsx` — LessonCard already had CheckCircle for completed + Lock for locked; added "Completed" text for completed lessons and "In Progress" text for in_progress status (AC3)
- Task 3: 4 tests in `learn.progress.test.tsx` using renderToStaticMarkup — lesson count display, "Complete ✓" for 100% module, 3/3 lessons, emerald progress bar
- Note: @testing-library/react not installed in project; used renderToStaticMarkup pattern consistent with other tests
- Task 4: 92/92 web tests passing; 69/69 API tests passing; zero regressions
- AC1 ✓: module cards show "X/Y lessons" + progress bar (was already there; confirmed by test)
- AC2 ✓: completeMutation already invalidates ['modules'] + ['module', moduleSlug] — no changes needed
- AC3 ✓: "Completed" label, "In Progress" label, Lock icon all present on module detail page
- AC4 ✓: "Complete ✓" green text shows on 100% complete modules

### File List
- `apps/web/app/(dashboard)/learn/page.tsx` — "Complete ✓" text label for 100% modules
- `apps/web/app/(dashboard)/learn/[moduleSlug]/page.tsx` — "Completed" + "In Progress" status labels
- `apps/web/app/(dashboard)/learn/learn.progress.test.tsx` — new: 4 tests
- `docs/stories/t2-11-learning-progress-tracking.md` — updated
- `docs/stories/sprint-status.yaml` — t2-11 → review
