# Story T2.3: Lesson Content Renderer

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-3-lesson-content-renderer
**Date Prepared:** 2026-04-08

---

## Story

As a student,
I want to read lesson content with clear visual formatting,
So that I can learn investing concepts through well-structured material.

---

## Acceptance Criteria

**AC1 — Block types render with distinct visual styling**
**Given** I open a lesson
**When** the content loads
**Then** text, callout (tip/warning/info), and key term blocks each render with distinct visual styling

**AC2 — Key term definition shown inline**
**Given** a lesson contains a key term
**When** I view it
**Then** the term is highlighted and its definition is shown inline

**AC3 — Complete Lesson navigates to next lesson**
**Given** I reach the end of a lesson and click "Complete Lesson"
**When** completion is recorded
**Then** XP is awarded (toast), and I am navigated to the next lesson in the module (or back to the module page if this is the last lesson)

---

## What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` | ✅ Mostly complete — two fixes needed | ContentBlock (AC1, AC2) fully implemented. Two fixes: (1) `question_text` snake_case bug in QuizBlock; (2) post-completion navigation to next lesson (AC3). |
| `apps/web/lib/learn-utils.ts` | ✅ Exists — extend it | `computeUnlocked()` lives here. Add `getNextLessonSlug()` helper here for testability. |
| `apps/web/lib/learn-utils.test.ts` | ✅ Exists — extend it | Add tests for `getNextLessonSlug()` alongside existing `computeUnlocked()` tests. |
| `apps/api/src/controllers/learn.controller.ts` | ✅ Complete — DO NOT touch | `getLesson` returns `question_text` (snake_case) — this is correct and intentional. The frontend type cast needs fixing, not the API. |
| `packages/shared-types/src/gamification.ts` | ✅ Complete — DO NOT touch | `Quiz.questionText` is camelCase — it is a type hint only. Runtime data is snake_case from API. Do not change the type. |

---

## Tasks / Subtasks

### Task 1 — Fix `question_text` snake_case bug in LessonPage (AC1) ✅ [x]

**Root cause:** `LessonPage` casts `lessonData` as `{ quizzes: Quiz[] }` where `Quiz.questionText` is camelCase. But `getLesson` returns `question_text` (snake_case from DB). At runtime `quiz.questionText` is `undefined` and the question text doesn't render.

**Fix in `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx`:**

Replace the `lesson` type cast to use a local inline type with snake_case quiz fields:

```tsx
// Replace:
const lesson = lessonData as {
  id: string; title: string; content_json: LessonBlock[]; xp_reward: number;
  status: string; quizzes: Quiz[];
} | undefined;

// With (note: quizzes uses ApiQuiz with snake_case fields):
type ApiQuiz = {
  id: string;
  question_text: string;
  options: { id: string; text: string }[];
  explanation: string;
  xp_reward: number;
};

const lesson = lessonData as {
  id: string; title: string; content_json: LessonBlock[]; xp_reward: number;
  status: string; quizzes: ApiQuiz[];
} | undefined;
```

Update `QuizBlock` props and render to use `question_text` and `xp_reward`:

```tsx
function QuizBlock({
  quiz,
  selectedOptionId,
  result,
  onSelect,
}: {
  quiz: ApiQuiz;
  selectedOptionId?: string;
  result?: { correct: boolean; explanation: string };
  onSelect: (optionId: string) => void;
}) {
  return (
    <div className="card p-5 space-y-4">
      <p className="font-medium text-white">{quiz.question_text}</p>
      {/* rest of render unchanged */}
    </div>
  );
}
```

Update `quizMutation` result type to use `xp_reward` → already uses `xpEarned` from the response body — no change needed there (the API response uses `xpEarned` camelCase in the JSON body intentionally).

---

### Task 2 — Add "next lesson" navigation after completion (AC3) ✅ [x]

**2a. Add `getNextLessonSlug` helper to `apps/web/lib/learn-utils.ts`:**

```ts
/**
 * Returns the slug of the next lesson in the module, or null if current is the last.
 */
export function getNextLessonSlug(
  lessons: { slug: string }[],
  currentSlug: string,
): string | null {
  const idx = lessons.findIndex((l) => l.slug === currentSlug);
  if (idx === -1 || idx === lessons.length - 1) return null;
  return lessons[idx + 1].slug;
}
```

**2b. Update `completeMutation` in `LessonPage` to navigate to next lesson:**

```tsx
const { moduleSlug, lessonSlug } = useParams<{ moduleSlug: string; lessonSlug: string }>();

// mod is already fetched via ['module', moduleSlug] query
// mod.lessons is the full lesson list

const completeMutation = useMutation({
  mutationFn: () => apiClient.post(`/learn/lessons/${lessonId}/complete`, {}),
  onSuccess: (data: { data: { xpEarned: number } }) => {
    if (data.data.xpEarned > 0) {
      toast.success(`+${data.data.xpEarned} XP earned!`);
    }
    qc.invalidateQueries({ queryKey: ['modules'] });
    qc.invalidateQueries({ queryKey: ['module', moduleSlug] });

    const lessons = (mod as { lessons: { slug: string }[] } | undefined)?.lessons ?? [];
    const nextSlug = getNextLessonSlug(lessons, lessonSlug);
    if (nextSlug) {
      router.push(`/learn/${moduleSlug}/${nextSlug}`);
    } else {
      router.push(`/learn/${moduleSlug}`);
    }
  },
});
```

Import `getNextLessonSlug`:
```tsx
import { getNextLessonSlug } from '@/lib/learn-utils';
```

Note: `lessonSlug` is already destructured from `useParams` in the existing file.

**2c. Also invalidate `['module', moduleSlug]`** — the existing mutation only invalidates `['modules']` (plural, the module list). Add `['module', moduleSlug]` so the lesson status updates immediately when navigating to the next lesson.

---

### Task 3 — Write tests (AC3 logic) ✅ [x]

Extend `apps/web/lib/learn-utils.test.ts` with `getNextLessonSlug` tests:

```ts
import { computeUnlocked, getNextLessonSlug } from './learn-utils';

describe('getNextLessonSlug()', () => {
  const lessons = [
    { slug: 'lesson-1' },
    { slug: 'lesson-2' },
    { slug: 'lesson-3' },
  ];

  it('returns next lesson slug for middle lesson', () => {
    expect(getNextLessonSlug(lessons, 'lesson-1')).toBe('lesson-2');
    expect(getNextLessonSlug(lessons, 'lesson-2')).toBe('lesson-3');
  });

  it('returns null for last lesson', () => {
    expect(getNextLessonSlug(lessons, 'lesson-3')).toBeNull();
  });

  it('returns null when slug not found', () => {
    expect(getNextLessonSlug(lessons, 'nonexistent')).toBeNull();
  });

  it('returns null for empty lessons array', () => {
    expect(getNextLessonSlug([], 'lesson-1')).toBeNull();
  });

  it('returns null for single-lesson module', () => {
    expect(getNextLessonSlug([{ slug: 'only-lesson' }], 'only-lesson')).toBeNull();
  });
});
```

---

## Dev Notes

### The ONLY files to modify

1. `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — two targeted fixes
2. `apps/web/lib/learn-utils.ts` — add `getNextLessonSlug` export
3. `apps/web/lib/learn-utils.test.ts` — extend with 5 new tests

Backend is untouched. No new dependencies.

### `question_text` vs `questionText` — the pattern

This is the same snake_case convention established in T2.1 (`completion_pct` fix). The API always returns raw DB rows in snake_case. The `Quiz` shared-type uses camelCase but is a loose type hint. At the boundary, cast to a local `ApiQuiz` type with snake_case fields — do NOT transform or add an axios interceptor.

Confirm the pattern: `quizzes` table column is `question_text`. The API `getLesson` controller selects it as `question_text`. No alias, no transform.

### `allQuizzesAnswered` — no change needed

The existing check:
```tsx
const allQuizzesAnswered = lesson.quizzes.length === 0 || lesson.quizzes.every((q) => quizResults[q.id] !== undefined);
```
Still works — `q.id` is correct regardless of casing fix.

### `quizMutation` response — already uses `xpEarned`

The `submitQuiz` controller returns `{ data: { correct, explanation, xpEarned } }` — camelCase in the JSON body. This is correct. The `quizMutation.onSuccess` callback already reads `data.data.xpEarned` — no change needed.

### `completeMutation` XP toast — guard against 0 XP

The existing code always shows the XP toast. When a lesson is already completed (`alreadyCompleted: true`), `xpEarned` is 0. Guard the toast:
```tsx
if (data.data.xpEarned > 0) {
  toast.success(`+${data.data.xpEarned} XP earned!`);
}
```

### ContentBlock — AC1/AC2 already complete

`ContentBlock` in `[lessonSlug]/page.tsx` already handles:
- `text` → `<p className="text-slate-300 leading-relaxed">`
- `callout` with `warning`/`tip`/`info` variants → distinct colored bordered boxes
- `key_term` → `bg-surface-800` card with `text-brand-400 font-semibold` term + `text-slate-300` definition always visible inline

No changes needed to `ContentBlock`. AC1 and AC2 are satisfied by the existing implementation.

### DB content_json block format (from seed data)

All `content_json` blocks use these fields — matches `LessonBlock` interface exactly:
```ts
{ type: 'text', content: '...' }
{ type: 'key_term', term: '...', definition: '...' }
{ type: 'callout', variant: 'tip'|'info'|'warning', content: '...' }
```

No `image` blocks in seed data. The `type === 'image'` case returns `null` from `ContentBlock` — acceptable for Phase 1.

### Test runner

```bash
cd apps/web && node_modules/.bin/vitest run lib/learn-utils.test.ts
# Expected: 14 tests pass (9 existing computeUnlocked + 5 new getNextLessonSlug)
```

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
- Task 1: Introduced module-level `ApiQuiz` type with snake_case `question_text` field. Removed `Quiz` import from shared-types (no longer needed). Updated `lesson` cast to use `ApiQuiz[]`. Updated `QuizBlock` signature + render to use `quiz.question_text`.
- Task 2: Added `getNextLessonSlug()` to `apps/web/lib/learn-utils.ts`. Updated `completeMutation.onSuccess`: (a) guards XP toast with `xpEarned > 0` check, (b) adds `['module', moduleSlug]` invalidation, (c) navigates to next lesson slug or falls back to module page.
- Task 3: Extended `learn-utils.test.ts` — 5 new `getNextLessonSlug()` tests: next-lesson for middle lessons, null for last, null for not-found slug, null for empty array, null for single-lesson module.
- 14/14 learn-utils tests pass (9 computeUnlocked + 5 getNextLessonSlug). 60/60 full web suite passing. Zero regressions.
- AC1 ✓: `ContentBlock` already handles text/callout/key_term — no change needed
- AC2 ✓: key_term block renders term + definition inline — already complete
- AC3 ✓: completeMutation navigates to next lesson (or module if last); `['module', moduleSlug]` invalidation ensures unlock state is fresh

### File List
- `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — modified (ApiQuiz type, question_text fix, next-lesson navigation, module query invalidation, XP toast guard)
- `apps/web/lib/learn-utils.ts` — modified (added getNextLessonSlug)
- `apps/web/lib/learn-utils.test.ts` — modified (5 new getNextLessonSlug tests)
- `docs/stories/t2-3-lesson-content-renderer.md` — updated
- `docs/stories/sprint-status.yaml` — updated (t2-3 → ready-for-dev)

## Change Log
- 2026-04-08: Story prepared by SM (claude-sonnet-4-6)
- 2026-04-08: T2.3 implemented — ApiQuiz type, question_text fix, next-lesson navigation, module invalidation, XP toast guard, 5 new tests (60 web all passing) (claude-sonnet-4-6)
