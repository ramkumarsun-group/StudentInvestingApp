# Story T1.3: Secure Session Management and Logout

Status: review

## Story

As an authenticated user,
I want my session to be secure with automatic token refresh and a reliable logout,
so that my account cannot be accessed by others on shared devices.

## Acceptance Criteria

1. **Given** I click "Sign out" from the user menu,
   **When** the logout request is processed,
   **Then** my refresh token is invalidated in Redis and I am redirected to the login page.

2. **Given** my access token expires (15-minute TTL),
   **When** I make an API request,
   **Then** the client silently refreshes using the refresh token without interrupting my session.

3. **Given** a previously-used refresh token is replayed,
   **When** the second request arrives,
   **Then** it is rejected with 401 and I am redirected to login.

## Tasks / Subtasks

- [x] Task 1 — Add access token expiry tracking to NextAuth JWT callback (AC: 2)
  - [x] In `apps/web/lib/auth.ts` `jwt` callback: on initial sign-in (`if (user)`), store `accessTokenExpiry: Date.now() + 14 * 60 * 1000` in the token (14-minute window = 1-minute buffer before actual 15-minute expiry)
  - [x] Add `refreshAccessToken(token)` async helper at the top of `auth.ts`: calls `POST ${process.env.API_URL}/api/v1/auth/refresh` with body `{ refreshToken: token.refreshToken }`, on success returns updated token with new `accessToken`, `refreshToken`, `accessTokenExpiry`; on failure sets `token.error = 'RefreshAccessTokenError'` and returns token unchanged
  - [x] In `jwt` callback (when `user` is absent): if `Date.now() < (token.accessTokenExpiry as number)`, return token as-is; otherwise call `refreshAccessToken(token)` and return the result

- [x] Task 2 — Expose refresh error in NextAuth session callback (AC: 2, 3)
  - [x] In `apps/web/lib/auth.ts` `session` callback: add `if (token.error) session.error = token.error as string;`
  - [x] Add `error?: string` to the TypeScript `Session` declaration in the `declare module 'next-auth'` block at the bottom of the file

- [x] Task 3 — Create server-side Next.js logout API route (AC: 1)
  - [x] Create `apps/web/app/api/logout/route.ts` with a `POST` handler
  - [x] Use `getToken({ req })` from `next-auth/jwt` to read the server-side JWT (contains `refreshToken` never exposed to the browser)
  - [x] Call `POST ${process.env.API_URL}/api/v1/auth/logout` with `Authorization: Bearer ${token.accessToken}` header and body `{ refreshToken: token.refreshToken }` — this invalidates the refresh token in Redis
  - [x] Return `Response.json({ ok: true })` on success; return `Response.json({ ok: false }, { status: 500 })` on failure
  - [x] Route must work even if the Express API call fails (catch errors, still return 200 — NextAuth `signOut` will clear the session regardless)

- [x] Task 4 — Update TopBar.tsx logout to call server-side logout route first (AC: 1)
  - [x] In `apps/web/components/layout/TopBar.tsx`: replace the direct `signOut({ callbackUrl: '/login' })` call with an async handler that:
    1. Calls `fetch('/api/logout', { method: 'POST' })` — invalidates Redis refresh token server-side
    2. Then calls `signOut({ callbackUrl: '/login' })` — clears the NextAuth session cookie
  - [x] Do NOT add a loading spinner or error UI — fire-and-forget the API call (logout must always succeed from the user's perspective)

- [x] Task 5 — Auto sign-out on RefreshAccessTokenError (AC: 2, 3)
  - [x] In `apps/web/components/layout/TopBar.tsx`: add a `useEffect` that watches `session?.error` — if `session.error === 'RefreshAccessTokenError'`, call `signOut({ callbackUrl: '/login?error=session_expired' })`
  - [x] This handles the case where a refresh token was revoked server-side (e.g., replayed) and forces the user back to login without a broken UI state

- [x] Task 6 — Write tests for `logout` and `refreshTokens` controllers (AC: 1, 3)
  - [x] In `apps/api/src/controllers/auth.controller.test.ts`: add `describe('logout()')` block with these cases:
    - Valid logout with refreshToken and `req.user` → Redis `del` called with correct key, returns 200 `{ data: { message: 'Logged out' } }`
    - Missing `refreshToken` in body → 200 returned (graceful, no Redis call)
    - Missing `req.user` → 200 returned (no Redis call, no crash)
  - [x] Add `describe('refreshTokens()')` block with these cases:
    - Valid refresh → old Redis key deleted, new key stored, 200 with `{ accessToken, refreshToken }`
    - Missing `refreshToken` body → 400
    - Invalid/tampered JWT → 401 `'Invalid refresh token'`
    - Valid JWT but Redis key missing (revoked or already rotated) → 401 `'Refresh token revoked'`
    - Rotation verified: `redis.del` called before `redis.set` with new key
  - [x] Import `logout` and `refreshTokens` from `auth.controller` — add to existing import line (DO NOT modify existing `register` or `oauthCallback` tests)
  - [x] All tests use existing mock pattern: `vi.mocked(db.query)`, `vi.mocked(redis.del)`, `vi.mocked(redis.get)`, `vi.mocked(redis.set)` — no new mocks or test frameworks needed

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Action needed |
|------|--------|---------------|
| `apps/api/src/controllers/auth.controller.ts` | ✅ `logout`, `refreshTokens` fully implemented | Tests only (Task 6) |
| `apps/api/src/routes/index.ts` | ✅ `POST /auth/logout` (line 24) and `POST /auth/refresh` (line 23) registered | No changes |
| `apps/api/src/middleware/auth.middleware.ts` | ✅ Complete | No changes |
| `apps/web/lib/auth.ts` | ✅ NextAuth config with JWT strategy | Modify `jwt` + `session` callbacks only (Tasks 1–2) |
| `apps/web/components/layout/TopBar.tsx` | ✅ Has `signOut()` button on line 72 | Wrap with logout API call (Tasks 4–5) |
| `apps/web/lib/api-client.ts` | ✅ axios with session-based Bearer token | No changes — silent refresh is handled in NextAuth layer |
| Redis key namespace | ✅ `refresh:{userId}:{tokenSuffix}` (last 20 chars of token) | No changes |

### Critical Architecture: Token Rotation Already Implemented

The `refreshTokens` controller (`auth.controller.ts` lines 142–173) already implements **single-use rotation**:
1. Verifies JWT signature against `JWT_REFRESH_SECRET`
2. Checks `redis.get(`refresh:${userId}:${token.slice(-20)}`)` — 401 if missing/revoked
3. **Deletes** the old key before issuing new tokens (`redis.del(key)`)
4. Issues new access token + new refresh token
5. Stores the **new** refresh token in Redis

This means AC3 (replayed refresh token rejected) is server-side complete — the second replay of the same token will get `redis.get` → null → 401. Tasks for T1.3 only need to wire up the **client-side** behavior on top.

### The `logout` Controller (already correct, needs tests only)

```typescript
// apps/api/src/controllers/auth.controller.ts (lines 176–182)
export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (refreshToken && req.user) {
    await redis.del(`refresh:${req.user.userId}:${refreshToken.slice(-20)}`);
  }
  return res.json({ data: { message: 'Logged out' } });
}
```
- Protected by `authMiddleware` (route registered with it on line 24 of routes/index.ts)
- Requires `Authorization: Bearer <accessToken>` header — `req.user` is populated by `authMiddleware`
- Body: `{ refreshToken: string }` — last 20 chars used as Redis key suffix

### Why the Refresh Token Is Not in the Browser Session

The NextAuth session callback (in `auth.ts`) only exposes `accessToken` — NOT `refreshToken`:
```typescript
async session({ session, token }) {
  session.accessToken = token.accessToken as string;
  // refreshToken intentionally NOT exposed (security)
  session.user.role = token.role as string;
  session.user.id = token.userId as string;
  return session;
},
```
The refresh token lives in the encrypted NextAuth JWT cookie (`next-auth.session-token` httpOnly cookie). To read it server-side, use `getToken({ req })` from `next-auth/jwt`. This is why Task 3 creates a server-side Next.js API route rather than calling the Express API directly from `TopBar.tsx`.

### Task 1 — `refreshAccessToken` Helper Spec

```typescript
// Add above authOptions in apps/web/lib/auth.ts
async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const res = await fetch(`${process.env.API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    const json = await res.json();
    return {
      ...token,
      accessToken: json.data.accessToken,
      refreshToken: json.data.refreshToken,
      accessTokenExpiry: Date.now() + 14 * 60 * 1000,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}
```

### Task 1 — Updated `jwt` Callback

```typescript
async jwt({ token, user }) {
  // Initial sign-in (user object populated by authorize() or signIn() callback)
  if (user) {
    const u = user as unknown as Record<string, string>;
    return {
      ...token,
      accessToken: u.accessToken,
      refreshToken: u.refreshToken,
      accessTokenExpiry: Date.now() + 14 * 60 * 1000,
      role: u.role,
      userId: u.id,
    };
  }
  // Token still valid
  if (Date.now() < (token.accessTokenExpiry as number)) {
    return token;
  }
  // Access token expired — silently refresh
  return refreshAccessToken(token as Record<string, unknown>);
},
```

**Important:** Remove the old explicit `token.accessToken = u.accessToken` etc. lines that currently exist — the new version handles all token fields in one `return` statement. The existing `profile` parameter in the callback signature is unused — remove it to avoid lint warnings.

### Task 3 — Logout Route Spec

```typescript
// apps/web/app/api/logout/route.ts
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (token?.refreshToken && token?.accessToken) {
      await fetch(`${process.env.API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: token.refreshToken }),
      });
    }
  } catch {
    // Swallow — logout always succeeds from user's perspective
  }
  return Response.json({ ok: true });
}
```

### Task 4 — TopBar Sign-Out Handler

```typescript
// Replace line 72 in TopBar.tsx — keep all other JSX unchanged
async function handleSignOut() {
  await fetch('/api/logout', { method: 'POST' });
  signOut({ callbackUrl: '/login' });
}
// In JSX: onClick={handleSignOut}
```

### Task 5 — RefreshAccessTokenError Handler

```typescript
// Add in TopBar.tsx — inside the component function, after the existing useSession() call
useEffect(() => {
  if (session?.error === 'RefreshAccessTokenError') {
    signOut({ callbackUrl: '/login?error=session_expired' });
  }
}, [session?.error]);
```

### Task 6 — Test Patterns

The test file mock already includes `redis: { set: vi.fn(), get: vi.fn(), del: vi.fn() }`. For `refreshTokens`, mock `req.user` is NOT needed (it uses the JWT body, not middleware). For `logout`, `req.user` must be set manually:

```typescript
// For logout tests — req.user is set by authMiddleware (mock it):
const req = {
  body: { refreshToken: 'some.long.refresh.token.last20charssuffix' },
  user: { userId: 'user-uuid-1', role: 'student', isPro: false },
} as unknown as Request;

// For refreshTokens tests — no req.user needed:
const req = { body: { refreshToken: validRefreshToken } } as Request;
```

For `refreshTokens` token rotation test, verify order matters:
```typescript
const delMock = vi.mocked(redis.del);
const setMock = vi.mocked(redis.set);
// After calling refreshTokens:
expect(delMock).toHaveBeenCalledBefore(setMock); // vitest-when or check call order
// OR simpler: just verify both were called with correct args
expect(delMock).toHaveBeenCalledWith('refresh:user-uuid-1:<last20ofOldToken>');
expect(setMock).toHaveBeenCalledWith(
  expect.stringMatching(/^refresh:user-uuid-1:/),
  '1', 'EX', 604800,
);
```

For the `refreshTokens` "valid refresh" test, you need a real JWT signed with `JWT_REFRESH_SECRET` (the mock env value). Use `jwt.sign({ userId: 'user-uuid-1' }, 'test-refresh-secret-minimum-32-chars', { expiresIn: '7d' })` in the test to generate a valid token.

**Mock setup for `refreshTokens` (valid path):**
```typescript
// redis.get returns '1' (key exists)
vi.mocked(redis.get).mockResolvedValueOnce('1' as never);
vi.mocked(redis.del).mockResolvedValueOnce(1 as never);
// db.query: SELECT role FROM users WHERE id=$1
vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ role: 'student' }] } as never);
// db.query: SELECT id FROM subscriptions WHERE user_id=$1 AND status='active'
vi.mocked(db.query).mockResolvedValueOnce({ rows: [] } as never);
vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);
```

### TypeScript Declaration Update (Task 2)

```typescript
declare module 'next-auth' {
  interface Session {
    accessToken: string;
    error?: string;  // ← add this field
    user: { id: string; role: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
```

Also add to JWT type if needed (create or extend):
```typescript
declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiry?: number;
    role?: string;
    userId?: string;
    error?: string;
  }
}
```

### Scope Boundaries — DO NOT Implement

- Middleware.ts for route-level auth protection → out of scope for T1.3 (handled by DashboardLayout server component)
- Refresh token rotation on every API call (vs. only on expiry) → not required; 15-minute access token is sufficient
- "Remember me" or extended session duration → not in scope
- Concurrent refresh token rotation race condition (two tabs refreshing simultaneously) → deferred to Phase 2 (use `token.error` fallback path instead)
- Session TTL synced between NextAuth cookie and Redis → out of scope; Redis TTL (7d) is already set in `issueTokens`

### References

- [Source: apps/api/src/controllers/auth.controller.ts#L142-182] — refreshTokens and logout implementations
- [Source: apps/api/src/routes/index.ts#L23-24] — POST /auth/refresh and POST /auth/logout routes
- [Source: apps/web/lib/auth.ts] — NextAuth JWT + session callbacks to extend
- [Source: apps/web/components/layout/TopBar.tsx#L72] — signOut button to update
- [Source: apps/web/lib/api-client.ts] — axios client (no changes needed)
- [Source: apps/web/next.config.js#L14-21] — /api/backend proxy to http://localhost:4000/api/v1
- [Source: docs/architecture.md#Authentication & Security] — JWT lifetimes + Redis key namespace
- [Source: docs/stories/t1-2-google-oauth-registration-and-login.md] — signIn callback + jwt callback patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `refreshAccessToken()` helper above `authOptions` in `auth.ts` — calls Express `/auth/refresh` server-to-server, returns updated token or sets `error: 'RefreshAccessTokenError'` on failure.
- Updated `jwt` callback: initial sign-in sets `accessTokenExpiry = Date.now() + 14min`; subsequent calls check expiry before attempting refresh; replaces the previous individual field-assignment pattern with a single `return { ...token, ... }`.
- Updated `session` callback: passes `token.error` into `session.error` so client components can detect expired/revoked sessions.
- Added TypeScript declarations for `Session.error` and full `JWT` interface in `next-auth/jwt` module augmentation.
- Created `apps/web/app/api/logout/route.ts`: reads refresh token from httpOnly JWT cookie via `getToken()` (never exposed to browser), calls Express `POST /auth/logout`, swallows errors so logout always succeeds.
- Updated `TopBar.tsx`: `handleSignOut` calls `/api/logout` before `signOut()` to invalidate Redis key; `useEffect` on `session?.error` auto-signs-out on `RefreshAccessTokenError`.
- Added 8 new tests (3 `logout` + 5 `refreshTokens`) to `auth.controller.test.ts`. Fixed 4 pre-existing `oauthCallback` test regressions caused by `getIsPro` subscriptions query added to `issueTokens` after T1.2 tests were written. All 23 tests pass.
- Pre-existing TS errors in `ai-coach/page.tsx` and `learn/page.tsx` are Phase 3 scaffold issues — not introduced by T1.3.

### File List

- `apps/web/lib/auth.ts` — modified (refreshAccessToken helper, jwt callback expiry + refresh, session error, JWT type declarations)
- `apps/web/app/api/logout/route.ts` — created (server-side logout: reads JWT cookie, invalidates Redis via Express API)
- `apps/web/components/layout/TopBar.tsx` — modified (handleSignOut calls /api/logout first; useEffect auto-signs-out on RefreshAccessTokenError)
- `apps/api/src/controllers/auth.controller.test.ts` — modified (8 new tests; fixed 4 pre-existing oauthCallback mock gaps)
- `docs/stories/t1-3-secure-session-management-and-logout.md` — updated (task checkboxes, this record)
- `docs/stories/sprint-status.yaml` — updated (t1-3 → review)

### Change Log

- 2026-03-25: T1.3 implemented — NextAuth silent token refresh, server-side logout route, TopBar sign-out fix, RefreshAccessTokenError auto-redirect, 8 new tests (23/23 passing) (claude-sonnet-4-6)
