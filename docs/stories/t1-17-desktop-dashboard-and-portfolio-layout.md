# Story T1.17: Desktop Dashboard & Portfolio Layout

Status: done

## Story

As a student using StockPlay on a desktop or laptop,
I want the Dashboard and Portfolio pages to use a multi-column desktop layout,
So that I can see more information at once and the pages don't feel like a stretched mobile view.

## Acceptance Criteria

1. **Given** I am on `/dashboard` on a viewport 1024px or wider,
   **When** the page renders,
   **Then** the content uses a two or three-column grid: portfolio summary + chart on the left/centre, market movers / news feed on the right. The AppShell sidebar is present (from T1.15).

2. **Given** I am on `/portfolio` on a viewport 1024px or wider,
   **When** the page renders,
   **Then** the content uses a two-column grid: portfolio value summary + history chart on the left, holdings list + allocation chart on the right.

3. **Given** I am on either page on a viewport narrower than 1024px,
   **When** the page renders,
   **Then** the existing single-column mobile layout is unchanged — no regression from T1.11–T1.14 implementation.

4. **Given** I am on the desktop Dashboard,
   **When** data loads,
   **Then** all existing AC from T1.11 and T1.14 (portfolio value, cash, P&L, mini chart, news, trending) are still satisfied — desktop layout is additive, not a rewrite.

5. **Given** I am on the desktop Portfolio page,
   **When** data loads,
   **Then** all existing AC from T1.11–T1.13 (holdings, P&L, allocation chart, history chart) are still satisfied.

6. **Given** I resize the browser across the 1024px breakpoint while on either page,
   **When** the layout transitions,
   **Then** there is no content loss, no layout shift that breaks readability, and no JS errors.

## Tasks / Subtasks

- [x] Task 1 — Desktop grid for Dashboard page (AC: 1, 4, 6)
  - [x] Open `apps/web/app/(dashboard)/dashboard/page.tsx` (or `page.tsx` at the dashboard route)
  - [x] Wrap existing content in responsive grid: `grid lg:grid-cols-[1fr_320px] gap-6`
  - [x] Left column: portfolio summary card, mini history chart (existing components)
  - [x] Right column: trending assets panel + learning progress (existing components, reordered)
  - [x] All existing components remain — only the grid wrapper changes at `lg:` breakpoint

- [x] Task 2 — Desktop grid for Portfolio page (AC: 2, 5, 6)
  - [x] Open `apps/web/app/(dashboard)/portfolio/page.tsx`
  - [x] Wrap in: `grid lg:grid-cols-2 gap-6`
  - [x] Left column: portfolio summary stats + history AreaChart (from T1.11, T1.13)
  - [x] Right column: holdings list (T1.12) + asset allocation PieChart (T1.13)
  - [x] On `<lg`: stacked single column (existing order preserved)

- [x] Task 3 — Desktop grid for Portfolio Simulator / Trade view (AC: 1, 6)
  - [x] Open the trade/search page(s) created in T1.9/T1.10
  - [x] On `lg+`: two-column `grid lg:grid-cols-[1fr_380px]`
  - [x] Left: asset search + price chart
  - [x] Right: order entry panel (buy/sell form, portfolio cash balance)
  - [x] On `<lg`: single column stacked (existing)

- [x] Task 4 — Verify no mobile regression (AC: 3, 4, 5)
  - [x] All grid classes use `lg:` prefix — base layout is unchanged single-column stack
  - [x] 46/46 web tests pass, zero regressions

- [x] Task 5 — Tests (AC: 1, 2)
  - [x] `dashboard.desktop.test.tsx` — desktop grid renders both columns, all summary data present (6 tests)
  - [x] `portfolio.desktop.test.tsx` — desktop grid renders both columns, holdings + chart present (6 tests)

## Dev Notes

### Stitch Design References

| Screen | Stitch ID | Device | Notes |
|---|---|---|---|
| StockPlay Dashboard - Desktop | `5ca7025a8d20489b96403837b8bb70a2` | DESKTOP 2560px | Two-pane layout: summary + movers/news |
| StockPlay Portfolio - Desktop | `b78b73cd883142aca1a4ff9ac6b11aab` | DESKTOP 2560px | Two-column: stats + chart left, holdings right |
| Dashboard & Path (mobile) | `e546d615793e4e4c8f9ec5860d5b0fc3` | MOBILE 780px | Existing mobile — do not regress |
| Portfolio Simulator (mobile) | `e6766204fad345b0a644b369e5e3b351` | MOBILE 780px | Existing mobile — do not regress |

All Stitch screens accessible via project `914389739818317223`.

### Grid Patterns

```tsx
// Dashboard — main content area (inside AppShell)
<div className="p-6 grid lg:grid-cols-[1fr_320px] gap-6">
  <div className="space-y-6">
    {/* Portfolio summary + mini chart */}
  </div>
  <aside className="space-y-6">
    {/* Trending assets + news */}
  </aside>
</div>

// Portfolio page
<div className="p-6 grid lg:grid-cols-2 gap-6">
  <div className="space-y-6">
    {/* Summary stats + history chart */}
  </div>
  <div className="space-y-6">
    {/* Holdings list + allocation chart */}
  </div>
</div>

// Trade / Portfolio Simulator
<div className="p-6 grid lg:grid-cols-[1fr_380px] gap-6">
  <div>
    {/* Asset search + price chart */}
  </div>
  <div>
    {/* Order entry panel */}
  </div>
</div>
```

### Key Constraint — Additive Only

This story is **layout only** — no new data fetching, no new API calls, no new components. Every component already exists from T1.11–T1.14. The only change is wrapping existing JSX in responsive grid containers at the `lg:` breakpoint.

### Prerequisite

T1.15 (AppShell) must be `done` — desktop page layouts depend on the `lg:ml-[220px]` offset that AppShell's main content area provides.

### Breakpoint Reference

| Class | Viewport | Use |
|---|---|---|
| (base) | 0px+ | Mobile single column |
| `md:` | 768px+ | Tablet — optional intermediate |
| `lg:` | 1024px+ | Desktop grid activates |
| `xl:` | 1280px+ | Fine-tune column widths if needed |

Target implementation range: 1280–1440px. Stitch screens at 2560px are high-res references — do not try to match pixel-for-pixel.

### Scope Boundaries — DO NOT Implement

- Desktop layout for Learn/Lesson pages → T2 stories (Stitch screen `a0225fbfa9264361bac691768188f9f4`)
- New data endpoints or components — only grid layout changes
- Dark/light theme toggle — Phase 2
- Any changes to mobile layouts — they are `done`

### References

- [Source: docs/architecture.md#UI/UX Design Context Update — Desktop Layout Architecture]
- [Source: docs/prd.md#Desktop Screen Inventory]
- [Source: docs/stories/t1-11-portfolio-dashboard.md] — existing portfolio implementation
- [Source: docs/stories/t1-12-holdings-detail-and-order-history.md] — holdings implementation
- [Source: docs/stories/t1-13-portfolio-history-chart-and-asset-allocation.md] — chart implementation
- Stitch project: `914389739818317223`

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Implementation Plan
- Task 1: Restructured `dashboard/page.tsx` — replaced flat `space-y-6` stack with `grid lg:grid-cols-[1fr_320px] gap-6`; left col holds portfolio summary (md:grid-cols-3 block); right `<aside>` holds Market Movers (grid adapts to `lg:grid-cols-1 xl:grid-cols-2`) + Learning Progress.
- Task 2: Restructured `portfolio/page.tsx` — replaced flat stack + inner `lg:grid-cols-3` with outer `grid lg:grid-cols-2 gap-6`; left col holds summary cards (grid-cols-2 md:grid-cols-3) + AreaChart; right col holds holdings/orders tab card + allocation PieChart.
- Task 3: Updated `trade/page.tsx` — changed `grid grid-cols-1 lg:grid-cols-3` → `grid grid-cols-1 lg:grid-cols-[1fr_380px]`; removed `lg:col-span-2` from left div (no longer needed with named column sizes).
- Task 4: All grid classes use `lg:` prefix — base (mobile) layout is unchanged single-column stack; 46/46 tests pass.
- Task 5: Created `dashboard.desktop.test.tsx` (6 tests) and `portfolio.desktop.test.tsx` (6 tests).

### Completion Notes
- 46/46 web tests pass (12 new: 6 dashboard.desktop + 6 portfolio.desktop)
- Zero regressions on existing 34 web tests
- Layout is additive only — no new data fetching, no new components
- Mobile single-column preserved: all new grid classes behind `lg:` breakpoint

## File List
- `apps/web/app/(dashboard)/dashboard/page.tsx` — updated (desktop grid)
- `apps/web/app/(dashboard)/dashboard/dashboard.desktop.test.tsx` — created (6 tests)
- `apps/web/app/(dashboard)/portfolio/page.tsx` — updated (desktop grid)
- `apps/web/app/(dashboard)/portfolio/portfolio.desktop.test.tsx` — created (6 tests)
- `apps/web/app/(dashboard)/trade/page.tsx` — updated (grid-cols-[1fr_380px])
- `docs/stories/t1-17-desktop-dashboard-and-portfolio-layout.md` — updated
- `docs/stories/sprint-status.yaml` — updated (t1-17 → review)

## Change Log
- 2026-03-30: T1.17 implemented — desktop grids for dashboard, portfolio, trade; 12 new tests (46 web total) (claude-sonnet-4-6)
