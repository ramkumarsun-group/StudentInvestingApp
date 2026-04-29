# Story T3.4: Class Roster and Progress Dashboard

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-4-class-roster-and-progress-dashboard
**Date Prepared:** 2026-04-29

---

## Story

As a teacher,
I want to see all my students' activity in a single view,
So that I can identify who is engaged and who needs support.

---

## Acceptance Criteria

**AC1 — Roster table shows full activity columns**
**Given** I open a class detail page with enrolled students
**When** it loads
**Then** I see a table with columns: Rank, Student, Portfolio Return %, XP Earned, Modules Completed, Trades Placed, Last Active date — sorted by portfolio return descending

**AC2 — Data reflects latest student activity**
**Given** a student completes a lesson or places a trade
**When** I refresh the class detail page
**Then** the updated modules completed / trades placed counts are reflected

**AC3 — Empty state shows join code prominently**
**Given** I have no students enrolled in the class
**When** I view the class detail page
**Then** an empty state is shown with the join code in large mono font, a copy button, and the text "Share this code with your students to get started"

---

## Tasks / Subtasks

### Task 1 — Backend: extend `getClassDetail` with trades count and last active

- [ ] In `apps/api/src/controllers/teacher.controller.ts`, update the `getClassDetail` student query to add:
  ```sql
  COUNT(DISTINCT o.id) AS trades_placed,
  MAX(o.created_at) AS last_trade_at,
  MAX(ulp.updated_at) AS last_lesson_at
  ```
  Add to the FROM/JOIN:
  ```sql
  LEFT JOIN orders o ON o.user_id=u.id
  ```
  Compute `last_active` as `GREATEST(MAX(o.created_at), MAX(ulp.updated_at))` — PostgreSQL GREATEST handles NULLs; if both are NULL the student has no activity.

  Updated query signature (add to SELECT and GROUP BY):
  ```sql
  SELECT u.id, u.username, u.avatar_url,
    p.total_value, p.total_return_pct,
    ux.total_xp, ux.current_level, l.name AS level_name,
    COUNT(DISTINCT CASE WHEN ulp.status='completed' THEN ulp.id END) AS lessons_completed,
    COUNT(DISTINCT o.id) AS trades_placed,
    GREATEST(MAX(o.created_at), MAX(ulp.updated_at)) AS last_active
  FROM class_enrollments ce
  JOIN users u ON u.id=ce.student_id
  LEFT JOIN portfolios p ON p.id=ce.portfolio_id
  LEFT JOIN user_xp ux ON ux.user_id=u.id
  LEFT JOIN levels l ON l.id=ux.current_level
  LEFT JOIN user_lesson_progress ulp ON ulp.user_id=u.id
  LEFT JOIN orders o ON o.user_id=u.id
  WHERE ce.class_id=$1
  GROUP BY u.id, p.id, ux.total_xp, ux.current_level, l.name
  ORDER BY p.total_return_pct DESC NULLS LAST
  ```

### Task 2 — Frontend: add Trades Placed and Last Active columns to roster table

- [ ] In `apps/web/app/(teacher)/teacher/classes/[classId]/page.tsx`:
  - Extend the student type:
    ```typescript
    trades_placed: number;
    last_active: string | null;
    ```
  - Add table headers: `Trades` and `Last Active`
  - Render `trades_placed` as a plain number
  - Render `last_active` using dayjs: `last_active ? dayjs(last_active).fromNow() : '—'`
  - Add `dayjs` + `relativeTime` plugin (already used in challenges page — follow same pattern)
  - Add `import dayjs from 'dayjs'` + `import relativeTime from 'dayjs/plugin/relativeTime'` + `dayjs.extend(relativeTime)`

### Task 3 — Frontend: empty state when no students enrolled

- [ ] In `apps/web/app/(teacher)/teacher/classes/[classId]/page.tsx`:
  - When `cls.students.length === 0`, replace the student table with:
    ```tsx
    <div className="card p-12 text-center space-y-4">
      <Users size={48} className="text-on-surface-variant mx-auto" />
      <p className="text-on-surface-variant">No students enrolled yet.</p>
      <p className="text-sm text-on-surface-variant">Share this code with your students:</p>
      <div className="flex items-center justify-center gap-3">
        <span className="bg-surface-container-high text-white px-6 py-3 rounded-xl font-mono tracking-[0.3em] text-3xl font-bold">
          {cls.join_code}
        </span>
        <button onClick={() => handleCopy(cls.join_code)} ...>
          <Copy size={20} />
        </button>
      </div>
    </div>
    ```
  - Re-use `handleCopy` from Task 2 in T3.2 (or implement the same pattern)

### Task 4 — Frontend: summary stats update for trades

- [ ] The existing 4-stat summary grid at the top of the class detail page shows: Students, Avg Return, Avg Portfolio, Avg Lessons. Add or swap one for **Total Trades** (sum of `trades_placed` across all students) — or add it as a 5th stat if grid allows. Use `grid-cols-2 md:grid-cols-4` and add a `lg:grid-cols-5` override.

---

## Dev Notes

### Existing class detail page is partially built
`apps/web/app/(teacher)/teacher/classes/[classId]/page.tsx` already renders:
- Back link, class name, semester header
- 4-stat summary grid (Students, Avg Return, Avg Portfolio, Avg Lessons)
- Student performance table with: Rank, Student (avatar + username + level), Portfolio, Return, XP, Lessons

Tasks 1–4 are additive — do not break existing columns.

### `orders` table for trades count
`orders` is the trade orders table (migration `003_orders.sql`). `LEFT JOIN orders o ON o.user_id=u.id` counts all orders (buy + sell) placed by the student globally — not scoped to the class portfolio. This is intentional for MVP; per-class trade tracking requires challenge_participants scope and is deferred.

### `user_lesson_progress` updated_at
Check that `user_lesson_progress.updated_at` exists (set via `updated_at TIMESTAMPTZ DEFAULT NOW()` with a trigger or explicit UPDATE). If the column doesn't exist, use `ulp.completed_at` as the lesson activity timestamp instead.

### `portfolio_id` in class_enrollments
`class_enrollments.portfolio_id` is the class-specific portfolio (not the global one). The `getClassDetail` query joins on `portfolios p ON p.id=ce.portfolio_id` — so `p.total_return_pct` reflects class portfolio performance. This is correct for class context.

### `NULLS LAST` in ORDER BY
`p.total_return_pct` can be NULL for students whose class portfolio has no trades (return hasn't been calculated yet). `ORDER BY p.total_return_pct DESC NULLS LAST` puts these students at the bottom.

---

## QA Tasks / Test Coverage

### Unit / Integration Tests (API)
- [ ] `GET /teacher/classes/:classId` → response includes `trades_placed` (integer) per student
- [ ] `GET /teacher/classes/:classId` → response includes `last_active` (ISO date or null) per student
- [ ] `GET /teacher/classes/:classId` → students ordered by `total_return_pct DESC NULLS LAST`
- [ ] `GET /teacher/classes/:classId` with no enrolled students → `students: []`
- [ ] `GET /teacher/classes/:classId` with student JWT (not class teacher) → 404

### E2E Tests (Playwright)
- [ ] Teacher opens class detail → table shows columns: Rank, Student, Portfolio Return %, XP, Modules Completed, Trades Placed, Last Active
- [ ] Student with no trades shows `0` for Trades Placed and `—` for Last Active
- [ ] Student with trades shows correct count and relative date ("2 hours ago")
- [ ] Class with no enrolled students → empty state shows join code prominently with copy button
- [ ] Summary stats grid reflects correct student count and averages
- [ ] Teacher views class owned by a different teacher → not accessible (404/redirect)

### QA Agent Record
_to be filled by QA agent after dev completes_

---

## Dev Agent Record

### Agent Model Used
_to be filled on implementation_

### Completion Notes
_to be filled on implementation_

### File List
_to be filled on implementation_

### Change Log
- 2026-04-29: T3.4 story created — class roster and progress dashboard
