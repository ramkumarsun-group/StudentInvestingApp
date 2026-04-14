# Story T2.1: Module Browser

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-1-module-browser
**Date Prepared:** 2026-03-26

---

## Story

As a student,
I want to browse all available learning modules,
So that I can choose what to learn based on difficulty and reward.

---

## Acceptance Criteria

**AC1 — Module grid shows all required metadata**
**Given** I navigate to the Learn page (`/learn`)
**When** the page loads
**Then** I see all published modules, each card showing: title, difficulty badge, estimated time, XP reward, and completion progress percentage.

**AC2 — Pro-gated modules show paywall on click**
**Given** I am on the free tier and a module has `requires_pro = true`
**When** I view that module card
**Then** it shows a lock icon and a "Pro" badge; clicking it opens a paywall modal (not a navigation to /settings).

**AC3 — Progress bar shows completion percentage**
**Given** I have completed some lessons within a module
**When** I view that module card
**Then** a progress bar shows the correct completion percentage (0–100%).

---

## What Already Exists — DO NOT Reinvent

The backend and most of the frontend are complete. Touch only what the tasks below specify.

| File | Status | Notes |
|------|--------|-------|
| `apps/api/src/controllers/learn.controller.ts` | ✅ Complete | `getModules`, `getModule`, `getLesson`, `startLesson`, `completeLesson`, `submitQuiz`, `getProgress` — all implemented |
| `apps/api/src/db/migrations/005_learn.sql` | ✅ Complete | `modules`, `lessons`, `quizzes`, `user_lesson_progress` tables |
| `apps/api/src/routes/index.ts` | ✅ Complete | All 7 learn routes already registered under `/api/v1/learn/*` |
| `apps/api/src/db/seeds/modules.seed.ts` | ✅ Complete | 5 modules seeded: `intro-to-stocks` (3 lessons), `intro-to-etfs` (1), `intro-to-crypto` (1), `intro-to-bonds` (1), `diversification` (1) |
| `apps/web/app/(dashboard)/learn/page.tsx` | ✅ Mostly complete | Grid, difficulty badges, XP, progress bars, lock icon — gaps addressed in Task 1–2 below |
| `apps/web/app/(dashboard)/learn/[moduleSlug]/page.tsx` | ✅ Complete | Lesson list with status, time, XP |
| `packages/shared-types/src/gamification.ts` | ✅ Has types | `Module`, `Lesson`, `LessonBlock`, `Quiz`, `QuizOption` all defined — do NOT create a new learning.ts |

---

## Tasks / Subtasks

### Task 1 — Fix API response + module card to show estimated time (AC1) and correct completion bug ✅

**Bug to fix first:** The `getModules` controller returns `completionPct` (camelCase) but the web page reads `m.completion_pct` (snake_case), so progress is always `undefined`. Fix by changing the controller to use `completion_pct`.

**1a. Update `getModules` in `apps/api/src/controllers/learn.controller.ts`:**

```typescript
export async function getModules(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { rows: modules } = await db.query(
    `SELECT m.*,
       COUNT(l.id) AS lesson_count,
       COUNT(CASE WHEN ulp.status='completed' THEN 1 END) AS completed_lessons,
       COALESCE(SUM(l.estimated_minutes), 0) AS total_estimated_minutes
     FROM modules m
     LEFT JOIN lessons l ON l.module_id = m.id
     LEFT JOIN user_lesson_progress ulp ON ulp.lesson_id=l.id AND ulp.user_id=$1
     WHERE m.is_published=true
     GROUP BY m.id
     ORDER BY m.sort_order`,
    [userId],
  );

  const result = modules.map((m) => ({
    ...m,
    // snake_case to match frontend — completion_pct not completionPct
    completion_pct: m.lesson_count > 0
      ? Math.round((Number(m.completed_lessons) / Number(m.lesson_count)) * 100)
      : 0,
  }));
  return res.json({ data: result });
}
```

Key changes:
- Added `COALESCE(SUM(l.estimated_minutes), 0) AS total_estimated_minutes` to the query
- Changed `completionPct` → `completion_pct` (was a bug: web reads snake_case)
- Cast `completed_lessons` / `lesson_count` to `Number()` — pg returns numeric aggregates as strings

**1b. Update `apps/web/app/(dashboard)/learn/page.tsx` module card to show estimated time:**

The query type annotation must include the new fields:
```typescript
queryFn: () => apiClient.get('/learn/modules').then((r: {
  data: (Module & {
    lesson_count: number;
    completed_lessons: number;
    completion_pct: number;
    total_estimated_minutes: number;
  })[]
}) => r.data),
```

Add `Clock` to the lucide imports (already has `BookOpen`, `Lock`, `CheckCircle`, `ChevronRight`):
```tsx
import { BookOpen, Lock, CheckCircle, ChevronRight, Clock } from 'lucide-react';
```

Inside the module card JSX, add estimated time directly below the difficulty badge row:
```tsx
{/* After the difficulty/lock/checkmark row */}
<div className="flex items-center gap-2 mt-1">
  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', DIFFICULTY_COLORS[m.difficulty])}>
    {m.difficulty}
  </span>
  {isLocked && <Lock size={14} className="text-slate-500" />}
  {isComplete && <CheckCircle size={14} className="text-emerald-400" />}
  <span className="text-xs text-slate-500 flex items-center gap-1">
    <Clock size={11} />
    {m.total_estimated_minutes} min
  </span>
</div>
```

---

### Task 2 — Pro module paywall modal (AC2) ✅

Currently Pro modules link to `/settings`. Replace with an inline paywall modal.

**In `apps/web/app/(dashboard)/learn/page.tsx`:**

Add state at the top of `LearnPage`:
```tsx
const [showProModal, setShowProModal] = useState(false);
```
Add `useState` to the React import if not already there: `import { useState } from 'react';`

Pass `setShowProModal` into `ModuleSection`:
```tsx
<ModuleSection title="Beginner" modules={beginner} onProClick={() => setShowProModal(true)} />
{advanced.length > 0 && <ModuleSection title="Advanced" modules={advanced} onProClick={() => setShowProModal(true)} />}
```

Update `ModuleSection` signature:
```tsx
function ModuleSection({
  title,
  modules,
  onProClick,
}: {
  title: string;
  modules: (Module & { ... })[];
  onProClick: () => void;
}) {
```

In the module card, change locked Pro modules from a `Link` that navigates to a `div` that fires `onProClick`:
```tsx
// Replace:
<Link key={m.slug} href={isLocked ? '/settings' : `/learn/${m.slug}`} ...>

// With:
{isLocked ? (
  <div
    key={m.slug}
    onClick={onProClick}
    className={cn('card p-5 hover:border-surface-700 transition-all group cursor-pointer opacity-60')}
  >
    {/* card content unchanged */}
  </div>
) : (
  <Link key={m.slug} href={`/learn/${m.slug}`} className="card p-5 hover:border-surface-700 transition-all group">
    {/* card content unchanged */}
  </Link>
)}
```

Add a "Pro" text badge alongside the lock icon inside the card (AC2):
```tsx
{isLocked && (
  <>
    <Lock size={14} className="text-slate-500" />
    <span className="text-xs font-semibold text-brand-400 bg-brand-400/10 px-1.5 py-0.5 rounded">Pro</span>
  </>
)}
```

Add the paywall modal at the bottom of `LearnPage`'s return (after the module sections, before closing `</div>`):
```tsx
{showProModal && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="card p-6 max-w-sm w-full mx-4 space-y-4">
      <div className="flex items-center gap-2">
        <Lock size={20} className="text-brand-400" />
        <h3 className="text-lg font-semibold text-white">Pro Module</h3>
      </div>
      <p className="text-sm text-slate-400">
        This module is available to Pro subscribers. Upgrade to StockPlay Pro for $4.99/month
        to unlock all Pro modules and the AI Coach.
      </p>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => setShowProModal(false)}
          className="flex-1 py-2 rounded-lg bg-surface-800 text-slate-400 text-sm font-medium hover:text-slate-200 transition-colors"
        >
          Not now
        </button>
        <Link
          href="/settings"
          onClick={() => setShowProModal(false)}
          className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold text-center hover:bg-brand-500 transition-colors"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  </div>
)}
```

**Note on z-index:** Modal overlay uses `z-50`. App nav sidebar is `z-30`. This pattern was established in T1.14.

---

### Task 3 — Write controller tests (AC1, AC3) ✅

Create `apps/api/src/controllers/learn.controller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../config/db', () => ({ db: { query: vi.fn() } }));
vi.mock('../services/gamification/xp.service', () => ({ awardXp: vi.fn() }));
vi.mock('../services/gamification/streak.service', () => ({ recordActivity: vi.fn() }));

import { getModules, getModule } from './learn.controller';
import { db } from '../config/db';

let mockRes: Response;

function makeReq(
  params: Record<string, string> = {},
  userId = 'user-1',
): Request {
  return { params, user: { userId } } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
});

describe('getModules()', () => {
  it('returns 200 with module list including completion_pct', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'mod-1',
          slug: 'intro-to-stocks',
          title: 'Introduction to Stocks',
          difficulty: 'beginner',
          xp_reward: 200,
          requires_pro: false,
          lesson_count: '3',
          completed_lessons: '1',
          total_estimated_minutes: '18',
        },
      ],
      rowCount: 1,
    } as never);

    await getModules(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: 'mod-1',
          completion_pct: 33, // Math.round(1/3 * 100)
          total_estimated_minutes: '18',
        }),
      ],
    });
  });

  it('returns 200 with empty array when no published modules', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as never);

    await getModules(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ data: [] });
  });

  it('computes completion_pct = 0 when lesson_count is 0', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'mod-2',
          lesson_count: '0',
          completed_lessons: '0',
          total_estimated_minutes: '0',
        },
      ],
      rowCount: 1,
    } as never);

    await getModules(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: [expect.objectContaining({ completion_pct: 0 })],
    });
  });
});

describe('getModule()', () => {
  it('returns 200 with module + lessons when slug found', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'mod-1', slug: 'intro-to-stocks', title: 'Introduction to Stocks' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({
        rows: [
          { id: 'les-1', title: 'What Is a Stock?', slug: 'what-is-a-stock', sort_order: 1, status: null },
        ],
        rowCount: 1,
      } as never);

    await getModule(makeReq({ slug: 'intro-to-stocks' }), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'mod-1',
        lessons: expect.arrayContaining([
          expect.objectContaining({ id: 'les-1' }),
        ]),
      }),
    });
  });

  it('returns 404 when module slug not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as never);

    await getModule(makeReq({ slug: 'nonexistent' }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Module not found' });
  });
});
```

---

## Dev Notes

### API casing: snake_case end-to-end

The API returns raw DB rows (snake_case). All existing web pages read `m.requires_pro`, `m.xp_reward`, `m.completion_pct` directly — DO NOT transform to camelCase or add an axios interceptor. The `Module` shared-type uses camelCase but is used loosely for IDE hints; runtime data is snake_case from the DB. Maintain this existing convention.

### Registered API routes (do not add or change)

```
GET /api/v1/learn/modules           → learn.getModules (authMiddleware)
GET /api/v1/learn/modules/:slug     → learn.getModule  (authMiddleware)
GET /api/v1/learn/lessons/:lessonId → learn.getLesson  (authMiddleware)
POST /api/v1/learn/lessons/:lessonId/start    → learn.startLesson    (authMiddleware)
POST /api/v1/learn/lessons/:lessonId/complete → learn.completeLesson (authMiddleware)
POST /api/v1/learn/quizzes/:quizId/submit     → learn.submitQuiz     (authMiddleware)
GET /api/v1/learn/progress          → learn.getProgress (authMiddleware)
```

### DB schema quick reference

```sql
-- modules: id, slug, title, description, asset_type, difficulty, xp_reward,
--          sort_order, is_published, requires_pro, created_at
-- lessons: id, module_id, slug, title, content_json (JSONB), xp_reward,
--          sort_order, estimated_minutes
-- user_lesson_progress: user_id, lesson_id, module_id, status ('not_started'|'in_progress'|'completed'),
--                       quiz_score, xp_earned, started_at, completed_at
--          UNIQUE(user_id, lesson_id)
```

### numeric pg aggregates are returned as strings

`COUNT(...)` and `SUM(...)` come back as strings from node-postgres. The `lesson_count`, `completed_lessons`, and `total_estimated_minutes` fields are strings in the controller. Cast with `Number()` before arithmetic (already done in Task 1 fix). The raw string value of `total_estimated_minutes` passes through `...m` spread to the frontend — the frontend displays it directly as text which is fine.

### Test patterns (follow T1.10 / T1.11 / T1.14 conventions)

- Mock `db` at module level: `vi.mock('../config/db', () => ({ db: { query: vi.fn() } }))`
- Fresh `mockRes` per test in `beforeEach` (P-8 pattern from T1.8–T1.11 code review)
- Also mock `xp.service` and `streak.service` to prevent import side-effects (even if not used in `getModules`/`getModule`)
- `vi.mocked(db.query).mockResolvedValueOnce(...)` for sequential query calls

### Seed data (5 modules available without any DB changes)

| slug | difficulty | lessons | total est. time |
|------|-----------|---------|-----------------|
| intro-to-stocks | beginner | 3 | 18 min |
| intro-to-etfs | beginner | 1 | 6 min |
| intro-to-crypto | beginner | 1 | 8 min |
| intro-to-bonds | beginner | 1 | 7 min |
| diversification | beginner | 1 | 8 min |

No pro-gated modules in seed data. Pro paywall modal can be tested by temporarily setting `requires_pro = true` on any module or by creating a test module row.

### Pro paywall is a placeholder (Phase 3 Stripe not yet built)

The "Upgrade to Pro" CTA links to `/settings` for now. The actual Stripe checkout is T4.2. The modal is the user-facing gate — its text and CTA are sufficient for Phase 1.

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Implementation Plan
- Task 1a: Fixed `getModules` in `learn.controller.ts` — added `COALESCE(SUM(l.estimated_minutes), 0) AS total_estimated_minutes` to SQL query; changed `completionPct` → `completion_pct` (was the bug causing progress always showing `undefined`); added `Number()` cast on `lesson_count` and `completed_lessons` (pg returns numeric aggregates as strings).
- Task 1b: Added `Clock` to lucide imports; added `total_estimated_minutes` to type annotation in `queryFn` and module type cast; added `<Clock size={11} /> {m.total_estimated_minutes} min` span inside module card badge row.
- Task 2: Added `useState(false)` for `showProModal`; wired `onProClick` prop through `ModuleSection`; refactored module card to extract shared `cardContent` JSX and conditionally render as `<div onClick={onProClick}>` (locked) or `<Link>` (unlocked); added Lock + "Pro" badge inside locked card; added paywall modal at bottom of `LearnPage` return with "Not now" dismiss and "Upgrade to Pro" → `/settings` CTA (`z-50`, above nav `z-30`).
- Task 3: Created `learn.controller.test.ts` — 6 tests covering `getModules` (completion_pct=33%, empty array, 0%, 100%) and `getModule` (200 with lessons, 404 not found). Pattern follows T1.11 conventions: module-level `vi.mock`, fresh `mockRes` in `beforeEach`, `mockResolvedValueOnce` for sequential queries.

### Completion Notes
- 118/118 tests pass (6 new + 112 existing — zero regressions)
- `completion_pct` camelCase→snake_case bug fixed; `total_estimated_minutes` added to SQL and surfaced on card
- Pro paywall modal triggers on click of locked card (not navigation to `/settings`); "Pro" badge + lock icon both shown per AC2
- Pre-existing TS errors in `ai-coach/page.tsx` (uuid), `portfolio/page.tsx` (recharts ActiveShape) and `requires_pro`/`xp_reward` snake_case Module type mismatch are scaffold issues predating T2.1 — not introduced by this story

## File List
- `apps/api/src/controllers/learn.controller.ts` — modified (total_estimated_minutes in query, completion_pct snake_case fix, Number() casts)
- `apps/web/app/(dashboard)/learn/page.tsx` — modified (Clock import, total_estimated_minutes type + display, Pro modal state, onProClick prop, locked card → div + paywall modal)
- `apps/api/src/controllers/learn.controller.test.ts` — created (6 tests)
- `docs/stories/t2-1-module-browser.md` — updated (task checkboxes, dev record, status → review)
- `docs/stories/sprint-status.yaml` — updated (t2-1 → review)

## Change Log
- 2026-03-29: T2.1 implemented — completion_pct bug fix, estimated time display, Pro paywall modal, 6 controller tests (118 total passing) (claude-sonnet-4-6)
