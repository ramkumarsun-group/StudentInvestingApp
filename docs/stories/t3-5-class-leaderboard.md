# Story T3.5: Class Leaderboard

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-5-class-leaderboard
**Date Prepared:** 2026-04-29

---

## Story

As a student enrolled in a class,
I want to see how my portfolio return ranks within my class,
So that I can compete with my classmates.

---

## Acceptance Criteria

**AC1 — Class leaderboard tab appears for enrolled students**
**Given** I am enrolled in a class and visit the Leaderboard page
**When** the page loads
**Then** I see two tabs: "Global" and "My Class"; the class tab is selected by default

**AC2 — Class leaderboard shows only classmates ranked by return**
**Given** I select the class leaderboard tab
**When** it loads
**Then** I see only my enrolled classmates ranked by portfolio return percentage, with rank, username, level, portfolio value, and return %

**AC3 — Leaderboard updates on 5-minute cron**
**Given** a classmate places a trade that changes their class portfolio return
**When** the leaderboard cron job runs (every 5 minutes)
**Then** their position updates; the frontend auto-refreshes every 5 minutes

**AC4 — Unenrolled students see global tab only**
**Given** I am a student not enrolled in any class
**When** I view the Leaderboard page
**Then** only the Global tab is shown (no class tab)

**AC5 — Empty class leaderboard shows placeholder**
**Given** I am the only student in my class (or no students have traded yet)
**When** I view the class leaderboard
**Then** I see a placeholder: "No class rankings yet — start trading to appear here!"

---

## Tasks / Subtasks

### Task 1 — Backend: class leaderboard endpoint

- [ ] In `apps/api/src/controllers/leaderboard.controller.ts`, add:
  ```typescript
  export async function getClassLeaderboard(req: Request, res: Response) {
    const { classId } = req.params;
    const userId = req.user!.userId;

    // Verify requester is enrolled in this class
    const { rows: enrollment } = await db.query(
      'SELECT id FROM class_enrollments WHERE class_id=$1 AND student_id=$2',
      [classId, userId],
    );
    if (enrollment.length === 0) {
      return res.status(403).json({ error: 'Not enrolled in this class' });
    }

    // Try Redis class leaderboard (populated by cron)
    const REDIS_KEY = `leaderboard:class:${classId}`;
    const members = await redis.zrevrange(REDIS_KEY, 0, 99, 'WITHSCORES');

    if (members.length > 0) {
      const entries = [];
      for (let i = 0; i < members.length; i += 2) {
        const memberId = members[i];
        const score = parseFloat(members[i + 1]) / 100;
        entries.push({ userId: memberId, returnPct: score, rank: Math.floor(i / 2) + 1 });
      }
      // Enrich with user data
      const enriched = await Promise.all(
        entries.map(async (e) => {
          const { rows } = await db.query(
            `SELECT u.username, u.avatar_url, ux.current_level, l.name AS level_name, p.total_value
             FROM users u
             JOIN user_xp ux ON ux.user_id=u.id
             JOIN levels l ON l.id=ux.current_level
             JOIN portfolios p ON p.id=(
               SELECT portfolio_id FROM class_enrollments WHERE class_id=$2 AND student_id=u.id
             )
             WHERE u.id=$1`,
            [e.userId, classId],
          );
          return rows.length ? { ...e, ...rows[0] } : e;
        }),
      );
      return res.json({ data: enriched });
    }

    // Fallback: DB query
    const { rows } = await db.query(
      `SELECT u.id AS user_id, u.username, u.avatar_url,
         ux.current_level, l.name AS level_name,
         p.total_value, p.total_return_pct AS return_pct,
         ROW_NUMBER() OVER (ORDER BY p.total_return_pct DESC NULLS LAST) AS rank
       FROM class_enrollments ce
       JOIN users u ON u.id=ce.student_id
       JOIN portfolios p ON p.id=ce.portfolio_id
       JOIN user_xp ux ON ux.user_id=u.id
       JOIN levels l ON l.id=ux.current_level
       WHERE ce.class_id=$1
       ORDER BY p.total_return_pct DESC NULLS LAST`,
      [classId],
    );
    return res.json({ data: rows });
  }
  ```

- [ ] In `apps/api/src/routes/index.ts`, register:
  ```typescript
  router.get('/leaderboard/class/:classId', authMiddleware, leaderboard.getClassLeaderboard);
  ```
  Add this immediately after the existing global leaderboard routes.

### Task 2 — Backend: class leaderboard cron refresh

- [ ] In `apps/api/src/jobs/index.ts`, add a `refreshClassLeaderboards` function and schedule it every 5 minutes (alongside the existing leaderboard cron):
  ```typescript
  export async function refreshClassLeaderboards() {
    const { rows: classes } = await db.query(
      'SELECT id FROM classes WHERE is_active=true',
    );
    for (const cls of classes) {
      const { rows } = await db.query(
        `SELECT ce.student_id, p.total_return_pct
         FROM class_enrollments ce
         JOIN portfolios p ON p.id=ce.portfolio_id
         WHERE ce.class_id=$1`,
        [cls.id],
      );
      const REDIS_KEY = `leaderboard:class:${cls.id}`;
      const pipeline = redis.pipeline();
      pipeline.del(REDIS_KEY);
      for (const row of rows) {
        pipeline.zadd(REDIS_KEY, parseFloat(row.total_return_pct ?? 0) * 100, row.student_id);
      }
      await pipeline.exec();
    }
  }
  ```
  Schedule: `cron.schedule('*/5 * * * *', refreshClassLeaderboards)` — add to the existing cron setup in `jobs/index.ts`.

### Task 3 — Frontend: fetch enrolled class for leaderboard

- [ ] In `apps/web/app/(dashboard)/leaderboard/page.tsx`:
  - Add query: `GET /api/v1/classes/my` → `['my-classes']`
  - Extract first enrolled class (MVP: one class per student): `const myClass = (myClasses ?? [])[0]`
  - Derive: `const classId = myClass?.id`

### Task 4 — Frontend: add class leaderboard tab

- [ ] Wrap leaderboard content in a tab UI:
  ```tsx
  const [tab, setTab] = useState<'global' | 'class'>(classId ? 'class' : 'global');
  ```
  - Render tab buttons only when `classId` is defined
  - When `tab === 'global'`: render existing global leaderboard table (unchanged)
  - When `tab === 'class'`: fetch `GET /api/v1/leaderboard/class/${classId}` via `['leaderboard-class', classId]`; render same table structure as global leaderboard; refetch interval 5 minutes (`refetchInterval: 5 * 60 * 1000`)
  - Tab button style: match the existing Editorial Intelligence tokens — active: `bg-primary-container/20 text-primary`, inactive: `text-on-surface-variant hover:text-on-surface`

### Task 5 — Frontend: class tab empty state

- [ ] When class leaderboard returns an empty array, show:
  ```tsx
  <div className="p-8 text-center text-on-surface-variant">
    No class rankings yet — start trading to appear here!
  </div>
  ```

---

## Dev Notes

### Class portfolio vs global portfolio
The class leaderboard ranks by `portfolios.total_return_pct` for the **class-specific portfolio** (linked via `class_enrollments.portfolio_id`). This is different from the global portfolio (`portfolios.is_active=true`). Students can have different returns in their class portfolio vs their global portfolio.

### Redis key naming convention
`leaderboard:global` is the existing key. Use `leaderboard:class:{classId}` (UUID) for class-scoped boards. No conflicts.

### `jobs/index.ts` patterns
Examine the existing cron setup in `apps/api/src/jobs/index.ts` before implementing Task 2 — follow the same `node-cron` import pattern and existing schedule convention. Import `db` and `redis` from their config paths (already imported for `refreshLeaderboard`).

### One class per student (MVP)
`GET /classes/my` can return multiple rows but the MVP constraint is one class per student (the 409 check in `joinClass` blocks a second enrollment). `myClasses[0]` is safe for MVP.

### `total_return_pct` null safety
New class portfolios with zero trades have `total_return_pct = NULL`. In the Redis ZADD, `parseFloat(null) = NaN` — guard with `?? 0`. In the DB query, `ORDER BY ... NULLS LAST` handles it.

---

## QA Tasks / Test Coverage

### Unit / Integration Tests (API)
- [ ] `GET /leaderboard/class/:classId` with enrolled student JWT → 200, returns ranked list of classmates only
- [ ] `GET /leaderboard/class/:classId` with non-enrolled student JWT → 403
- [ ] `GET /leaderboard/class/:classId` with teacher JWT → 403 (teacher is not enrolled as student)
- [ ] `GET /leaderboard/class/:classId` with no enrolled students → 200, empty array
- [ ] `refreshClassLeaderboards()` → Redis keys `leaderboard:class:{id}` populated for all active classes
- [ ] `refreshClassLeaderboards()` → NULL `total_return_pct` handled as 0 (no NaN in Redis)
- [ ] Class leaderboard does not include students from other classes

### E2E Tests (Playwright)
- [ ] Enrolled student visits Leaderboard → "My Class" tab visible and selected by default
- [ ] Class tab shows only classmates, not global users
- [ ] Non-enrolled student visits Leaderboard → only "Global" tab shown, no class tab
- [ ] Class leaderboard empty state shows correct placeholder text
- [ ] Global tab still works correctly after class tab added (no regression)
- [ ] Class leaderboard refreshes every 5 minutes (mock timer in test or verify `refetchInterval` prop)

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
- 2026-04-29: T3.5 story created — class leaderboard
