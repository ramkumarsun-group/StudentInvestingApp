# Story T1.4: Age Verification and Under-18 Account Flagging

Status: review

## Story

As the system,
I want to verify user age at registration and flag minor accounts,
so that COPPA compliance is maintained and parental visibility can be enabled.

## Acceptance Criteria

1. **Given** a user registers with a DOB indicating they are under 13,
   **When** the form is submitted,
   **Then** registration is hard-blocked; no account is created.

2. **Given** a user registers with a DOB indicating they are 13–17,
   **When** registration succeeds,
   **Then** the account is flagged `is_minor: true`.

3. **Given** a user registers with a DOB indicating 18 or older,
   **When** registration succeeds,
   **Then** `is_minor` is `false` and standard privacy settings apply.

## Tasks / Subtasks

- [x] Task 1 — Add `is_minor` column via DB migration (AC: 2, 3)
  - [x] Create `apps/api/src/db/migrations/012_is_minor.sql`
  - [x] SQL: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT FALSE;`
  - [x] Add index: `CREATE INDEX IF NOT EXISTS idx_users_is_minor ON users(is_minor) WHERE is_minor = TRUE;` (partial index — only indexes minor accounts, used in future Phase 2 parental visibility queries)

- [x] Task 2 — Update `register()` controller to set `is_minor` on INSERT (AC: 2, 3)
  - [x] In `apps/api/src/controllers/auth.controller.ts`: compute `const isMinor = age >= 13 && age < 18;` after the existing `calculateAge()` call (age is already computed before the transaction)
  - [x] Update the INSERT query to include `is_minor` column: add `, is_minor` to the column list and `,$6` to the values, add `isMinor` as the 6th parameter
  - [x] Update `RETURNING` clause to include `is_minor`: add `, is_minor` so the response includes the flag
  - [x] Do NOT modify the existing age enforcement block (under-13 returns 422 `AGE_BELOW_MINIMUM`) — it is correct and AC1 is already satisfied

- [x] Task 3 — Write tests for `is_minor` flagging in `register()` (AC: 2, 3)
  - [x] In `apps/api/src/controllers/auth.controller.test.ts`: add a new `describe('register() — is_minor flagging')` block
  - [x] Test AC2: DOB yielding age 13 → INSERT includes `is_minor: true` (assert 4th arg of 2nd `mockClient.query` call contains `true` in the values array)
  - [x] Test AC2: DOB yielding age 17 → INSERT includes `is_minor: true`
  - [x] Test AC3: DOB yielding age 18 → INSERT includes `is_minor: false`
  - [x] Test AC3: DOB yielding age 25 → INSERT includes `is_minor: false`
  - [x] DO NOT modify existing `describe('register()')` tests — those cover other ACs and must remain green

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Action needed |
|------|--------|---------------|
| `apps/api/src/controllers/auth.controller.ts` | ✅ `calculateAge()` + under-13 block (422) already correct | Task 2 only — add `isMinor` compute + extend INSERT |
| `apps/web/app/(auth)/register/page.tsx` | ✅ DOB field + client-side `getAge()` guard (blocks submit if < 13) | No changes needed |
| `apps/api/src/db/migrations/001_users.sql` | ✅ `date_of_birth DATE` column exists | No changes — only add new migration 012 |
| `apps/api/src/controllers/auth.controller.test.ts` | ✅ Existing register tests cover AC1, duplicate email, password validation | Add new describe block only |

### Critical: `is_minor` Column Does NOT Exist Yet

`001_users.sql` has `date_of_birth` but **no `is_minor` column**. Architecture naming convention confirms: `is_` prefix for booleans (e.g. `is_pro`, `is_deleted`). The migration must be numbered `012` (011 is the OAuth index from T1.2).

### Current `register()` INSERT (lines 84–89 of auth.controller.ts)

```typescript
// CURRENT — does not set is_minor
const { rows } = await client.query(
  `INSERT INTO users(email, username, password_hash, role, date_of_birth)
   VALUES($1,$2,$3,$4,$5) RETURNING id, email, username, role, created_at`,
  [email, username, await bcrypt.hash(password, 12), role, dateOfBirth],
);
```

```typescript
// AFTER CHANGE — adds is_minor
const isMinor = age >= 13 && age < 18;
const { rows } = await client.query(
  `INSERT INTO users(email, username, password_hash, role, date_of_birth, is_minor)
   VALUES($1,$2,$3,$4,$5,$6) RETURNING id, email, username, role, is_minor, created_at`,
  [email, username, await bcrypt.hash(password, 12), role, dateOfBirth, isMinor],
);
```

`age` is already computed at line 53 (`const age = calculateAge(dateOfBirth)`) before the duplicate-email checks and transaction. Add `const isMinor = age >= 13 && age < 18;` directly after the age enforcement block (after the `if (age < 13 || age > 120)` return).

### Where `age` Is Available

```typescript
// auth.controller.ts lines 52–62 (existing)
const age = calculateAge(dateOfBirth);           // line 53
if (age < 13 || age > 120) {                    // line 54 — AC1 already handled
  return res.status(422).json({ ... });
}
// ← ADD: const isMinor = age >= 13 && age < 18;
// then email/username duplicate checks follow
// then transaction begins
```

### Test Pattern for `is_minor` Assertion

The INSERT is the **2nd** `mockClient.query` call (after BEGIN). Asserting the parameter value:

```typescript
// After calling register(req, res):
const insertCall = mockClient.query.mock.calls[1]; // 2nd call = INSERT users
const params = insertCall[1] as unknown[];
// params: [email, username, hashedPw, role, dateOfBirth, isMinor]
expect(params[5]).toBe(true);   // or false
```

Use a reusable `setupTransactionMocksWithMinor` helper (copy of existing `setupTransactionMocks` but returning `is_minor` in the INSERT row):

```typescript
function setupMinorTransactionMocks(userId = 'minor-uuid-1', email = 'teen@example.com') {
  const dbQueryMock = vi.mocked(db.query);
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // email check
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // username check
  vi.mocked(db.connect).mockResolvedValueOnce(mockClient as never);
  mockClient.query
    .mockResolvedValueOnce(undefined as never)                // BEGIN
    .mockResolvedValueOnce({                                  // INSERT users
      rows: [{ id: userId, email, username: 'teen_user', role: 'student', is_minor: true, created_at: '2026-03-25T00:00:00.000Z' }],
      rowCount: 1,
    } as never)
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // portfolios
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // user_xp
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // streaks
    .mockResolvedValueOnce(undefined as never);                // COMMIT
  // getIsPro() subscriptions check inside issueTokens
  dbQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
  vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);
}
```

Helper for generating a DOB string at a specific age:
```typescript
function dobAtAge(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split('T')[0];
}
```

### Scope Boundaries — DO NOT Implement

- OAuth users (`oauthCallback`) — no DOB at OAuth signup; `is_minor` defaults `FALSE` via DB. Minor flag for OAuth is deferred to the profile-completion flow (post-T1.4 scope)
- Displaying `is_minor` in the UI or session — out of scope (Phase 2: parental visibility dashboard, T3.10)
- Parental consent / notification flow — Phase 2
- Any changes to `register/page.tsx` — client-side already blocks < 13; no UI changes for T1.4

### References

- [Source: apps/api/src/controllers/auth.controller.ts#L52-110] — existing register(), calculateAge(), INSERT users transaction
- [Source: apps/api/src/db/migrations/001_users.sql] — users table (no is_minor column yet)
- [Source: docs/architecture.md#Naming Patterns] — `is_` prefix for boolean columns
- [Source: docs/stories/t1-1-student-registration-with-email-and-password.md] — transaction pattern, test mock helpers
- [Source: apps/api/src/controllers/auth.controller.test.ts] — existing setupTransactionMocks, mockClient pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `012_is_minor.sql` — `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT FALSE` + partial index on `(is_minor) WHERE is_minor = TRUE` for Phase 2 parental queries.
- Added `const isMinor = age >= 13 && age < 18;` in `register()` after the age enforcement block. Extended INSERT query to 6 params (`$6` = isMinor), RETURNING now includes `is_minor`.
- Existing under-13 block (422 `AGE_BELOW_MINIMUM`) untouched — AC1 was already satisfied.
- Added `describe('register() — is_minor flagging')` with 4 tests (ages 13, 17, 18, 25). Added `dobAtAge()` and `setupMinorTransactionMocks()` helpers. All 27 tests pass (no regressions).

### File List

- `apps/api/src/db/migrations/012_is_minor.sql` — created (ALTER TABLE + partial index)
- `apps/api/src/controllers/auth.controller.ts` — modified (isMinor compute + INSERT is_minor)
- `apps/api/src/controllers/auth.controller.test.ts` — modified (4 new is_minor tests + helpers)
- `docs/stories/t1-4-age-verification-and-under-18-account-flagging.md` — updated (this record)
- `docs/stories/sprint-status.yaml` — updated (t1-4 → review)

### Change Log

- 2026-03-25: T1.4 implemented — is_minor migration, register() INSERT update, 4 new tests (27/27 passing) (claude-sonnet-4-6)
