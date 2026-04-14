# Story T2.2: Sequential Lesson Navigation

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-2-sequential-lesson-navigation
**Date Prepared:** 2026-04-08

---

## Story

As a student,
I want to work through lessons in a module sequentially,
So that each lesson builds on the previous progressively.

---

## Acceptance Criteria

**AC1 — Lessons list with status indicators**
**Given** I open a module
**When** the page loads
**Then** all lessons are listed with titles, estimated time, XP reward, and a visual status: locked / available / complete

**AC2 — First lesson unlocked by default**
**Given** I have not started a module (no progress exists)
**When** I view its lesson list
**Then** only the first lesson is clickable; all subsequent lessons show a lock icon and are not navigable

**AC3 — Completion unlocks the next lesson**
**Given** I complete lesson N
**When** completion is recorded and I return to the module page
**Then** lesson N+1 is now unlocked (clickable), lessons N+2… remain locked

---

## What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/web/app/(dashboard)/learn/[moduleSlug]/page.tsx` | ✅ Complete — needs update | `ModulePage` + `LessonCard` exist. Currently ALL lessons link to `/learn/${moduleSlug}/${lesson.slug}` with no lock enforcement. Only this file changes. |
| `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` | ✅ Complete — DO NOT touch | Lesson detail page, content renderer, quiz UI, auto-start, complete button, XP toast — all working. Zero changes needed. |
| `apps/api/src/controllers/learn.controller.ts` | ✅ Complete — DO NOT touch | `getModule` returns lessons with `status` field from `user_lesson_progress` LEFT JOIN. `status` is `null` for lessons never started. Backend needs no changes. |
| `packages/shared-types/src/gamification.ts` | ✅ Complete — DO NOT touch | Types exist. Use `LessonStatus = 'not_started' | 'in_progress' | 'completed'` |

---

## Tasks / Subtasks

### Task 1 — Add sequential lock logic to `ModulePage` (AC1, AC2, AC3) ✅ [x]

The entire change is confined to `apps/web/app/(dashboard)/learn/[moduleSlug]/page.tsx`.

**1a. Update `LessonCard` signature to accept `isUnlocked` prop:**

```tsx
function LessonCard({
  lesson,
  index,
  moduleSlug,
  isUnlocked,
}: {
  lesson: { id: string; title: string; slug: string; estimated_minutes: number; xp_reward: number; status: string | null };
  index: number;
  moduleSlug: string;
  isUnlocked: boolean;
}) {
```

**1b. Compute `isUnlocked` in `ModulePage` before rendering:**

```tsx
// After: const mod = data as { ... } | undefined;

const lessons = mod?.lessons ?? [];

// Lesson is unlocked if it is the first lesson, OR the previous lesson is completed
const isLessonUnlocked = (index: number): boolean => {
  if (index === 0) return true;
  return lessons[index - 1]?.status === 'completed';
};
```

**1c. Pass `isUnlocked` into each `LessonCard`:**

```tsx
{lessons.map((lesson, i) => (
  <LessonCard
    key={lesson.id}
    lesson={lesson}
    index={i + 1}
    moduleSlug={moduleSlug}
    isUnlocked={isLessonUnlocked(i)}
  />
))}
```

**1d. Update `LessonCard` render — locked card is a `<div>`, unlocked is a `<Link>`:**

```tsx
const isCompleted = lesson.status === 'completed';

if (!isUnlocked) {
  return (
    <div className="card p-4 flex items-center gap-4 opacity-50 cursor-not-allowed">
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-800 shrink-0">
        <Lock size={14} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-500">{lesson.title}</p>
        <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
          <span className="flex items-center gap-1"><Clock size={11} /> {lesson.estimated_minutes} min</span>
          <span className="flex items-center gap-1"><Zap size={11} /> {lesson.xp_reward} XP</span>
        </div>
      </div>
    </div>
  );
}

return (
  <Link
    href={`/learn/${moduleSlug}/${lesson.slug}`}
    className="card p-4 flex items-center gap-4 hover:border-surface-700 transition-all group"
  >
    <div className={cn(
      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
      isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-800 text-slate-400',
    )}>
      {isCompleted ? <CheckCircle size={16} /> : index}
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn('font-medium', isCompleted ? 'text-slate-400' : 'text-white group-hover:text-brand-300 transition-colors')}>
        {lesson.title}
      </p>
      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
        <span className="flex items-center gap-1"><Clock size={11} /> {lesson.estimated_minutes} min</span>
        <span className="flex items-center gap-1 text-brand-400"><Zap size={11} /> {lesson.xp_reward} XP</span>
      </div>
    </div>
    <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 shrink-0" />
  </Link>
);
```

**1e. Add `Lock` to the lucide import line:**

```tsx
import { ChevronLeft, CheckCircle, Clock, Zap, ChevronRight, Lock } from 'lucide-react';
```

---

### Task 2 — Write tests (AC1, AC2, AC3) ✅ [x]

Create `apps/web/app/(dashboard)/learn/[moduleSlug]/page.test.tsx`.

**Test patterns to follow (from T2.1 and T1.x):**
- Mock `@tanstack/react-query` at module level or use `renderHook` with a real `QueryClient`
- The simplest approach is to test the `isLessonUnlocked` logic directly as a pure function

Since `isLessonUnlocked` is a closure inside the component, extract it or test it via the rendered output.

**Recommended: extract as a pure helper and test it directly:**

```tsx
// apps/web/lib/learn-utils.ts  (new file — only if you want to test the pure function)
export function computeUnlocked(
  lessons: { status: string | null }[],
  index: number,
): boolean {
  if (index === 0) return true;
  return lessons[index - 1]?.status === 'completed';
}
```

```tsx
// apps/web/lib/learn-utils.test.ts
import { describe, it, expect } from 'vitest';
import { computeUnlocked } from './learn-utils';

describe('computeUnlocked()', () => {
  it('always unlocks the first lesson', () => {
    expect(computeUnlocked([], 0)).toBe(true);
    expect(computeUnlocked([{ status: null }], 0)).toBe(true);
  });

  it('locks lesson 1 when lesson 0 is not completed', () => {
    expect(computeUnlocked([{ status: null }], 1)).toBe(false);
    expect(computeUnlocked([{ status: 'in_progress' }], 1)).toBe(false);
  });

  it('unlocks lesson 1 when lesson 0 is completed', () => {
    expect(computeUnlocked([{ status: 'completed' }], 1)).toBe(true);
  });

  it('locks lesson 2 when lesson 1 is not completed even if lesson 0 is', () => {
    expect(computeUnlocked([{ status: 'completed' }, { status: 'in_progress' }], 2)).toBe(false);
  });

  it('unlocks lesson 2 when lesson 1 is completed', () => {
    expect(computeUnlocked([{ status: 'completed' }, { status: 'completed' }], 2)).toBe(true);
  });
});
```

**Alternatively**, if you do not want a new utility file, inline the logic and test via React Testing Library — either approach is acceptable. The pure function extraction is preferred for test clarity.

---

## Dev Notes

### The ONLY file to modify is `apps/web/app/(dashboard)/learn/[moduleSlug]/page.tsx`

All backend data is already present. `getModule` already LEFT JOINs `user_lesson_progress` and returns `status` per lesson. For a first-time student with no progress, every lesson's `status` is `null`. The frontend just needs to act on it.

### Status values from the API

```
lesson.status === null        → never started (treat as locked if not index 0)
lesson.status === 'in_progress' → started (treat as locked if not index 0 and prev not completed)
lesson.status === 'completed'   → done (used as the unlock condition for the next lesson)
```

The unlock condition is strictly: `lessons[i-1].status === 'completed'`. `in_progress` does NOT unlock the next lesson.

### Query invalidation already handled in LessonPage

When a student completes a lesson, `LessonPage` (the lesson detail page) already does:

```tsx
qc.invalidateQueries({ queryKey: ['modules'] });
qc.invalidateQueries({ queryKey: ['module', moduleSlug] });
```

This means when the student is redirected back to `ModulePage`, the module query refetches and the new `status` for the just-completed lesson is already `'completed'`, causing the next lesson to unlock automatically. No additional invalidation work needed.

### Do NOT add route-level lock enforcement

The lesson detail page (`[lessonSlug]/page.tsx`) does not need to check whether the lesson is locked. A student who navigates directly to a locked lesson URL still sees the content — this is acceptable for Phase 1. Route-level enforcement (403 or redirect) is out of scope.

### Existing imports in `[moduleSlug]/page.tsx`

```tsx
import { ChevronLeft, CheckCircle, Clock, Zap, ChevronRight } from 'lucide-react';
```

Add `Lock` — it is already available from lucide-react (used in `learn/page.tsx`).

### z-index / overlay: not needed

No modals, overlays, or toasts for this story. The locked card is just a non-interactive `<div>` — no click handler, no tooltip.

### Test runner

```bash
cd apps/api && npx vitest run          # API tests (existing 20 in learn controller)
cd apps/web && npx vitest run          # Web tests (new learn-utils tests)
```

### Project conventions (DO follow)

- `cn()` from `@/lib/utils` for conditional Tailwind classes — already imported in the file
- `opacity-50 cursor-not-allowed` for disabled/locked cards — consistent with T2.1's `opacity-60` on locked Pro cards
- No new dependencies — `Lock` is already in lucide-react

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
- Task 1: Updated `[moduleSlug]/page.tsx` — added `isUnlocked` prop to `LessonCard`; extracted `lessons` array from `mod`; passes `computeUnlocked(lessons, i)` per card. Locked cards render as non-navigable `<div>` with `Lock` icon, `opacity-50 cursor-not-allowed`. Unlocked cards remain `<Link>`. Added `Lock` to lucide import. Added `LessonSummary` type (status: string | null).
- Task 2: Created `apps/web/lib/learn-utils.ts` — `computeUnlocked()` pure helper. Created `apps/web/lib/learn-utils.test.ts` — 9 tests covering: first lesson always unlocked (empty list, null, in_progress, completed), lesson 1 locked when prev null/in_progress, lesson 1 unlocked when prev completed, lesson 2 locked when l1 in_progress/null, lesson 2 unlocked when l1 completed, full 4-lesson chain with gap.
- 55/55 web tests pass (9 new learn-utils + 46 existing). 20/20 API learn controller tests pass. Zero regressions.
- AC1 ✓: all lessons listed with title, estimated time, XP, and locked/available/complete status indicator
- AC2 ✓: first lesson always unlocked; subsequent lessons locked when no prior completion
- AC3 ✓: `computeUnlocked` uses `lessons[i-1].status === 'completed'` as the unlock gate; query invalidation on completion already handled in LessonPage

### File List
- `apps/web/app/(dashboard)/learn/[moduleSlug]/page.tsx` — modified (LessonCard isUnlocked prop, lock rendering, Lock import, LessonSummary type, computeUnlocked usage)
- `apps/web/lib/learn-utils.ts` — created (computeUnlocked pure helper)
- `apps/web/lib/learn-utils.test.ts` — created (9 tests)
- `docs/stories/t2-2-sequential-lesson-navigation.md` — updated (status, task checkboxes, dev record)
- `docs/stories/sprint-status.yaml` — updated (t2-2 → review)

## Change Log
- 2026-04-08: Story prepared by SM (claude-sonnet-4-6)
- 2026-04-08: T2.2 implemented — sequential lock logic, computeUnlocked helper, 9 tests (55 web + 20 API all passing) (claude-sonnet-4-6)
