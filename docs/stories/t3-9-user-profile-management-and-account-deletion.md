# Story T3.9: User Profile Management and Account Deletion

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-9-user-profile-management-and-account-deletion
**Date Prepared:** 2026-04-29

---

## Story

As an authenticated user,
I want to manage my profile and delete my account with full data removal,
So that I have control over my personal information.

---

## Acceptance Criteria

**AC1 — User can update their display name (username)**
**Given** I navigate to Settings (`/settings`)
**When** I update my username and save
**Then** the change is persisted to the DB, the session reflects the new username on next page load, and a success toast confirms the update

**AC2 — Username uniqueness is enforced**
**Given** I attempt to set a username already taken by another user
**When** I submit
**Then** I see an inline error: "This username is already taken"

**AC3 — Account deletion requires confirmation prompt**
**Given** I click "Delete Account" in Settings
**When** I am shown a confirmation dialog that asks me to type "DELETE" and confirm
**Then** the deletion only proceeds if I type the exact confirmation phrase

**AC4 — Account deletion purges all user data**
**Given** I confirm account deletion
**When** deletion is processed
**Then** I am signed out immediately; all user rows (users, portfolios, orders, holdings, xp_events, user_badges, user_lesson_progress, streaks, refresh_tokens, class_enrollments, challenge_participants) are deleted via DB cascade or explicit DELETE

**AC5 — Teacher deletion warns about active classes**
**Given** I am a teacher with active classes
**When** I initiate account deletion
**Then** I see a warning: "Deleting your account will remove your classes. Enrolled students will retain their own data." — with a separate explicit confirmation before proceeding

---

## Tasks / Subtasks

### Task 1 — Backend: update profile endpoint

- [ ] In `apps/api/src/controllers/auth.controller.ts`, add:
  ```typescript
  const updateProfileSchema = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
  });

  export async function updateProfile(req: Request, res: Response) {
    const userId = req.user!.userId;
    const body = updateProfileSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });

    const { username } = body.data;
    if (!username) return res.status(400).json({ error: 'Nothing to update' });

    // Check uniqueness
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE username=$1 AND id!=$2',
      [username, userId],
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: { code: 'DUPLICATE_USERNAME', message: 'This username is already taken.', field: 'username' } });
    }

    const { rows } = await db.query(
      'UPDATE users SET username=$1, updated_at=NOW() WHERE id=$2 RETURNING id, email, username, role',
      [username, userId],
    );
    return res.json({ data: rows[0] });
  }
  ```

- [ ] Register in `apps/api/src/routes/index.ts`:
  ```typescript
  router.patch('/auth/profile', authMiddleware, auth.updateProfile);
  ```

### Task 2 — Backend: account deletion endpoint

- [ ] In `apps/api/src/controllers/auth.controller.ts`, add:
  ```typescript
  export async function deleteAccount(req: Request, res: Response) {
    const userId = req.user!.userId;

    // Check if teacher with active classes — return warning flag
    const { rows: activeClasses } = await db.query(
      'SELECT id FROM classes WHERE teacher_id=$1 AND is_active=true',
      [userId],
    );

    const { confirmed } = req.body;
    if (activeClasses.length > 0 && !confirmed) {
      return res.status(200).json({
        warning: true,
        message: 'You have active classes. Deleting your account will remove them. Enrolled students retain their own data.',
        classCount: activeClasses.length,
      });
    }

    // Cascade delete in FK-safe order
    // Most tables cascade via FK but explicit deletes for non-CASCADE tables:
    await db.query('DELETE FROM refresh_tokens WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM challenge_participants WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM class_enrollments WHERE student_id=$1', [userId]);
    await db.query('UPDATE classes SET is_active=false WHERE teacher_id=$1', [userId]);
    await db.query('DELETE FROM users WHERE id=$1', [userId]);
    // portfolios, orders, holdings, xp_events, user_badges, user_lesson_progress,
    // streaks should CASCADE from users FK — verify in migrations

    return res.status(200).json({ data: { deleted: true } });
  }
  ```

- [ ] Register:
  ```typescript
  router.delete('/auth/account', authMiddleware, auth.deleteAccount);
  ```

### Task 3 — Frontend: Settings page

- [ ] Create `apps/web/app/(dashboard)/settings/page.tsx`:
  - `'use client'`
  - Sections: "Profile", "Danger Zone"
  - Fetch current user data from session (`useSession()`) — name, email, role
  - Profile section: username input (pre-filled from session), Save button
  - Danger Zone: "Delete Account" button (red, outlined)

### Task 4 — Frontend: username update form

- [ ] In the Profile section of settings page:
  ```typescript
  const updateMutation = useMutation({
    mutationFn: (username: string) => apiClient.patch('/auth/profile', { username }),
    onSuccess: () => {
      toast.success('Username updated!');
      // Force session refresh so new username propagates
      update(); // from useSession() — call update() to refresh session data
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })
        ?.response?.data?.error?.code;
      if (code === 'DUPLICATE_USERNAME') setUsernameError('This username is already taken');
      else setUsernameError('Failed to update — please try again');
    },
  });
  ```
  - `update` is the second return value from `const { data: session, update } = useSession()`
  - Inline error: `{usernameError && <p className="text-negative text-xs mt-1">{usernameError}</p>}`

### Task 5 — Frontend: account deletion flow

- [ ] In the Danger Zone section:
  - Step 1: Show "Delete Account" button
  - Step 2 (for teachers with active classes): Show warning modal — "You have X active classes. Students will retain their data. Do you want to continue?"
  - Step 3: Show confirmation dialog with input: "Type DELETE to confirm"
  - Step 4: Call `DELETE /api/v1/auth/account` with `{ confirmed: true }` on match
  - On success: call `signOut({ callbackUrl: '/' })` from `next-auth/react`

  ```typescript
  const deleteMutation = useMutation({
    mutationFn: (confirmed: boolean) =>
      apiClient.delete('/auth/account', { data: { confirmed } }),
    onSuccess: (res) => {
      if ((res as { warning?: boolean }).warning) {
        setShowTeacherWarning(true); // show teacher warning step
      } else {
        signOut({ callbackUrl: '/' });
      }
    },
    onError: () => toast.error('Deletion failed — please try again'),
  });
  ```

---

## Dev Notes

### `users.updated_at` column exists
Migration `001_users.sql` has `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Safe to `UPDATE users SET updated_at=NOW()`.

### DB cascade delete review
Before implementing Task 2, verify which tables have `ON DELETE CASCADE` from `users.id`:
- `portfolios` → likely CASCADE (check `002_portfolios.sql`)
- `orders` → likely CASCADE (check `003_orders.sql`)
- `xp_events`, `user_badges`, `user_lesson_progress`, `streaks` → likely CASCADE (check `006_gamification.sql`)
- `refresh_tokens` → check `001_users.sql`
- `class_enrollments`, `challenge_participants` → likely CASCADE (check `008_schools_classes.sql`, `009_challenges.sql`)

Explicit DELETEs in Task 2 are a safety net for any tables that don't cascade. Order matters — delete FK-referencing rows before the referenced `users` row.

### Teachers: soft-delete classes on account deletion
Do NOT hard-delete the class — enrolled students' class-specific portfolios are linked to the class. Instead, `UPDATE classes SET is_active=false` so the class data is preserved for existing student records. The teacher's personal data (users row) is still deleted.

### `useSession().update()` for client-side session refresh
NextAuth's `useSession` returns an `update` function that re-fetches the session from the server. Call it after a successful username update so `session.user.username` reflects the new value without requiring a full sign-out/sign-in.

### Confirmation input: exact match
`confirmText.trim() === 'DELETE'` — case sensitive. No tolerance for "delete" or "Delete".

### Settings page route
The Sidebar already has a `Settings` link pointing to `/settings`. Creating the file at `app/(dashboard)/settings/page.tsx` is all that's needed — the layout wrapping is already handled by `app/(dashboard)/layout.tsx`.

---

## Dev Agent Record

### Agent Model Used
_to be filled on implementation_

### Completion Notes
_to be filled on implementation_

### File List
_to be filled on implementation_

### Change Log
- 2026-04-29: T3.9 story created — user profile management and account deletion
