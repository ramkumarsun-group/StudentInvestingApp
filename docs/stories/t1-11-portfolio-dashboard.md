# Story T1.11: Portfolio Dashboard

Status: done

## Story

As a student,
I want to view a summary of my entire portfolio,
So that I can quickly assess my overall performance.

## Acceptance Criteria

1. **Given** I navigate to the portfolio page,
   **When** the page loads,
   **Then** I see: total portfolio value, cash balance, total invested, total P&L ($ and %), and a mini chart of portfolio value over the last 30 days.

2. **Given** live price updates are available,
   **When** I view the portfolio,
   **Then** total value reflects current market prices, refreshed every 30 seconds.

3. **Given** I have no holdings,
   **When** I view the portfolio,
   **Then** I see my $100,000 cash balance, $0 P&L, and an empty state prompting me to make my first trade.

## Tasks / Subtasks

- [x] Task 1 — Add portfolio history snapshot job to `jobs/index.ts` (AC: 1)
  - [x] Add a new node-cron job scheduled at market close: `cron.schedule('0 21 * * 1-5', ...)` (21:00 UTC = 4pm ET, weekdays)
  - [x] Job body: for each active portfolio, insert a row into `leaderboard_snapshots`:
    ```typescript
    const { rows: portfolios } = await db.query(
      'SELECT p.id, p.user_id, p.total_value, p.total_return_pct, u.username, u.avatar_url FROM portfolios p JOIN users u ON u.id=p.user_id WHERE p.is_active=true'
    );
    for (const p of portfolios) {
      await db.query(
        `INSERT INTO leaderboard_snapshots(user_id, username, avatar_url, portfolio_value, return_pct)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [p.user_id, p.username, p.avatar_url, p.total_value, p.total_return_pct]
      );
    }
    ```
  - [x] Wrap in try/catch with `logger.error` on failure

- [x] Task 2 — Add Total P&L in $ to portfolio summary cards (AC: 1, 3)
  - [x] In `apps/web/app/(dashboard)/portfolio/page.tsx`, compute: `const totalPnlDollars = (portfolioData?.total_value ?? 0) - 100000`
  - [x] Replace the existing "Total Return" card (which shows %) with two cards:
    - "P&L" card showing `formatUSD(totalPnlDollars)` (green if positive, red if negative)
    - Keep "Total Return" showing `formatPercent(portfolioData?.total_return_pct ?? 0)` (colored)
  - [x] Expand grid from `grid-cols-2 md:grid-cols-4` — already 4 cols, just replace "Total Return" with "P&L ($)" and add "P&L (%)" as 5th (or combine into one card showing both)

- [x] Task 3 — Add 30-day history mini chart to portfolio page (AC: 1)
  - [x] Add `useQuery` for portfolio history:
    ```typescript
    const { data: history } = useQuery({
      queryKey: ['portfolio-history'],
      queryFn: () => apiClient.get('/portfolio/history').then((r: { data: { portfolio_value: number; date: string }[] }) => r.data),
    });
    ```
  - [x] Add a small AreaChart above the holdings/allocation section using Recharts (already imported for pie chart):
    ```tsx
    import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
    ```
  - [x] Chart data: `(history ?? []).map(h => ({ date: h.date.substring(0, 10), value: h.portfolio_value }))`
  - [x] Chart config: `height={120}`, no axes labels (mini chart), gradient fill from `#22c55e` to transparent
  - [x] Show empty/skeleton state when history is empty: "History builds after your first trading day"
  - [x] Place the mini chart in its own `card p-5` section with heading "Portfolio Performance"

- [x] Task 4 — Tests (AC: 1, 2, 3)
  - [x] In `apps/api/src/controllers/portfolio.controller.test.ts` (create if not exists):
    - [x] Mock `../config/db`
    - [x] Test `getPortfolioHistory`: DB returns rows → 200 with data array
    - [x] Test `getPortfolio`: DB returns portfolio → 200 with data
    - [x] Test `getPortfolio`: no portfolio → 404

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/web/app/(dashboard)/portfolio/page.tsx` | ✅ Full portfolio page exists | Tasks 2+3: patch to add P&L card + mini chart |
| `apps/api/src/controllers/portfolio.controller.ts` | ✅ `getPortfolio`, `getHoldings`, `getPortfolioHistory`, `resetPortfolio` | No changes needed |
| `apps/api/src/routes/index.ts` | ✅ All portfolio routes registered | No changes |
| `apps/api/src/jobs/index.ts` | ✅ node-cron jobs file | Task 1: add snapshot job |
| `apps/api/src/db/migrations/007_leaderboard.sql` | ✅ `leaderboard_snapshots` table | No migration needed |
| Recharts | ✅ Already imported in portfolio page (`PieChart`) | Import `AreaChart, Area` from same package |

### Starting Capital = $100,000

```typescript
const STARTING_CAPITAL = 100000; // dollars — NOT cents
const totalPnlDollars = (portfolioData?.total_value ?? 0) - STARTING_CAPITAL;
```

### Portfolio history endpoint response shape

`GET /portfolio/history` returns (from `leaderboard_snapshots`):
```json
{ "data": [{ "portfolio_value": 102500, "return_pct": 2.5, "date": "2026-03-25T21:00:00Z" }] }
```

### AreaChart pattern (mini chart)

```tsx
<ResponsiveContainer width="100%" height={120}>
  <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
    <defs>
      <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
      </linearGradient>
    </defs>
    <Area type="monotone" dataKey="value" stroke="#22c55e" fill="url(#portfolioGrad)" strokeWidth={2} dot={false} />
    <Tooltip
      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
      formatter={(v: number) => [formatUSD(v), 'Value']}
    />
  </AreaChart>
</ResponsiveContainer>
```

### Snapshot job — deduplication

The `leaderboard_snapshots` table has no unique constraint per user per day. To avoid duplicate snapshots, either:
- Add `ON CONFLICT DO NOTHING` (if unique constraint exists)
- Or check `WHERE snapshotted_at > NOW() - INTERVAL '23 hours'` before inserting

If no unique constraint exists on `(user_id, DATE(snapshotted_at))`, the dev should add one via a new migration `013_portfolio_history_unique.sql`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_user_date
  ON leaderboard_snapshots(user_id, DATE(snapshotted_at));
```

---

## Dev Agent Record

### Implementation Plan
- Task 1: Added `cron.schedule('0 21 * * 1-5', ...)` snapshot job to `apps/api/src/jobs/index.ts`. Created migration `013_portfolio_history_unique.sql` to add unique index on `(user_id, DATE(snapshotted_at))` for `ON CONFLICT DO NOTHING` deduplication.
- Task 2: Added `totalPnlDollars` computation using `STARTING_CAPITAL = 100000` (dollars). Expanded summary card grid to 5 columns (`grid-cols-2 md:grid-cols-5`) with new "P&L ($)" card, colored green/red. "Total Return" (%) card retained.
- Task 3: Added `useQuery(['portfolio-history'])` hook. Added "Portfolio Performance" card with 120px `AreaChart` using green gradient fill, Tooltip with `formatUSD`. Empty state: "History builds after your first trading day".
- Task 4: Created `portfolio.controller.test.ts` with 4 tests covering `getPortfolio` (200/404) and `getPortfolioHistory` (200/404). All mocks for `db`, `market-cache.service`, `shared-utils`.

### Completion Notes
- 102/102 tests passing (4 new tests added)
- `AreaChart` and `Area` added to existing recharts import (no new dependencies)
- Dollar convention followed: `STARTING_CAPITAL = 100000`
- Migration `013_portfolio_history_unique.sql` created to enable `ON CONFLICT DO NOTHING` in snapshot job

## File List
- `apps/api/src/jobs/index.ts` — modified (snapshot job added)
- `apps/web/app/(dashboard)/portfolio/page.tsx` — modified (P&L card, history chart, recharts imports)
- `apps/api/src/controllers/portfolio.controller.test.ts` — created
- `apps/api/src/db/migrations/013_portfolio_history_unique.sql` — created

## Change Log
- 2026-03-26: T1.11 implemented — snapshot cron job, P&L dashboard card, portfolio history AreaChart, portfolio controller tests (4 new tests, 102 total)
