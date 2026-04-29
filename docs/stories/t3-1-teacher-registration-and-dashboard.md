# Story T3.1: Teacher Registration and Dashboard

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-1-teacher-registration-and-dashboard
**Date Prepared:** 2026-04-28

---

## Story

As a teacher,
I want to register with the teacher role and access a teacher-specific dashboard,
So that I can manage my classes and students from a dedicated workspace.

---

## Acceptance Criteria

**AC1 — Teacher registration creates a teacher-role account**
**Given** the register page at `/register`
**When** a user selects "I am a teacher", fills in email / username / password / date of birth, and submits
**Then** the account is created in the DB with `role = 'teacher'`, no FERPA `is_minor` check applies (teacher DOB not validated for age), and the JWT access token returned in the response contains `role: 'teacher'`

**AC2 — Teacher is redirected to the teacher dashboard on first login**
**Given** a successfully registered teacher
**When** the auth redirect resolves after registration or login
**Then** the user lands on `/teacher` (the teacher dashboard overview page), NOT `/dashboard`

**AC3 — Teacher dashboard overview page renders key stats**
**Given** a teacher at `/teacher`
**When** the page loads
**Then** it displays: total number of active classes, total enrolled students across all classes, a "My Classes" shortcut link, and an empty-state prompt ("Create your first class") when no classes exist yet

**AC4 — Teacher sees teacher-specific navigation**
**Given** a logged-in teacher
**When** they navigate any page within the `(teacher)` layout
**Then** the sidebar/nav shows: Dashboard, My Classes, Challenges, Reports — and does NOT show student-only items (Trade, Portfolio, Learn, Leaderboard)

**AC5 — Student-only routes redirect teachers to teacher dashboard**
**Given** a logged-in teacher
**When** they navigate directly to a student-only route (e.g. `/trade`, `/portfolio`, `/learn`)
**Then** they are redirected to `/teacher` with no error flash

**AC6 — Student registrations are unaffected**
**Given** a user who selects "I am a student" on the register page
**When** they submit the form
**Then** `role = 'student'` is stored (existing behaviour unchanged), is_minor check still applies, redirect goes to `/dashboard` as before

---

## Tasks / Subtasks

### Task 1 — Backend: accept `role` in register endpoint

- [ ] In `apps/api/src/controllers/auth.controller.ts`:
  - Add `role: z.enum(['student', 'teacher']).default('student')` to `registerSchema` (remove the P-8 comment / restriction)
  - Pass the validated `role` field into the INSERT:
    ```sql
    INSERT INTO users(email, username, password_hash, role, date_of_birth, is_minor)
    VALUES($1, $2, $3, $4, $5, $6)
    ```
    where `$4 = body.role` (validated enum, never raw string from request)
  - Skip the `is_minor` age gate when `role === 'teacher'` (teachers can be any age)
  - Return `role` in the registration response body (already returned via `RETURNING role`)

### Task 2 — Backend: add teacher summary endpoint

- [ ] In `apps/api/src/controllers/teacher.controller.ts`, add `getTeacherDashboard`:
  ```typescript
  export async function getTeacherDashboard(req: Request, res: Response) {
    const teacherId = req.user!.userId;
    const { rows } = await db.query(
      `SELECT
         COUNT(DISTINCT c.id) AS class_count,
         COUNT(DISTINCT ce.student_id) AS student_count
       FROM classes c
       LEFT JOIN class_enrollments ce ON ce.class_id = c.id AND ce.is_active = true
       WHERE c.teacher_id = $1 AND c.is_active = true`,
      [teacherId],
    );
    return res.json({ data: rows[0] });
  }
  ```
- [ ] Register in `apps/api/src/routes/index.ts`:
  ```typescript
  router.get('/teacher/dashboard', authMiddleware, requireRole('teacher', 'admin'), teacher.getTeacherDashboard);
  ```

### Task 3 — Frontend: teacher dashboard overview page

- [ ] Create `apps/web/app/(teacher)/teacher/page.tsx`:
  - Server component; calls `GET /api/v1/teacher/dashboard` via server-side fetch with auth header
  - Renders: class count card, student count card, "My Classes" button linking to `/teacher/classes`
  - Empty state: when `class_count === 0`, renders an illustrated empty state with CTA "Create your first class" → `/teacher/classes`
  - Use Editorial Intelligence tokens (`bg-surface-container`, `text-on-surface`, `text-primary`, etc.)

### Task 4 — Frontend: teacher-specific sidebar nav

- [ ] Audit `apps/web/components/layout/Sidebar.tsx`:
  - If sidebar already conditionally renders based on `session.user.role`, verify teacher items (Dashboard → `/teacher`, My Classes → `/teacher/classes`, Challenges → `/teacher/challenges`, Reports → `/teacher/reports`) are present and student items are hidden for `role === 'teacher'`
  - If sidebar renders all items unconditionally, add role-based branching: `role === 'teacher'` renders teacher nav; otherwise renders student nav

### Task 5 — Frontend: auth redirect after login/register

- [ ] In `apps/web/lib/auth.ts` (NextAuth `authOptions`), update the `signIn` / `session` callbacks:
  - Ensure the JWT callback stores `role` from the API response token
  - In the register page (`apps/web/app/(auth)/register/page.tsx`), after successful registration, redirect to `/teacher` when `role === 'teacher'`, `/dashboard` when `role === 'student'`
- [ ] In `apps/web/middleware.ts` (or route guards), verify that student-only paths (`/trade`, `/portfolio`, `/learn`, `/leaderboard`) redirect users with `role === 'teacher'` to `/teacher`

---

## Dev Notes

### Critical: role registration gap (P-8)
The previous T1.x code review explicitly stripped `role` from `registerSchema` (comment: "P-8: role removed — all email/password registrations default to student"). This was correct for Phase 1 but is now the primary blocker for Thread 3. Task 1 restores it with a validated enum — never trust raw user input; always use `z.enum(['student', 'teacher'])`.

### Age gate skip for teachers
The existing `is_minor` check uses `calculateAge(dateOfBirth)` and blocks users under 13. Teachers must not be blocked by this — skip the COPPA age check when `role === 'teacher'`. Teacher `is_minor` should always be `false`.

### Teacher layout already guards role
`apps/web/app/(teacher)/layout.tsx` already performs:
```typescript
if (session.user.role !== 'teacher' && session.user.role !== 'admin') redirect('/dashboard');
```
No change needed to the layout. Task 5 is about the inverse — student routes redirecting teachers out.

### Teacher routes already registered (no DB migrations needed)
`apps/api/src/routes/index.ts` already registers `/teacher/classes*` and `/teacher/classes/:classId*` under `requireRole('teacher', 'admin')`. The new `/teacher/dashboard` endpoint (Task 2) is additive only.

### DB schema: no migrations required for this story
`users.role` column already accepts `'teacher'` — it's an existing enum value in the schema. The `classes` and `class_enrollments` tables from migration `008_schools_classes.sql` are already present.

### Teacher dashboard page is genuinely missing
`apps/web/app/(teacher)/teacher/` only contains a `classes/` subdirectory. There is **no `page.tsx`** — navigating to `/teacher` would 404. Task 3 creates it.

### Sidebar role branching
Inspect `apps/web/components/layout/Sidebar.tsx` before implementing Task 4 — it may already have partial branching from T1.15/T1.17. Extend existing patterns rather than rewriting.

### Token shape
`signAccessToken` in `auth.controller.ts` already embeds `role` in the JWT payload:
```typescript
jwt.sign({ userId, role, isPro }, env.JWT_SECRET, { expiresIn: '15m' })
```
NextAuth's token callback must forward this `role` field to `session.user.role` — verify `apps/web/lib/auth.ts` JWT/session callbacks include `token.role = user.role` and `session.user.role = token.role`.

---

## QA Tasks / Test Coverage

### Unit / Integration Tests (API — `apps/api/src/controllers/auth.controller.test.ts`)
- [ ] `POST /auth/register` with `role: 'teacher'` → 201, `users.role = 'teacher'` in DB
- [ ] `POST /auth/register` with `role: 'teacher'` → JWT payload contains `role: 'teacher'`
- [ ] `POST /auth/register` with `role: 'teacher'` → age gate NOT applied (DOB < 13 accepted)
- [ ] `POST /auth/register` with `role: 'student'` → unchanged behaviour, `is_minor` still computed
- [ ] `POST /auth/register` without `role` field → defaults to `'student'`
- [ ] `POST /auth/register` with `role: 'admin'` → rejected (not in enum)
- [ ] `GET /teacher/dashboard` with teacher JWT → 200, returns `{ class_count, student_count }`
- [ ] `GET /teacher/dashboard` with student JWT → 403

### E2E Tests (Playwright — `apps/web/tests/`)
- [ ] Teacher registers via "I am a teacher" toggle → lands on `/teacher`, not `/dashboard`
- [ ] Teacher logs in → sidebar shows "My Classes" not "Trade" or "Learn"
- [ ] Teacher navigates to `/trade` directly → redirected to `/teacher`
- [ ] Teacher navigates to `/portfolio` → redirected to `/teacher`
- [ ] Teacher navigates to `/learn` → redirected to `/teacher`
- [ ] Student registers → unchanged flow, lands on `/dashboard`
- [ ] Teacher dashboard shows "Create your first class" empty state when no classes exist
- [ ] Teacher dashboard shows class count + student count when classes exist

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
- 2026-04-28: T3.1 story created — teacher registration and dashboard
