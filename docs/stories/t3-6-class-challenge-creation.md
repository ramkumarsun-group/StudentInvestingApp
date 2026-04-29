# Story T3.6: Class Challenge Creation

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-6-class-challenge-creation
**Date Prepared:** 2026-04-29

> **Dev Agent Instruction:** Complete ALL Dev Tasks first, then switch to the QA persona (Quinn 🧪) and implement ALL QA Tasks before marking this story done. The story is not complete until both sections are fully checked off.

---

## Story

As a teacher,
I want to create a time-bounded challenge with defined rules,
So that I can motivate students through structured competition.

---

## Acceptance Criteria

**AC1 — Teacher creates a challenge from class detail page**
**Given** I am on a class detail page and click "Create Challenge"
**When** I fill in name, description, challenge type, start date, end date, and optional XP reward and submit
**Then** the challenge is saved with `status='scheduled'` and appears in the class's challenge list

**AC2 — Future-start challenge shows as Upcoming to students**
**Given** I set `starts_at` to a future date and time
**When** enrolled students view the Challenges page before that date
**Then** the challenge shows as "Upcoming" with a countdown to start

**AC3 — Completed challenges freeze final rankings**
**Given** a challenge's `ends_at` has passed
**When** a student views the challenge
**Then** it shows "Completed" status with frozen final rankings; the Join button is absent

**AC4 — Challenge list appears on class detail page**
**Given** one or more challenges exist for a class
**When** a teacher views the class detail page
**Then** a "Challenges" section lists all challenges with name, type, dates, and participant count

---

## Tasks / Subtasks

### Task 1 — Backend: `createChallenge` already implemented ✅

`POST /teacher/classes/:classId/challenges` already exists in `challenge.controller.ts` and routes. It accepts:
- `classId` (from URL param, merged into `req.body.classId`)
- `title`, `description`, `challengeType`, `targetValue`, `xpReward`, `startsAt`, `endsAt`
- Inserts with `status='scheduled'`

**Note:** The route handler extracts `classId` from `req.body` but the route URL has `:classId` — verify that the controller merges the URL param into the body, or update to use `req.params.classId`.

### Task 2 — Backend: challenges list for a class (new endpoint)

- [ ] In `apps/api/src/controllers/challenge.controller.ts`, add:
  ```typescript
  export async function getClassChallenges(req: Request, res: Response) {
    const { classId } = req.params;
    const { rows } = await db.query(
      `SELECT c.*,
         COUNT(cp.id) AS participant_count
       FROM challenges c
       LEFT JOIN challenge_participants cp ON cp.challenge_id=c.id
       WHERE c.class_id=$1
       GROUP BY c.id
       ORDER BY c.starts_at DESC`,
      [classId],
    );
    return res.json({ data: rows });
  }
  ```
- [ ] Register in `apps/api/src/routes/index.ts`:
  ```typescript
  router.get('/teacher/classes/:classId/challenges', authMiddleware, requireRole('teacher', 'admin'), challenge.getClassChallenges);
  ```

### Task 3 — Backend: status transition cron (scheduled → active → completed)

- [ ] In `apps/api/src/jobs/index.ts`, add a `updateChallengeStatuses` job scheduled every minute:
  ```typescript
  export async function updateChallengeStatuses() {
    const now = new Date().toISOString();
    // Activate scheduled challenges whose starts_at has passed
    await db.query(
      `UPDATE challenges SET status='active'
       WHERE status='scheduled' AND starts_at <= $1`,
      [now],
    );
    // Complete active challenges whose ends_at has passed
    await db.query(
      `UPDATE challenges SET status='completed'
       WHERE status='active' AND ends_at <= $1`,
      [now],
    );
  }
  ```
  Schedule: `cron.schedule('* * * * *', updateChallengeStatuses)`

### Task 4 — Frontend: "Create Challenge" form on class detail page

- [ ] In `apps/web/app/(teacher)/teacher/classes/[classId]/page.tsx`:
  - Add a "Create Challenge" button in the page header (alongside existing actions)
  - Add `showChallenge` state (`useState(false)`) and a modal with:
    - Title input (required)
    - Description textarea (optional)
    - Challenge Type select: `return_pct | quiz_score | module_complete | streak`
    - Start Date (datetime-local input)
    - End Date (datetime-local input)
    - XP Reward number input (default 200)
    - Validate: end date must be after start date; title required
  - Mutation: `apiClient.post(`/teacher/classes/${classId}/challenges`, { title, description, challengeType, targetValue: null, xpReward, startsAt, endsAt })`
  - On success: `toast.success('Challenge created!')`, close modal, invalidate `['class-challenges', classId]`

### Task 5 — Frontend: class challenges section on class detail page

- [ ] Below the student performance table, add a "Challenges" section:
  - Query: `GET /api/v1/teacher/classes/:classId/challenges` → `['class-challenges', classId]`
  - Render each challenge as a compact row showing: title, type badge, `starts_at – ends_at`, participant count, status pill
  - Status pill colours:
    - `scheduled` → yellow (`bg-yellow-400/10 text-yellow-400`)
    - `active` → green (`bg-positive/10 text-positive`)
    - `completed` → muted (`bg-surface-container-high text-on-surface-variant`)
  - Empty state: "No challenges yet — create one to motivate your students"

---

## Dev Notes

### `challenges` table schema (from `009_challenges.sql`)
```sql
id, class_id, created_by, title, description, challenge_type,
target_value, xp_reward, starts_at, ends_at,
status VARCHAR(12) DEFAULT 'scheduled'
```
Valid status values: `'scheduled'`, `'active'`, `'completed'`. No other values allowed.

### `createChallenge` URL param vs body
The route is `POST /teacher/classes/:classId/challenges` but the controller destructures `classId` from `req.body`. Verify: if `classId` is not passed in the body by the frontend, the challenge will be created with `class_id=null` (global, not class-scoped). Fix in the controller: `const classId = req.params.classId || req.body.classId`.

### Challenge types display labels
Use the same `TYPE_LABELS` map already defined in the student challenges page:
```typescript
const TYPE_LABELS: Record<string, string> = {
  return_pct: 'Best Return',
  quiz_score: 'Quiz Score',
  module_complete: 'Modules Done',
  streak: 'Streak',
};
```

### `datetime-local` input format
HTML `<input type="datetime-local">` produces `"2026-05-01T09:00"`. The API expects ISO 8601 with timezone. Append `:00.000Z` or use `new Date(value).toISOString()` before posting.

### Cron job placement
The existing `jobs/index.ts` likely already imports `node-cron`, `db`, and `redis` for `refreshLeaderboard`. Add `updateChallengeStatuses` to the same file — do not create a new file.

---

## QA Tasks / Test Coverage

### Unit / Integration Tests (API)
- [ ] `POST /teacher/classes/:classId/challenges` → 201, `class_id` set correctly from URL param (not null)
- [ ] `POST /teacher/classes/:classId/challenges` → `status='scheduled'` in DB
- [ ] `POST /teacher/classes/:classId/challenges` with student JWT → 403
- [ ] `GET /teacher/classes/:classId/challenges` → returns all challenges for the class with `participant_count`
- [ ] `updateChallengeStatuses()` cron → `scheduled` challenge with past `starts_at` → `status='active'`
- [ ] `updateChallengeStatuses()` cron → `active` challenge with past `ends_at` → `status='completed'`
- [ ] `updateChallengeStatuses()` cron → `completed` challenges not reverted to active

### E2E Tests (Playwright)
- [ ] Teacher opens class detail → "Create Challenge" button visible
- [ ] Teacher fills challenge form with future start date → challenge created, appears in list with "Upcoming" status
- [ ] Teacher fills challenge form with past start date → challenge created with "Active" status
- [ ] Challenge form with end date before start date → validation error shown, not submitted
- [ ] Challenge form with empty title → inline error shown
- [ ] Created challenge appears in Challenges section on class detail page with correct status pill colour
- [ ] Enrolled student visits Challenges page → upcoming challenge shows "Upcoming" badge, no Join button

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
- 2026-04-29: T3.6 story created — class challenge creation
