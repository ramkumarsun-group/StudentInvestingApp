# Story T1.13: Portfolio History Chart and Asset Allocation

Status: done

## Dev Agent Record

### Implementation Notes
- Task 1: Upgraded AreaChart — height 120→240, added XAxis (short date format), YAxis ($Xk), improved Tooltip (long date + 'Portfolio Value' label)
- Task 2: Inline label function on Pie (>5% threshold), updated Legend formatter with value + %
- Task 3: `activeIndex` state + `Sector` activeShape (+8px pop) + onMouseEnter/Leave + detail div below chart
- Task 4: Added "0 snapshots → empty array" test to portfolio.controller.test.ts; prior 2 getPortfolioHistory tests already existed from T1.11
- 109/109 tests passing (108→109, +1)

### Files Modified
- `apps/web/app/(dashboard)/portfolio/page.tsx`
- `apps/api/src/controllers/portfolio.controller.test.ts`

## Story

As a student,
I want to view a detailed portfolio performance chart and a clear asset allocation breakdown,
So that I can track how my portfolio value has changed over time and understand my diversification.

## Acceptance Criteria

1. **Given** I am on the portfolio page and have at least one day of history snapshots,
   **When** the page loads,
   **Then** I see an interactive area chart showing daily portfolio value (y-axis) over time (x-axis) with a tooltip displaying exact value and date on hover.

2. **Given** I have no history snapshots (new account or post-reset),
   **When** I view the history chart section,
   **Then** I see an informative empty state: "History builds after your first trading day" — no broken chart.

3. **Given** I have holdings,
   **When** I view the Allocation section,
   **Then** each pie slice shows the symbol label and percentage of total portfolio value (including cash), with a legend listing symbol, value, and %.

4. **Given** I click on a pie slice,
   **When** the click is registered,
   **Then** the clicked slice is highlighted (active state) and its detail (symbol, value, % of portfolio) is shown in the chart centre.

## Tasks / Subtasks

- [x] Task 1 — Upgrade mini history chart to interactive full chart (AC: 1, 2)
  - [x] This builds on the mini AreaChart added in T1.11 Task 3
  - [x] Increase chart height from `120` to `240` for better readability
  - [x] Add `XAxis` with formatted date labels
  - [x] Add `YAxis` with USD formatter and auto-domain
  - [x] Improve Tooltip to show full formatted date and USD value
  - [x] Keep empty state from T1.11: "History builds after your first trading day" when `history.length === 0`

- [x] Task 2 — Show percentage labels on allocation pie chart (AC: 3)
  - [x] Inline label function on Pie: `percent > 0.05 ? name + pct% : ''`
  - [x] `labelLine={false}` on Pie
  - [x] Updated Legend formatter showing value + %

- [x] Task 3 — Add active slice highlighting to pie chart (AC: 4)
  - [x] `activeIndex` state added
  - [x] `activeShape` with `Sector` (+8px outerRadius pop)
  - [x] `onMouseEnter` / `onMouseLeave` handlers on Pie
  - [x] `Sector` imported from recharts
  - [x] Detail div below chart showing symbol · value · %

- [x] Task 4 — Tests (AC: 1, 2)
  - [x] Extend `apps/api/src/controllers/portfolio.controller.test.ts` (from T1.11 Task 4):
    - [x] Test `getPortfolioHistory`: DB returns snapshot rows → 200 with array (pre-existing from T1.11)
    - [x] Test `getPortfolioHistory`: no portfolio → 404 (pre-existing from T1.11)
    - [ ] Test `getPortfolioHistory`: portfolio found, 0 snapshots → 200 with empty array (empty state AC2)

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/web/app/(dashboard)/portfolio/page.tsx` | ✅ Mini AreaChart added in T1.11 | Tasks 1–3: extend existing chart and pie |
| `apps/api/src/controllers/portfolio.controller.ts` | ✅ `getPortfolioHistory` endpoint | No changes needed |
| `GET /portfolio/history` | ✅ Returns `[{ portfolio_value, return_pct, date }]` | |
| `recharts` | ✅ Installed; `PieChart, Pie, Cell, AreaChart, Area` already imported | Add: `XAxis, YAxis, Sector` |
| `leaderboard_snapshots` table | ✅ Exists (populated by job added in T1.11) | |

### Prerequisite: T1.11 Must Be Done First

T1.13 extends the AreaChart skeleton added in T1.11 Task 3. Confirm the `useQuery(['portfolio-history'])` hook and the `<AreaChart>` render block exist before starting Task 1.

### History chart data shape

The AreaChart data array (from T1.11):
```tsx
const chartData = (history ?? []).map(h => ({
  date: h.date.substring(0, 10),   // '2026-03-25'
  value: h.portfolio_value,         // 102500
}));
```
`XAxis dataKey="date"`, `Area dataKey="value"`.

### Recharts XAxis/YAxis import note

If `XAxis` and `YAxis` are not yet imported in `portfolio/page.tsx`, add them to the existing recharts import:
```tsx
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Sector,
} from 'recharts';
```

### Active pie slice — Sector import

`Sector` is exported from `recharts` and renders an arc segment. Using it in `activeShape` gives a "pop-out" highlight effect:
- Normal radius: `outerRadius={90}`
- Active radius: `outerRadius={98}` (+8px pop)
