# Story T2.5: XP Award System

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-5-xp-award-system
**Date Prepared:** 2026-04-08
**Prerequisite:** T2.3 must be `done` before starting this story (both touch `[lessonSlug]/page.tsx`)

---

## Story

As a student,
I want to see my XP update immediately and be notified when I level up,
So that progress feels responsive and level milestones feel rewarding.

---

## Acceptance Criteria

**AC1 — TopBar XP reflects new XP immediately after quiz submission**
**Given** I submit a correct quiz answer
**When** the XP is awarded
**Then** the TopBar XP total and progress bar update without waiting for the 30-second poll

**AC2 — Level-up toast shown after lesson completion**
**Given** I complete a lesson that pushes me to a new level
**When** completion is recorded
**Then** a "Level up! You're now Level X" toast appears (in addition to the XP toast)

**AC3 — Level-up toast shown after correct quiz answer**
**Given** I answer a quiz correctly and it pushes me to a new level
**When** XP is awarded
**Then** a "Level up! You're now Level X" toast appears (in addition to the XP toast)

---

## What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/api/src/services/gamification/xp.service.ts` | ✅ Complete — DO NOT touch | `awardXp()` returns `{ totalXp, newLevel, leveledUp }` |
| `apps/api/src/controllers/learn.controller.ts` | ✅ Partial — one fix needed | `completeLesson` already spreads `awardXp` result → response includes `leveledUp`/`newLevel`. `submitQuiz` discards `awardXp` result — needs to spread it. |
| `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` | ✅ Modified by T2.3 — extend it | After T2.3: `completeMutation.onSuccess` guards XP toast, invalidates `['modules']`, `['module', moduleSlug]`, navigates to next lesson. Add: `['xp']` invalidation, level-up toast. `quizMutation.onSuccess`: add `['xp']` invalidation + level-up toast. |
| `apps/web/components/layout/TopBar.tsx` | ✅ Complete — DO NOT touch | Fetches `/gamification/xp` with `refetchInterval: 30000`. After `['xp']` invalidation, TanStack Query triggers an immediate refetch — no changes needed. |

---

## Tasks / Subtasks

### Task 1 — Fix `submitQuiz` to return level-up data (AC2, AC3) ✅ [x]

**File:** `apps/api/src/controllers/learn.controller.ts`

In `submitQuiz`, capture the `awardXp` return value and spread it into the response:

```ts
// Replace:
if (correct) {
  await awardXp(userId, 'quiz_correct', quiz.xp_reward, quizId);
}

return res.json({
  data: {
    correct: !!correct,
    explanation: quiz.explanation,
    xpEarned: correct ? quiz.xp_reward : 0,
  },
});

// With:
let leveledUp = false;
let newLevel = 1;
if (correct) {
  const xpResult = await awardXp(userId, 'quiz_correct', quiz.xp_reward, quizId);
  leveledUp = xpResult.leveledUp;
  newLevel = xpResult.newLevel;
}

return res.json({
  data: {
    correct: !!correct,
    explanation: quiz.explanation,
    xpEarned: correct ? quiz.xp_reward : 0,
    leveledUp,
    newLevel,
  },
});
```

Note: `completeLesson` already works correctly — `return res.json({ data: { xpEarned: ..., ...result } })` spreads `leveledUp` and `newLevel` from `awardXp`. No change needed there.

---

### Task 2 — Add level-up toast and XP invalidation to LessonPage (AC1, AC2, AC3) ✅ [x]

**File:** `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx`

**2a. Update `completeMutation.onSuccess`** — add `['xp']` invalidation and level-up toast:

After T2.3, the `completeMutation.onSuccess` looks like:
```tsx
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
```

Update the type and add level-up handling:

```tsx
onSuccess: (data: { data: { xpEarned: number; leveledUp: boolean; newLevel: number } }) => {
  if (data.data.xpEarned > 0) {
    toast.success(`+${data.data.xpEarned} XP earned!`);
  }
  if (data.data.leveledUp) {
    toast.success(`Level up! You're now Level ${data.data.newLevel} 🎉`);
  }
  qc.invalidateQueries({ queryKey: ['modules'] });
  qc.invalidateQueries({ queryKey: ['module', moduleSlug] });
  qc.invalidateQueries({ queryKey: ['xp'] });

  const lessons = (mod as { lessons: { slug: string }[] } | undefined)?.lessons ?? [];
  const nextSlug = getNextLessonSlug(lessons, lessonSlug);
  if (nextSlug) {
    router.push(`/learn/${moduleSlug}/${nextSlug}`);
  } else {
    router.push(`/learn/${moduleSlug}`);
  }
},
```

Note: `qc.invalidateQueries({ queryKey: ['xp'] })` triggers an immediate TopBar refetch (AC1 for lesson completion).

**2b. Update `quizMutation.onSuccess`** — add `['xp']` invalidation and level-up toast:

```tsx
onSuccess: (data: { data: { correct: boolean; explanation: string; xpEarned: number; leveledUp: boolean; newLevel: number } }, vars) => {
  setQuizResults((prev) => ({
    ...prev,
    [vars.quizId]: { correct: data.data.correct, explanation: data.data.explanation },
  }));
  if (data.data.correct) toast.success(`+${data.data.xpEarned} XP`);
  if (data.data.leveledUp) {
    toast.success(`Level up! You're now Level ${data.data.newLevel} 🎉`);
  }
  qc.invalidateQueries({ queryKey: ['xp'] });
},
```

---

### Task 3 — Write tests (AC1, AC3) ✅ [x]

**File:** `apps/api/src/controllers/learn.controller.test.ts`

Add tests to the existing `submitQuiz` describe block:

```ts
it('correct answer returns leveledUp and newLevel', async () => {
  // Setup: mock awardXp to return leveledUp: true, newLevel: 2
  // Verify response includes leveledUp: true, newLevel: 2
  // (Implementation-level: check the awardXp mock is called and result is spread)
  const res = await request(app)
    .post(`/api/v1/learn/quizzes/${quizId}/submit`)
    .set('Authorization', `Bearer ${token}`)
    .send({ optionId: correctOptionId });
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveProperty('leveledUp');
  expect(res.body.data).toHaveProperty('newLevel');
  expect(typeof res.body.data.leveledUp).toBe('boolean');
  expect(typeof res.body.data.newLevel).toBe('number');
});

it('wrong answer returns leveledUp: false', async () => {
  const res = await request(app)
    .post(`/api/v1/learn/quizzes/${quizId}/submit`)
    .set('Authorization', `Bearer ${token}`)
    .send({ optionId: wrongOptionId });
  expect(res.status).toBe(200);
  expect(res.body.data.leveledUp).toBe(false);
  expect(res.body.data.xpEarned).toBe(0);
});
```

---

## Dev Notes

### The ONLY files to modify

1. `apps/api/src/controllers/learn.controller.ts` — submitQuiz: capture awardXp result (2 lines changed)
2. `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — onSuccess handlers (type + invalidation + toast)
3. `apps/api/src/controllers/learn.controller.test.ts` — 2 new tests

### Why `completeLesson` already works

Line 119–122 of learn.controller.ts:
```ts
const result = await awardXp(userId, 'lesson_complete', lesson[0].xp_reward, lessonId);
await recordActivity(userId);
return res.json({ data: { xpEarned: lesson[0].xp_reward, ...result } });
```
`...result` spreads `{ totalXp, newLevel, leveledUp }` into the response. The completeLesson response already has `leveledUp` and `newLevel`.

### TanStack Query invalidation → immediate refetch

When `qc.invalidateQueries({ queryKey: ['xp'] })` is called, TanStack Query marks the `['xp']` cache stale and immediately refetches it (since the TopBar has `useQuery({ queryKey: ['xp'], ... })`). The TopBar XP display will update within ~100ms of mutation success — no polling lag.

### Level-up toast — use `toast.success`

Both `toast.success` calls in the same `onSuccess` handler will queue and display sequentially in Sonner. Show XP toast first, then level-up toast. Both use `toast.success` — keep consistent.

### `alreadyCompleted` path — no level-up

When `alreadyCompleted: true`, `xpEarned: 0` and `leveledUp` is absent (the existing guard `if (data.data.xpEarned > 0)` handles this). No extra guard needed for level-up since `leveledUp` will be `undefined` (falsy) in the `alreadyCompleted` branch.

### Test runner

```bash
cd apps/api && npx vitest run src/controllers/learn.controller.test.ts
# Expected: all existing tests pass + 2 new leveledUp tests
```

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
- Task 1: `submitQuiz` in `learn.controller.ts` — captures `awardXp` return value when correct; spreads `leveledUp` and `newLevel` into response. Wrong-answer path defaults `leveledUp: false, newLevel: 1` without calling `awardXp`. `completeLesson` was already correct (spreads `...result`).
- Task 2: `[lessonSlug]/page.tsx` — `completeMutation.onSuccess` type extended to include `leveledUp`/`newLevel`; level-up toast added after XP toast. `quizMutation.onSuccess` type extended; level-up toast added; `qc.invalidateQueries(['xp'])` added so TopBar refetches immediately on quiz XP award (AC1).
- Task 3: Extended `learn.controller.test.ts` with 2 new `submitQuiz` tests: correct answer includes `leveledUp: true, newLevel: 2` from mocked `awardXp`; wrong answer includes `leveledUp: false` without calling `awardXp`.
- 22/22 API learn tests pass. 68/68 web tests pass. Zero regressions.
- AC1 ✓: `qc.invalidateQueries(['xp'])` in both mutations triggers immediate TopBar refetch (no polling lag)
- AC2 ✓: `completeMutation.onSuccess` shows level-up toast when `data.data.leveledUp === true`
- AC3 ✓: `quizMutation.onSuccess` shows level-up toast when `data.data.leveledUp === true`

### File List
- `apps/api/src/controllers/learn.controller.ts` — modified (submitQuiz: capture awardXp result, spread leveledUp/newLevel)
- `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — modified (completeMutation + quizMutation: ['xp'] invalidation, level-up toasts)
- `apps/api/src/controllers/learn.controller.test.ts` — extended (2 new submitQuiz level-up tests)
- `docs/stories/t2-5-xp-award-system.md` — updated
- `docs/stories/sprint-status.yaml` — updated (t2-5 → in-progress)

## Change Log
- 2026-04-08: Story prepared by SM (claude-sonnet-4-6)
- 2026-04-08: T2.5 implemented — submitQuiz returns leveledUp/newLevel, level-up toasts in both mutations, xp invalidation on quiz, 2 new API tests (22 API + 68 web all passing) (claude-sonnet-4-6)
