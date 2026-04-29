# Story T3.3: Student Class Enrollment via Join Code

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-3-student-class-enrollment-via-join-code
**Date Prepared:** 2026-04-29

---

## Story

As a student,
I want to join a class using my teacher's join code,
So that I can participate in class challenges and appear on the class leaderboard.

---

## Acceptance Criteria

**AC1 — Valid join code enrolls student**
**Given** I am a student and have a valid 6-character join code from my teacher
**When** I enter the code in "Join a Class" and submit
**Then** I am enrolled in the class, a class-specific portfolio is created with the class's `starting_cash`, and the teacher's roster shows me immediately on next load

**AC2 — Invalid join code shows clear error**
**Given** I enter a join code that does not exist or belongs to an inactive class
**When** I submit
**Then** I see a clear inline error: "Class not found — check your code and try again"

**AC3 — Already-enrolled student is rejected**
**Given** I am already enrolled in a class
**When** I attempt to enter a different join code
**Then** I see an error: "You're already enrolled in a class (one class per student)"

**AC4 — My Classes widget shows enrollment status**
**Given** I am enrolled in a class
**When** I visit my Dashboard or the Leaderboard page
**Then** I see my class name and join date; the class leaderboard tab becomes available

**AC5 — Unenrolled student sees invitation prompt**
**Given** I am a student not enrolled in any class
**When** I visit the Dashboard
**Then** I see a dismissible "Join a class" prompt with a join code input field

---

## Tasks / Subtasks

### Task 1 — Backend: confirm `joinClass` and `getMyClasses` are complete ✅ (no changes)

Both endpoints already exist and are fully implemented:
- `POST /api/v1/classes/join` — validates join code, checks active class, checks duplicate, creates class-specific portfolio, inserts enrollment
- `GET /api/v1/classes/my` — returns student's enrolled classes with teacher name and student count

**Verify the portfolio `is_active` flag:** When `joinClass` creates a class portfolio, the existing portfolio (with `is_active=true`) should remain the primary portfolio. The class portfolio should have `is_active=false` unless explicitly scoped. Check `portfolios.is_active` handling — do not break the student's global leaderboard standing.

### Task 2 — Frontend: "Join a Class" modal in student Dashboard

- [ ] In `apps/web/app/(dashboard)/dashboard/page.tsx`:
  - Fetch enrolled classes: `GET /api/v1/classes/my` via TanStack Query `['my-classes']`
  - If `myClasses` is empty array, render a dismissible prompt card:
    ```
    📚 Join your class
    Enter the code your teacher gave you.
    [input: Join code] [Join button]
    ```
  - If enrolled, render a "My Class" info card showing class name and teacher name
  - Dismiss state: use `useState(false)` for `dismissed` — reset on page reload (no persistence needed for MVP)

### Task 3 — Frontend: Join Class mutation logic

- [ ] Create the join mutation (can live in the dashboard page or a shared hook):
  ```typescript
  const joinMutation = useMutation({
    mutationFn: (joinCode: string) =>
      apiClient.post('/classes/join', { joinCode: joinCode.trim().toUpperCase() }),
    onSuccess: () => {
      toast.success('Joined! Welcome to your class 🎉');
      queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg === 'Already enrolled') {
        setJoinError("You're already enrolled in a class (one class per student)");
      } else {
        setJoinError('Class not found — check your code and try again');
      }
    },
  });
  ```
- [ ] Auto-uppercase the join code input on change: `value.toUpperCase().slice(0, 6)`

### Task 4 — Frontend: validate class portfolio doesn't interfere with global portfolio

- [ ] After joining, call `GET /api/v1/portfolio` — verify it still returns the student's primary (is_active) portfolio, not the class portfolio
- [ ] No frontend changes needed if backend handles this correctly — just confirm behaviour in dev notes

---

## Dev Notes

### Backend is complete — no changes required
`joinClass` in `apps/api/src/controllers/teacher.controller.ts` already:
1. Looks up class by join code (uppercased) where `is_active=true`
2. Returns 404 if not found
3. Returns 409 ("Already enrolled") if `class_enrollments` row exists
4. Inserts class portfolio with `classObj.starting_cash` as `virtual_cash`
5. Inserts `class_enrollments(class_id, student_id, portfolio_id)`

### Class portfolio isolation
The join creates a SECOND portfolio for the student (`is_active` defaults to whatever the INSERT sets — check migration). The global portfolio (`is_active=true`) must remain the canonical portfolio for trading and global leaderboard. The class portfolio is used for class-scoped challenge tracking only. Dev should verify the global portfolio query (`WHERE is_active=true`) still works after joining.

### No migration required
`classes`, `class_enrollments`, and `portfolios` tables all exist.

### apiClient error shape
`apiClient` uses axios. On 409, `err.response.data.error` will be `'Already enrolled'`. On 404, it will be `'Class not found'`.

### Join code format
Always send uppercased: `joinCode.trim().toUpperCase()`. The backend also toUpperCase()s it, but normalise on the client too for UX.

---

## Dev Agent Record

### Agent Model Used
_to be filled on implementation_

### Completion Notes
_to be filled on implementation_

### File List
_to be filled on implementation_

### Change Log
- 2026-04-29: T3.3 story created — student class enrollment
