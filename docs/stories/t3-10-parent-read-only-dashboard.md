# Story T3.10: Parent Read-Only Dashboard

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-10-parent-read-only-dashboard
**Date Prepared:** 2026-04-29

---

## Story

As a parent or guardian,
I want to view my child's activity on the platform in read-only mode,
So that I can monitor engagement without interfering with their account.

---

## Acceptance Criteria

**AC1 — Minor student can send a guardian invite**
**Given** I am a student with `is_minor=true` and I navigate to Settings
**When** I enter a guardian email address and send the invite
**Then** an invite email is sent with a unique link (valid 72 hours); the pending invite appears in my Settings

**AC2 — Guardian accepts invite and creates a read-only account**
**Given** a guardian clicks the invite link in their email
**When** they complete a simple setup (set a password; no date of birth required)
**Then** a guardian account is created with `role='guardian'`, linked to the student; they are redirected to the guardian dashboard

**AC3 — Guardian dashboard shows student summary (read-only)**
**Given** I am a linked guardian and log in
**When** I view the guardian dashboard (`/guardian`)
**Then** I see: student username, portfolio value (no holdings detail), modules completed, current streak, badges earned count, and last active date — all read-only

**AC4 — Guardian cannot access trading or settings**
**Given** I am logged in as a guardian
**When** I attempt to navigate to `/trade`, `/portfolio`, `/learn`, or `/settings`
**Then** I am redirected to the guardian dashboard with no error flash

**AC5 — Guardian access is revoked when student deletes account**
**Given** a linked student deletes their account
**When** deletion is processed (T3.9)
**Then** the guardian's account is also deactivated and they cannot log in

---

## Tasks / Subtasks

### Task 1 — DB migration: guardian_links table

- [ ] Create `apps/api/src/db/migrations/016_guardian_links.sql`:
  ```sql
  -- Phase 2: Guardian/Parent read-only access

  ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';
  -- Note: if role column already exists (it does), skip the ALTER

  CREATE TABLE IF NOT EXISTS guardian_links (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guardian_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    invite_token VARCHAR(64) UNIQUE NOT NULL,
    invite_email VARCHAR(254) NOT NULL,
    status       VARCHAR(10) NOT NULL DEFAULT 'pending', -- pending | accepted | revoked
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '72 hours',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_guardian_links_student ON guardian_links(student_id);
  CREATE INDEX IF NOT EXISTS idx_guardian_links_token ON guardian_links(invite_token);
  CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian ON guardian_links(guardian_id);
  ```

  **Note:** `users.role` already exists — skip the ALTER TABLE. Only create `guardian_links`.

- [ ] Run migration: `pnpm db:migrate`

### Task 2 — Backend: guardian invite endpoint

- [ ] Create `apps/api/src/controllers/guardian.controller.ts`:
  ```typescript
  import crypto from 'crypto';
  // ...

  export async function sendGuardianInvite(req: Request, res: Response) {
    const studentId = req.user!.userId;
    const { guardianEmail } = req.body;

    // Only minors can invite guardians
    const { rows: student } = await db.query(
      'SELECT is_minor FROM users WHERE id=$1',
      [studentId],
    );
    if (!student[0]?.is_minor) {
      return res.status(403).json({ error: 'Only minor accounts can send guardian invites' });
    }

    // Limit: one active invite per student
    const { rows: existing } = await db.query(
      `SELECT id FROM guardian_links
       WHERE student_id=$1 AND status='pending' AND expires_at > NOW()`,
      [studentId],
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A pending invite already exists. Cancel it first.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await db.query(
      `INSERT INTO guardian_links(student_id, invite_token, invite_email)
       VALUES($1, $2, $3)`,
      [studentId, token, guardianEmail.toLowerCase()],
    );

    // TODO: send email via email service (out of scope for MVP — log URL instead)
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/guardian/accept?token=${token}`;
    console.log(`Guardian invite URL: ${inviteUrl}`); // Replace with email service in production

    return res.status(201).json({ data: { inviteUrl, message: 'Invite sent' } });
  }
  ```

- [ ] Register in `apps/api/src/routes/index.ts`:
  ```typescript
  import * as guardian from '../controllers/guardian.controller';
  // ...
  router.post('/guardian/invite', authMiddleware, guardian.sendGuardianInvite);
  router.post('/guardian/accept', guardian.acceptGuardianInvite); // no auth — token-based
  router.get('/guardian/dashboard', authMiddleware, requireRole('guardian'), guardian.getGuardianDashboard);
  router.get('/guardian/pending-invite', authMiddleware, guardian.getPendingInvite);
  ```

### Task 3 — Backend: guardian invite acceptance

- [ ] In `guardian.controller.ts`, add `acceptGuardianInvite`:
  ```typescript
  export async function acceptGuardianInvite(req: Request, res: Response) {
    const { token, password } = req.body;

    const { rows: link } = await db.query(
      `SELECT * FROM guardian_links
       WHERE invite_token=$1 AND status='pending' AND expires_at > NOW()`,
      [token],
    );
    if (link.length === 0) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    // Create guardian user
    const guardianEmail = link[0].invite_email;
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE email=$1',
      [guardianEmail],
    );

    let guardianId: string;
    if (existing.length > 0) {
      guardianId = existing[0].id;
      // Update role if needed
      await db.query(`UPDATE users SET role='guardian' WHERE id=$1`, [guardianId]);
    } else {
      const username = `guardian_${crypto.randomBytes(4).toString('hex')}`;
      const hash = await bcrypt.hash(password, 12);
      const { rows: newUser } = await db.query(
        `INSERT INTO users(email, username, password_hash, role, date_of_birth, is_minor)
         VALUES($1,$2,$3,'guardian','1970-01-01',false) RETURNING id`,
        [guardianEmail, username, hash],
      );
      guardianId = newUser[0].id;
    }

    // Link guardian to student
    await db.query(
      `UPDATE guardian_links SET guardian_id=$1, status='accepted' WHERE id=$2`,
      [guardianId, link[0].id],
    );

    return res.status(200).json({ data: { guardianId, message: 'Account linked' } });
  }
  ```

### Task 4 — Backend: guardian dashboard endpoint

- [ ] In `guardian.controller.ts`, add `getGuardianDashboard`:
  ```typescript
  export async function getGuardianDashboard(req: Request, res: Response) {
    const guardianId = req.user!.userId;

    const { rows: links } = await db.query(
      `SELECT gl.student_id, u.username, u.avatar_url
       FROM guardian_links gl
       JOIN users u ON u.id=gl.student_id
       WHERE gl.guardian_id=$1 AND gl.status='accepted'`,
      [guardianId],
    );
    if (links.length === 0) return res.status(404).json({ error: 'No linked student found' });

    const studentId = links[0].student_id;

    const [portfolioRes, xpRes, streakRes, badgeRes, progressRes] = await Promise.all([
      db.query('SELECT total_value FROM portfolios WHERE user_id=$1 AND is_active=true', [studentId]),
      db.query('SELECT total_xp, current_level FROM user_xp WHERE user_id=$1', [studentId]),
      db.query('SELECT current_streak, longest_streak FROM streaks WHERE user_id=$1', [studentId]),
      db.query('SELECT COUNT(*) AS badge_count FROM user_badges WHERE user_id=$1', [studentId]),
      db.query(
        `SELECT COUNT(*) AS lessons_completed FROM user_lesson_progress
         WHERE user_id=$1 AND status='completed'`,
        [studentId],
      ),
    ]);

    return res.json({
      data: {
        student: { username: links[0].username, avatarUrl: links[0].avatar_url },
        portfolioValue: portfolioRes.rows[0]?.total_value ?? 0,
        // No holdings detail — read-only aggregate only
        xp: xpRes.rows[0] ?? { total_xp: 0, current_level: 1 },
        streak: streakRes.rows[0] ?? { current_streak: 0, longest_streak: 0 },
        badgeCount: parseInt(badgeRes.rows[0]?.badge_count ?? '0'),
        lessonsCompleted: parseInt(progressRes.rows[0]?.lessons_completed ?? '0'),
      },
    });
  }
  ```

### Task 5 — Frontend: guardian invite UI in Settings (minor students only)

- [ ] In `apps/web/app/(dashboard)/settings/page.tsx` (created in T3.9):
  - Show a "Guardian Access" section only when `session.user.role === 'student'` and `is_minor` is true (check session for `is_minor` field — it's returned by `auth.controller.ts getMe`)
  - Add guardian email input + "Send Invite" button
  - Show pending invite status if one exists (fetch `GET /api/v1/guardian/pending-invite`)

### Task 6 — Frontend: guardian dashboard page

- [ ] Create `apps/web/app/(guardian)/layout.tsx` (new route group):
  ```tsx
  import { getServerSession } from 'next-auth';
  import { redirect } from 'next/navigation';
  import { authOptions } from '@/lib/auth';

  export default async function GuardianLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/login');
    if (session.user.role !== 'guardian') redirect('/dashboard');
    return <div className="min-h-screen bg-surface">{children}</div>;
  }
  ```

- [ ] Create `apps/web/app/(guardian)/guardian/page.tsx`:
  - Fetch `GET /api/v1/guardian/dashboard` — display student summary cards
  - Show: student name, portfolio value, XP, current streak, badge count, lessons completed
  - Prominent read-only label: "👀 Guardian View — Read Only"
  - No trade/settings links; simple nav with just the guardian view

### Task 7 — Frontend: route guard for guardian users

- [ ] In `apps/web/middleware.ts` (or the dashboard layout), add guardian to the redirect logic:
  - Guardian users hitting `/trade`, `/portfolio`, `/learn`, `/settings`, `/leaderboard` → redirect to `/guardian`
  - Follow the same pattern used for teacher redirects in T3.1

### Task 8 — Account deletion integration (T3.9 hook)

- [ ] Ensure `deleteAccount` in T3.9's backend (Task 2) also deactivates linked guardian accounts when a student is deleted:
  ```sql
  UPDATE guardian_links SET status='revoked' WHERE student_id=$1
  ```
  The `ON DELETE CASCADE` on `guardian_links.student_id` will remove the link row automatically, but updating `guardian_id`'s user record to be inactive requires an explicit step. For MVP, the guardian login will simply return no linked student — which is handled gracefully by `getGuardianDashboard` returning 404.

---

## Dev Notes

### New `role='guardian'` value
The `users.role` column currently accepts `'student'`, `'teacher'`, `'admin'`. Adding `'guardian'` requires verifying there is no DB enum constraint (check migration `001_users.sql` — the column is `VARCHAR(20)`, not a Postgres ENUM, so no migration needed).

### Email sending is out of scope for MVP
Log the invite URL to stdout in development. In production, wire up an email service (SendGrid, Resend, etc.) — deferred. The invite URL can also be shown directly in the Settings UI: "Share this link with your guardian: [copy button]".

### Guardian account setup page
The accept flow (`/guardian/accept?token=...`) needs a simple frontend page. Create `apps/web/app/(auth)/guardian-accept/page.tsx` that:
1. Reads the `token` query param
2. Shows a password setup form
3. Calls `POST /api/v1/guardian/accept` with `{ token, password }`
4. On success, redirects to `/login` with a toast "Account created — log in to view your student's progress"

### `is_minor` in session
`is_minor` is returned in the register/login response and stored in the NextAuth JWT. Check `apps/web/lib/auth.ts` to verify `token.is_minor` is populated. If not, add it following the `role` pattern.

### One guardian per student (MVP)
MVP supports one guardian invite per student at a time. The `getPendingInvite` endpoint returns the current pending invite (if any) so the UI can show "revoke and re-send" functionality if needed.

### `requireRole('guardian')` in role middleware
`role.middleware.ts` already implements `requireRole(...roles: string[])` checking `req.user.role`. Adding `'guardian'` is just a string match — no code change needed to the middleware itself, just use it in the route registration.

---

## QA Tasks / Test Coverage

### Unit / Integration Tests (API)
- [ ] `POST /guardian/invite` by minor student → 201, `guardian_links` row created with `status='pending'`, token returned
- [ ] `POST /guardian/invite` by non-minor student → 403
- [ ] `POST /guardian/invite` when pending invite already exists → 409
- [ ] `POST /guardian/accept` with valid token + password → 201, guardian user created, link `status='accepted'`
- [ ] `POST /guardian/accept` with expired token → 404
- [ ] `POST /guardian/accept` with already-accepted token → 404 (status no longer 'pending')
- [ ] `GET /guardian/dashboard` with guardian JWT → 200, returns student summary (no holdings detail)
- [ ] `GET /guardian/dashboard` with student JWT → 403
- [ ] `GET /guardian/dashboard` when student has deleted account → 404
- [ ] Student account deletion → guardian link `status='revoked'` (or CASCADE removes link)

### E2E Tests (Playwright)
- [ ] Minor student visits Settings → "Guardian Access" section visible
- [ ] Non-minor student visits Settings → "Guardian Access" section NOT shown
- [ ] Minor student sends guardian invite → invite link displayed in Settings
- [ ] Guardian visits accept link → password setup form shown
- [ ] Guardian sets password → account created, redirected to login
- [ ] Guardian logs in → sees guardian dashboard with student summary
- [ ] Guardian dashboard shows: portfolio value, XP, streak, badges, lessons completed
- [ ] Guardian dashboard does NOT show individual holdings or trade history
- [ ] Guardian navigates to `/trade` → redirected to `/guardian`
- [ ] Guardian navigates to `/portfolio` → redirected to `/guardian`
- [ ] Guardian navigates to `/settings` → redirected to `/guardian`

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
- 2026-04-29: T3.10 story created — parent/guardian read-only dashboard
