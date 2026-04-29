# Story T3.7: Student Challenge View and Participation

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-7-student-challenge-view-and-participation
**Date Prepared:** 2026-04-29

> **Dev Agent Instruction:** Complete ALL Dev Tasks first, then switch to the QA persona (Quinn 🧪) and implement ALL QA Tasks before marking this story done. The story is not complete until both sections are fully checked off.

---

## Story

As a student,
I want to see active challenges and track my standing,
So that I can participate in class competitions.

---

## Acceptance Criteria

**AC1 — Active and upcoming challenges visible on Challenges page**
**Given** an active or upcoming challenge exists for my class (or globally)
**When** I view the Challenges page
**Then** I see the challenge name, type, description, time remaining (for active) or countdown to start (for upcoming), participant count, and my current rank if joined

**AC2 — Upcoming challenges show distinct "Upcoming" state**
**Given** a challenge has `starts_at` in the future
**When** I view it on the Challenges page
**Then** it shows a "Upcoming" status pill with "Starts in X days" text; the Join button is absent (cannot join before it starts)

**AC3 — Joining a challenge tracks participation**
**Given** I click "Join Challenge" on an active challenge
**When** I join
**Then** a row is inserted into `challenge_participants`; I see "⚡ In Progress" status; my trades are tracked against the challenge period

**AC4 — Challenge detail page shows live rankings**
**Given** I click into an active challenge
**When** the detail page loads
**Then** I see ranked participants with username, return %, and my own row highlighted

**AC5 — Completed challenge shows frozen results**
**Given** a challenge's end date has passed
**When** I view it
**Then** it shows a "Completed" banner with final rankings; the Join button is absent

---

## Tasks / Subtasks

### Task 1 — Backend: extend `getChallenges` to include upcoming challenges

- [ ] In `apps/api/src/controllers/challenge.controller.ts`, update `getChallenges` to include `scheduled` (upcoming) challenges:
  ```typescript
  // Change: WHERE c.status='active' → WHERE c.status IN ('active','scheduled')
  WHERE c.status IN ('active','scheduled') AND (c.class_id IS NULL OR c.class_id IN (
    SELECT class_id FROM class_enrollments WHERE student_id=$1
  ))
  ```
  Also include completed challenges from the last 7 days so students can see recent results:
  ```typescript
  WHERE (
    c.status IN ('active','scheduled')
    OR (c.status='completed' AND c.ends_at >= NOW() - INTERVAL '7 days')
  )
  AND (c.class_id IS NULL OR c.class_id IN (
    SELECT class_id FROM class_enrollments WHERE student_id=$1
  ))
  ```

### Task 2 — Backend: `joinChallenge` guard for scheduled challenges

- [ ] In `challenge.controller.ts`, update `joinChallenge` to reject attempts to join scheduled challenges:
  ```typescript
  const { rows: ch } = await db.query(
    'SELECT * FROM challenges WHERE id=$1 AND status=$2',
    [id, 'active'],  // only 'active' — already correct ✅
  );
  ```
  No change needed — `joinChallenge` already only allows joining `active` challenges.

### Task 3 — Frontend: Challenges page — show upcoming and completed states

- [ ] In `apps/web/app/(dashboard)/challenges/page.tsx`:
  - Update type to include `status: 'scheduled' | 'active' | 'completed'` and `starts_at: string`
  - Add rendering for each status:

  **Scheduled/Upcoming:**
  ```tsx
  <div className="bg-yellow-400/10 text-yellow-400 text-center text-sm py-2 rounded-lg">
    ⏰ Upcoming — starts {dayjs(c.starts_at).fromNow()}
  </div>
  ```
  (No Join button for scheduled)

  **Active (already participating):**
  ```tsx
  <div className="bg-purple-400/10 text-purple-400 text-center text-sm py-2 rounded-lg">
    ⚡ In Progress {c.my_rank ? `· Rank #${c.my_rank}` : ''}
  </div>
  ```

  **Completed:**
  ```tsx
  <div className="bg-surface-container-high text-on-surface-variant text-center text-sm py-2 rounded-lg">
    🏁 Completed
  </div>
  ```

### Task 4 — Frontend: Challenge detail page

- [ ] Create `apps/web/app/(dashboard)/challenges/[id]/page.tsx`:
  ```tsx
  'use client';
  // Fetch GET /api/v1/challenges/:id
  // Show: challenge title, type badge, description, time remaining / completed banner
  // Participants table: rank, username (avatar initial), return_pct or current_value, completed badge
  // Highlight the row where username matches session user
  // Join button if myProgress is null AND challenge is active
  ```
  - Use `useParams<{ id: string }>()` for the challenge id
  - Use `cn` to highlight user's own row: `bg-primary-container/10 border-l-2 border-primary`
  - Response shape from `getChallengeDetail`: `{ ...challengeFields, participants: [...], myProgress: {...} | null }`
  - `participants` shape: `{ username, avatar_url, current_value, rank, is_completed }`

### Task 5 — Frontend: link from challenge card to detail page

- [ ] In `apps/web/app/(dashboard)/challenges/page.tsx`:
  - Wrap each challenge card in a `<Link href={`/challenges/${c.id}`}>` — or add a "View Details" link at the bottom of each card
  - Keep the "Join Challenge" button functional inside the card (use `e.stopPropagation()` if the whole card is a link)

---

## Dev Notes

### Existing challenge infrastructure (all backend complete)
- `GET /challenges` — `getChallenges` ✅ (extend for scheduled/completed in Task 1)
- `POST /challenges/:id/join` — `joinChallenge` ✅ (already guards active-only)
- `GET /challenges/:id` — `getChallengeDetail` ✅ (returns participants + myProgress)

### `challenge_participants.current_value` semantics
This field tracks the participant's progress metric (e.g., return % for `return_pct` type, or quiz score for `quiz_score` type). The cron that updates this is not yet implemented — it's a future story. For MVP, `current_value` will be 0 for most participants. Display it as-is; don't block the story on cron implementation.

### `challenges` table has no `starts_at` in the current `getChallenges` SELECT
The query selects `c.*` so `starts_at` IS included. No query change needed for starts_at display.

### dayjs already imported in challenges page
The existing challenges page already imports `dayjs` + `relativeTime`. Follow the same pattern — `dayjs(c.starts_at).fromNow()` gives "in 3 days" for future dates.

### Challenges page already uses `/challenges` query key
`queryKey: ['challenges']` — keep this. Add `queryKey: ['challenge-detail', id]` for the new detail page.

---

## QA Tasks / Test Coverage

### Unit / Integration Tests (API)
- [ ] `GET /challenges` → includes `scheduled` challenges for enrolled class
- [ ] `GET /challenges` → includes `completed` challenges from last 7 days
- [ ] `GET /challenges` → excludes `completed` challenges older than 7 days
- [ ] `GET /challenges` → excludes class challenges for classes the student is NOT enrolled in
- [ ] `POST /challenges/:id/join` on a `scheduled` challenge → 404 (cannot join upcoming)
- [ ] `POST /challenges/:id/join` on a `completed` challenge → 404
- [ ] `POST /challenges/:id/join` on an `active` challenge → 201
- [ ] `GET /challenges/:id` → returns `participants` array and `myProgress` (null if not joined)

### E2E Tests (Playwright)
- [ ] Student visits Challenges page → active challenge shows Join button
- [ ] Student visits Challenges page → upcoming challenge shows "Upcoming" pill, no Join button
- [ ] Student visits Challenges page → completed challenge (within 7 days) shows "Completed" pill, no Join button
- [ ] Student joins active challenge → "⚡ In Progress" state shown, Join button disappears
- [ ] Student clicks into challenge → detail page shows ranked participants table
- [ ] Student's own row in challenge detail is visually highlighted
- [ ] Challenge detail page shows countdown / "Completed" banner based on end date
- [ ] Student not enrolled in any class → only global challenges visible (no class challenges)

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
- 2026-04-29: T3.7 story created — student challenge view and participation
