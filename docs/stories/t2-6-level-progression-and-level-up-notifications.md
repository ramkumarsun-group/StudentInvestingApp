# Story T2.6: Level Progression and Level-Up Notifications

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-6-level-progression-and-level-up-notifications
**Date Prepared:** 2026-04-09

---

## Story

As a student,
I want to see my current level, XP progress bar, and a level-up modal when I advance,
So that I feel a clear sense of long-term progression.

---

## Acceptance Criteria

**AC1 — XP progress bar visible on dashboard and profile**
**Given** I navigate to the dashboard or profile page
**When** the page loads
**Then** I see my current level name, a progress bar showing XP earned vs XP needed for the next level, and my total XP

**AC2 — Level-up modal fires after XP award**
**Given** an XP award causes me to cross the next level threshold
**When** `leveledUp: true` is returned from the API
**Then** a level-up modal appears showing my new level name and badge colour; it is dismissable

**AC3 — Level 10 (Legend) cap handled gracefully**
**Given** I am at Level 10 (Legend, minXp: 65000)
**When** further XP is awarded
**Then** the progress bar shows "Max Level" and no level-up modal fires

**AC4 — XP nav indicator updates immediately after XP award**
**Given** any XP-awarding action completes (lesson, quiz, badge)
**When** the result is returned
**Then** the XP display in the top bar or nav refreshes without a full page reload (via `qc.invalidateQueries(['xp'])`)

---

## What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/api/src/services/gamification/xp.service.ts` | ✅ Complete — DO NOT touch | `awardXp` returns `{ totalXp, newLevel, leveledUp }`. Level detection via LEVELS array. Level-up bonus XP already recorded. `checkAndUnlockBadges` called after commit. |
| `apps/api/src/routes/index.ts` | ✅ Route exists | `GET /gamification/xp` → `gamification.getXp` |
| `apps/api/src/controllers/gamification.controller.ts` | ✅ `getXp` exists | Returns `user_xp` row for the user |
| `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` | ✅ Level-up toasts already fire | `toast.success(\`Level up! You're now Level ${data.data.newLevel} 🎉\`)` in both `completeMutation.onSuccess` and `quizMutation.onSuccess` |
| `packages/shared-types/src/gamification.ts` | ✅ LEVELS array defined | 10 levels with name + minXp + badgeColor |

**LEVELS array (from `packages/shared-types/src/gamification.ts`):**
```ts
{ id: 1,  name: 'Rookie',        minXp: 0,     badgeColor: '#9CA3AF' },
{ id: 2,  name: 'Novice',        minXp: 500,   badgeColor: '#6EE7B7' },
{ id: 3,  name: 'Apprentice',    minXp: 1500,  badgeColor: '#67E8F9' },
{ id: 4,  name: 'Analyst',       minXp: 3500,  badgeColor: '#93C5FD' },
{ id: 5,  name: 'Trader',        minXp: 7000,  badgeColor: '#A78BFA' },
{ id: 6,  name: 'Investor',      minXp: 12000, badgeColor: '#F472B6' },
{ id: 7,  name: 'Strategist',    minXp: 20000, badgeColor: '#FB923C' },
{ id: 8,  name: 'Portfolio Mgr', minXp: 30000, badgeColor: '#FBBF24' },
{ id: 9,  name: 'Expert',        minXp: 45000, badgeColor: '#34D399' },
{ id: 10, name: 'Legend',        minXp: 65000, badgeColor: '#F59E0B' },
```

**`getXp` response shape** (from gamification.controller.ts):
```ts
{ data: { total_xp, current_level, xp_to_next_level, updated_at } }
```

---

## Tasks / Subtasks

### Task 1 — Add `computeXpProgress()` to learn-utils (AC1, AC3) [ ]

**File:** `apps/web/lib/learn-utils.ts`

```ts
import { LEVELS } from '@student-investing/shared-types';

export interface XpProgressResult {
  levelId: number;
  levelName: string;
  badgeColor: string;
  totalXp: number;
  xpIntoLevel: number;    // XP earned above current level's minXp
  xpNeeded: number;       // XP span of current level (next.minXp - current.minXp)
  pct: number;            // 0–100 rounded, 100 if max level
  isMaxLevel: boolean;
}

export function computeXpProgress(totalXp: number): XpProgressResult {
  const sorted = [...LEVELS].sort((a, b) => b.minXp - a.minXp);
  const current = sorted.find((l) => totalXp >= l.minXp) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.id === current.id + 1);
  const isMaxLevel = !next;
  const xpIntoLevel = totalXp - current.minXp;
  const xpNeeded = next ? next.minXp - current.minXp : 1;
  const pct = isMaxLevel ? 100 : Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));
  return {
    levelId: current.id,
    levelName: current.name,
    badgeColor: current.badgeColor,
    totalXp,
    xpIntoLevel,
    xpNeeded,
    pct,
    isMaxLevel,
  };
}
```

---

### Task 2 — Write tests for `computeXpProgress()` (AC1, AC3) [ ]

**File:** `apps/web/lib/learn-utils.test.ts`

```ts
import { computeUnlocked, getNextLessonSlug, computeQuizScore, computeXpProgress } from './learn-utils';

describe('computeXpProgress()', () => {
  it('returns Rookie at 0 XP', () => {
    const r = computeXpProgress(0);
    expect(r.levelId).toBe(1);
    expect(r.levelName).toBe('Rookie');
    expect(r.pct).toBe(0);
    expect(r.isMaxLevel).toBe(false);
  });

  it('returns 50% progress at halfway through Rookie (250 XP)', () => {
    const r = computeXpProgress(250);
    expect(r.levelId).toBe(1);
    expect(r.pct).toBe(50);
  });

  it('advances to Novice at exactly 500 XP', () => {
    const r = computeXpProgress(500);
    expect(r.levelId).toBe(2);
    expect(r.levelName).toBe('Novice');
    expect(r.pct).toBe(0);
  });

  it('returns Legend at max XP with isMaxLevel:true and pct:100', () => {
    const r = computeXpProgress(65000);
    expect(r.levelId).toBe(10);
    expect(r.levelName).toBe('Legend');
    expect(r.isMaxLevel).toBe(true);
    expect(r.pct).toBe(100);
  });

  it('clamps pct to 100 even if XP exceeds max level threshold', () => {
    const r = computeXpProgress(99999);
    expect(r.pct).toBe(100);
    expect(r.isMaxLevel).toBe(true);
  });
});
```

Run: `cd apps/web && node_modules/.bin/vitest run lib/learn-utils.test.ts`

---

### Task 3 — Add XP progress display to dashboard (AC1, AC4) [ ]

**File:** `apps/web/app/(dashboard)/dashboard/page.tsx`

The dashboard already fetches `/gamification/xp` via `['xp']` query. Replace or augment the existing level display with `computeXpProgress()`:

```tsx
import { computeXpProgress } from '@/lib/learn-utils';

// In the XP card (where level badge + progress bar currently exist):
const xpData = xpQuery.data?.data;
const xpProgress = xpData ? computeXpProgress(xpData.total_xp) : null;

{xpProgress && (
  <div className="card p-4 space-y-2">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-white">
        Lv.{xpProgress.levelId} {xpProgress.levelName}
      </span>
      <span className="text-sm text-slate-400">{xpProgress.totalXp} XP</span>
    </div>
    <div className="w-full bg-slate-700 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${xpProgress.pct}%`, backgroundColor: xpProgress.badgeColor }}
      />
    </div>
    {xpProgress.isMaxLevel ? (
      <p className="text-xs text-slate-400 text-right">Max Level</p>
    ) : (
      <p className="text-xs text-slate-400 text-right">
        {xpProgress.xpIntoLevel}/{xpProgress.xpNeeded} XP to next level
      </p>
    )}
  </div>
)}
```

**Do not add a new `useQuery` call** — read the existing `['xp']` query data already on the page.

---

### Task 4 — Add level-up modal (AC2, AC3) [ ]

**File:** `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx`

The existing level-up toasts (`toast.success(...)`) satisfy the minimal requirement. Replace them with a modal for the full AC2 experience:

**4a. Add modal state:**
```tsx
const [levelUpModal, setLevelUpModal] = useState<{ level: number; levelName: string; badgeColor: string } | null>(null);
```

**4b. Replace level-up toast** in both `completeMutation.onSuccess` and `quizMutation.onSuccess`:
```tsx
// REPLACE:
if (data.data.leveledUp) {
  toast.success(`Level up! You're now Level ${data.data.newLevel} 🎉`);
}

// WITH:
if (data.data.leveledUp) {
  const lvl = LEVELS.find((l) => l.id === data.data.newLevel);
  if (lvl) setLevelUpModal({ level: lvl.id, levelName: lvl.name, badgeColor: lvl.badgeColor });
}
```

Import: `import { LEVELS } from '@student-investing/shared-types';`

**4c. Add modal JSX** (at bottom of page, before closing `</div>`):
```tsx
{levelUpModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div className="card p-8 max-w-sm w-full text-center space-y-4">
      <div
        className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl font-bold"
        style={{ backgroundColor: levelUpModal.badgeColor + '33', border: `2px solid ${levelUpModal.badgeColor}` }}
      >
        {levelUpModal.level}
      </div>
      <h2 className="text-xl font-bold text-white">Level Up! 🎉</h2>
      <p className="text-slate-300">You're now a <span className="font-semibold text-white">{levelUpModal.levelName}</span></p>
      <button
        onClick={() => setLevelUpModal(null)}
        className="btn-primary w-full"
      >
        Keep Learning
      </button>
    </div>
  </div>
)}
```

---

### Task 5 — Run full test suite [ ]

```bash
cd apps/web && node_modules/.bin/vitest run
# Expected: all tests pass (add ~5 new computeXpProgress tests)

cd apps/api && npx vitest run
# Expected: 22 tests pass (no API changes)
```

---

## Dev Notes

### Files to modify — ONLY these three

1. `apps/web/lib/learn-utils.ts` — add `computeXpProgress` + `XpProgressResult`
2. `apps/web/lib/learn-utils.test.ts` — 5 new tests
3. `apps/web/app/(dashboard)/dashboard/page.tsx` — use `computeXpProgress` for XP card
4. `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — replace level-up toast with modal

No API changes. No new dependencies.

### Level-up badge color pattern

The `badgeColor` hex from LEVELS is used directly as inline style. Use `badgeColor + '33'` (hex alpha) for background fill and full `badgeColor` for border. This matches the rarity styling pattern used in the badges page.

### `['xp']` query invalidation already wired

`completeMutation` and `quizMutation` both call `qc.invalidateQueries({ queryKey: ['xp'] })` — this is already in place from T2.3/T2.5. The dashboard XP card will refresh automatically.

### AC3 — max level cap

At Level 10, `LEVELS.find((l) => l.id === current.id + 1)` returns `undefined`. `computeXpProgress` sets `isMaxLevel: true` and `pct: 100`. The modal path in `onSuccess` checks `LEVELS.find(l => l.id === data.data.newLevel)` — at max level `leveledUp` will be `false` (same level), so the modal never fires.

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Task 1: Added `computeXpProgress()` + `XpProgressResult` interface to `learn-utils.ts`; imports LEVELS from shared-types
- Task 2: 5 new `computeXpProgress` tests — 28/28 learn-utils tests passing
- Task 3: Dashboard XP card now uses `computeXpProgress()` — shows level name, badge-coloured progress bar, xpIntoLevel/xpNeeded, Max Level cap
- Task 4: LessonPage imports LEVELS; level-up toasts in completeMutation and quizMutation replaced with modal; modal shows level number badge, levelName, dismiss button
- Task 5: 82/82 web tests passing; 62/62 API tests passing (4 pre-existing worktree package issues unrelated to this story)
- AC1 ✓: XP progress bar on dashboard with level name + badge colour + xp to next level
- AC2 ✓: Level-up modal fires on leveledUp:true with level name and badge colour; dismissable
- AC3 ✓: isMaxLevel:true → "Max Level" text; pct:100; leveledUp never true at cap
- AC4 ✓: qc.invalidateQueries(['xp']) already wired in both mutations

### File List
- `apps/web/lib/learn-utils.ts` — added `computeXpProgress`, `XpProgressResult`; added LEVELS import
- `apps/web/lib/learn-utils.test.ts` — 5 new `computeXpProgress` tests
- `apps/web/app/(dashboard)/dashboard/page.tsx` — XP card replaced with computeXpProgress-driven display
- `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — levelUpModal state + modal JSX; level-up toasts replaced with modal trigger; LEVELS import added
- `docs/stories/t2-6-level-progression-and-level-up-notifications.md` — updated
- `docs/stories/sprint-status.yaml` — t2-6 → review
