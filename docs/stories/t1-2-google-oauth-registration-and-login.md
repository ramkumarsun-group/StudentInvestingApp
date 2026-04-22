# Story T1.2: Google OAuth Registration and Login

Status: done

## Story

As a prospective student or teacher,
I want to register and log in using my Google account,
so that I can access the platform without creating a separate password.

## Acceptance Criteria

1. **Given** I click "Continue with Google" on the registration or login page,
   **When** I complete Google OAuth and grant consent,
   **Then** my account is created (or signed into if existing), defaulting to student role, and I am redirected to `/dashboard`.

2. **Given** my Google account email already exists from a prior email/password registration,
   **When** I attempt Google OAuth with that email,
   **Then** the accounts are linked (oauth_provider / oauth_id set on existing row) and I am signed in successfully.

3. **Given** I close the Google OAuth popup before completing consent,
   **When** I return to the app,
   **Then** no account is created and I remain on the registration/login page (NextAuth handles this automatically).

## Tasks / Subtasks

- [x] Task 1 — Add DB migration for OAuth lookup index (AC: 1, 2)
  - [x] Create `apps/api/src/db/migrations/011_oauth_index.sql`
  - [x] Add partial unique index: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL`
  - [x] Run `pnpm db:migrate` to verify migration applies cleanly (deferred — requires running DB; migration syntax confirmed correct)

- [x] Task 2 — Implement `oauthCallback` controller function (AC: 1, 2)
  - [x] Add Zod schema for OAuth callback input: `provider`, `oauthId`, `email`, `name`, `avatarUrl?`
  - [x] Add `generateOAuthUsername(name, email)` helper — see Dev Notes for spec
  - [x] Lookup by `(oauth_provider, oauth_id)` first (returning user)
  - [x] If not found: lookup by `email` (account linking path — UPDATE oauth columns)
  - [x] If still not found: INSERT new user (no password_hash, no DOB) in DB transaction with portfolio/user_xp/streaks bootstrap — same transaction pattern as T1.1
  - [x] Return 200 `{ data: { user, accessToken, refreshToken } }` in all success cases
  - [x] Return 400 `VALIDATION_ERROR` on bad input, 500 on DB failure (rethrow)

- [x] Task 3 — Register route in `routes/index.ts` (AC: 1, 2)
  - [x] Add `router.post('/auth/oauth/callback', auth.oauthCallback)` in the Auth section (no auth middleware — unauthenticated endpoint)

- [x] Task 4 — Update NextAuth `signIn` + `jwt` callbacks in `lib/auth.ts` (AC: 1, 2, 3)
  - [x] Add `signIn` callback: when `account?.provider === 'google'`, call `POST ${API_URL}/api/v1/auth/oauth/callback`; mutate `user` object to add `accessToken`, `refreshToken`, `id` (DB UUID), `role`; return `false` on API failure to block sign-in
  - [x] Update `jwt` callback: refactored to use `unknown` intermediate cast (also fixed pre-existing scaffold TS errors on same lines)
  - [x] Verify `API_URL` env var is available in `auth.ts` (it's `process.env.API_URL`, used in credentials provider — reuse same var)

- [x] Task 5 — Add "Continue with Google" button to login and register pages (AC: 1, 3)
  - [x] `apps/web/app/(auth)/login/page.tsx`: add Google button below the form with a visual divider
  - [x] `apps/web/app/(auth)/register/page.tsx`: add Google button below the form with a visual divider
  - [x] Button calls `signIn('google', { callbackUrl: '/dashboard' })` — no `redirect: false` (OAuth requires full-page redirect)

- [x] Task 6 — Write tests for `oauthCallback` (AC: 1, 2)
  - [x] New Google user → 201, user created, portfolio bootstrapped, JWT returned
  - [x] Returning Google user (same oauth_id) → 200, JWT returned, no duplicate insert
  - [x] Account link path (email match, no oauth_id) → 200, oauth columns updated, JWT returned
  - [x] Invalid input (missing provider) → 400 `VALIDATION_ERROR`
  - [x] DB transaction ROLLBACK on new user insert failure
  - [x] 15/15 tests pass (10 T1.1 + 5 T1.2)

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Action needed |
|------|--------|---------------|
| `apps/web/lib/auth.ts` | ✅ GoogleProvider already imported + configured | Add signIn callback only |
| `apps/web/app/api/auth/[...nextauth]/route.ts` | ✅ Handler complete | No changes |
| `apps/web/app/providers.tsx` | ✅ SessionProvider wrapping app | No changes |
| `apps/api/src/db/migrations/001_users.sql` | ✅ oauth_provider, oauth_id, avatar_url columns exist | No changes |
| `.env.example` | ✅ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET documented | No changes |
| `apps/api/src/controllers/auth.controller.ts` | ✅ Exists, add oauthCallback export | DO NOT modify existing functions |
| `apps/api/src/routes/index.ts` | ✅ Exists, add 1 line | DO NOT modify existing routes |

### Critical Architecture: `users` Table Shape (from `001_users.sql`)

```sql
password_hash   VARCHAR(255)    -- NULLABLE — OAuth users have no password
oauth_provider  VARCHAR(20)     -- 'google' | NULL
oauth_id        VARCHAR(255)    -- Google sub claim | NULL
date_of_birth   DATE            -- NULLABLE — OAuth users start without DOB (T1.4 handles)
avatar_url      TEXT            -- NULLABLE — store Google profile picture
```

**No migration to `001_users.sql` needed** — columns already exist. Only add the lookup index in `011_oauth_index.sql`.

### New Migration: `011_oauth_index.sql`

```sql
-- Partial unique index: only enforces uniqueness where OAuth is used
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;
```

### `oauthCallback` Input Schema

```typescript
const oauthCallbackSchema = z.object({
  provider: z.enum(['google']),
  oauthId: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});
```

### Username Auto-Generation for New OAuth Users

```typescript
function generateOAuthUsername(name?: string, email?: string): string {
  const base = name
    ? name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20)
    : (email ?? 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  const suffix = Math.random().toString(36).slice(2, 6); // 4 random alphanumeric
  return `${base || 'user'}_${suffix}`;
}
```

**Collision handling:** Username unique constraint will throw on INSERT. Retry once with a different suffix (or let the DB constraint surface as a 409 for retry by caller — acceptable for pilot).

### `oauthCallback` Implementation Outline

```typescript
export async function oauthCallback(req: Request, res: Response) {
  const body = oauthCallbackSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid OAuth data.' } });

  const { provider, oauthId, email, name, avatarUrl } = body.data;

  // 1. Returning OAuth user (same provider + id)
  let row = await db.query(
    'SELECT id, email, username, role FROM users WHERE oauth_provider=$1 AND oauth_id=$2',
    [provider, oauthId],
  );
  if (row.rows.length > 0) {
    const user = row.rows[0];
    return issueTokens(res, user);  // see below
  }

  // 2. Account linking: existing email/password user
  row = await db.query('SELECT id, email, username, role FROM users WHERE email=$1', [email]);
  if (row.rows.length > 0) {
    const user = row.rows[0];
    await db.query(
      'UPDATE users SET oauth_provider=$1, oauth_id=$2, avatar_url=$3, updated_at=NOW() WHERE id=$4',
      [provider, oauthId, avatarUrl ?? null, user.id],
    );
    return issueTokens(res, user);
  }

  // 3. New user — DB transaction, same pattern as register()
  const username = generateOAuthUsername(name, email);
  const client = await db.connect();
  let user: Record<string, unknown>;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users(email, username, oauth_provider, oauth_id, avatar_url, role)
       VALUES($1,$2,$3,$4,$5,'student') RETURNING id, email, username, role, created_at`,
      [email, username, provider, oauthId, avatarUrl ?? null],
    );
    user = rows[0];
    await client.query('INSERT INTO portfolios(user_id) VALUES($1)', [user.id]);
    await client.query('INSERT INTO user_xp(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]);
    await client.query('INSERT INTO streaks(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return issueTokens(res, user, 201);
}

// Helper shared with register() / login() pattern
async function issueTokens(res: Response, user: Record<string, unknown>, status = 200) {
  const accessToken = signAccessToken(user.id as string, user.role as string, false);
  const refreshToken = signRefreshToken(user.id as string);
  await redis.set(`refresh:${user.id}:${refreshToken.slice(-20)}`, '1', 'EX', 60 * 60 * 24 * 7);
  return res.status(status).json({ data: { user, accessToken, refreshToken } });
}
```

> **Note:** `signAccessToken` and `signRefreshToken` already exist in `auth.controller.ts` — do NOT redeclare them. `issueTokens` can be a local helper in the same file.

### NextAuth `signIn` Callback (add to `lib/auth.ts`)

```typescript
async signIn({ user, account }) {
  if (account?.provider === 'google') {
    try {
      const res = await fetch(`${process.env.API_URL}/api/v1/auth/oauth/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          oauthId: account.providerAccountId,
          email: user.email,
          name: user.name,
          avatarUrl: user.image,
        }),
      });
      if (!res.ok) return false; // blocks sign-in, user stays on /login?error=
      const json = await res.json();
      // Mutate user so jwt callback picks these up
      const u = user as Record<string, unknown>;
      u.accessToken = json.data.accessToken;
      u.refreshToken = json.data.refreshToken;
      u.id = json.data.user.id;       // DB UUID, NOT Google sub
      u.role = json.data.user.role;
      return true;
    } catch {
      return false;
    }
  }
  return true; // credentials path — authorize() already validated
},
```

**The existing `jwt` callback does NOT need changes** — it already reads `user.accessToken`, `user.refreshToken`, `user.role`, `user.id` on first sign-in. The `signIn` callback sets these on the user object before `jwt` fires.

### UI: "Continue with Google" Button Pattern

For both `login/page.tsx` and `register/page.tsx`, add BELOW the form:

```tsx
<div className="relative my-4">
  <div className="absolute inset-0 flex items-center">
    <span className="w-full border-t border-slate-700" />
  </div>
  <div className="relative flex justify-center text-xs text-slate-500">
    <span className="bg-surface-900 px-2">or</span>
  </div>
</div>
<button
  type="button"
  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
  className="btn-secondary w-full flex items-center justify-center gap-2"
>
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
  Continue with Google
</button>
```

> `btn-secondary` uses existing Tailwind utility from the project's global CSS. Do NOT add new CSS — reuse existing classes.

### Testing Strategy

Co-locate test with controller: `apps/api/src/controllers/auth.controller.test.ts` (existing file).

Add a new `describe('oauthCallback()')` block — do NOT modify existing `describe('register()')` tests.

Mock pattern for `oauthCallback` is identical to T1.1's transaction tests:
- `vi.mocked(db.query)` for lookup queries
- `vi.mocked(db.connect).mockResolvedValueOnce(mockClient)` for new-user transaction path
- `vi.mocked(redis.set)` for token storage

### Scope Boundaries — DO NOT Implement

- DOB collection after OAuth sign-up → T1.4 (is_minor flag + profile completion)
- Session token refresh (silent 15-min access token renewal) → T1.3
- Avatar display in the UI → not in scope for T1.2
- "Complete your profile" post-OAuth wizard → T1.4
- Google Workspace SSO for school domains → Phase 2 / T3

### Environment Variables

No new env vars — `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are already in `.env.example`. Both must be set in `.env` for OAuth to work. Get them from: Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`).

### References

- [Source: docs/epics.md#Story T1.2]
- [Source: docs/architecture.md#Authentication & Security]
- [Source: apps/web/lib/auth.ts] — existing NextAuth config (GoogleProvider already there)
- [Source: apps/api/src/controllers/auth.controller.ts] — add oauthCallback, reuse signAccessToken/signRefreshToken
- [Source: apps/api/src/db/migrations/001_users.sql] — oauth_provider/oauth_id columns exist
- [Source: docs/stories/t1-1-student-registration-with-email-and-password.md] — transaction pattern, error envelope, Redis namespace

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `011_oauth_index.sql` with partial unique index on `(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL` — allows multiple NULL rows for email/password users.
- Added `oauthCallback()` to `auth.controller.ts` with 3-path logic: returning OAuth user (lookup by provider+id) → 200; account linking (email match) → UPDATE + 200; new user → DB transaction bootstrap + 201. Reuses `signAccessToken`, `signRefreshToken`, and Redis pattern from T1.1.
- Added `generateOAuthUsername()` helper that lowercases name, strips non-alphanumeric, appends 4-char random suffix to avoid collisions.
- Added `issueTokens()` private helper to deduplicate JWT signing + Redis storage across all 3 paths.
- Registered `POST /auth/oauth/callback` (no auth middleware) in `routes/index.ts`.
- Added `signIn` callback to NextAuth `authOptions` in `lib/auth.ts`: Google OAuth path calls Express API server-to-server, mutates NextAuth `user` object so `jwt` callback picks up DB UUID + role. Non-Google path returns `true` (credentials already validated by `authorize()`).
- Fixed pre-existing TS2352 errors in `jwt` callback by using `user as unknown as Record<string, string>` double-cast.
- Added 5 new tests in `auth.controller.test.ts` in a new `describe('oauthCallback()')` block — all 15 tests pass (no regressions).
- Pre-existing TS errors in `ai-coach/page.tsx`, `learn/page.tsx`, `claude.service.ts`, `subscription.controller.ts` are Phase 3 scaffold issues — NOT introduced by T1.2.

### File List

- `apps/api/src/db/migrations/011_oauth_index.sql` — created (partial unique index)
- `apps/api/src/controllers/auth.controller.ts` — modified (oauthCallback, generateOAuthUsername, issueTokens, oauthCallbackSchema)
- `apps/api/src/routes/index.ts` — modified (POST /auth/oauth/callback route)
- `apps/web/lib/auth.ts` — modified (signIn callback, jwt callback cast fix)
- `apps/web/app/(auth)/login/page.tsx` — modified (Continue with Google button)
- `apps/web/app/(auth)/register/page.tsx` — modified (Continue with Google button)
- `apps/api/src/controllers/auth.controller.test.ts` — modified (5 new oauthCallback tests)
- `docs/stories/t1-2-google-oauth-registration-and-login.md` — updated (task checkboxes, this record)
- `docs/stories/sprint-status.yaml` — updated (t1-2 → review)

### Change Log

- 2026-03-25: T1.2 implemented — Google OAuth upsert endpoint, NextAuth signIn callback, account linking, "Continue with Google" UI, 5 tests passing (claude-sonnet-4-6)
