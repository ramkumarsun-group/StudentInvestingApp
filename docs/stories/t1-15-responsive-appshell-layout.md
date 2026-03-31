# Story T1.15: Responsive AppShell Layout

Status: done

## Story

As a student,
I want the app navigation to adapt seamlessly between mobile and desktop,
So that I have a bottom tab bar on my phone and a left sidebar on my computer without any manual switching.

## Acceptance Criteria

1. **Given** I am on any authenticated page on a viewport narrower than 1024px (`<lg`),
   **When** the page renders,
   **Then** I see a fixed bottom tab bar with icons and labels for: Dashboard, Trade, Learn, Leaderboard, and Profile. No sidebar is visible.

2. **Given** I am on any authenticated page on a viewport 1024px or wider (`lg+`),
   **When** the page renders,
   **Then** I see a fixed left sidebar (220px wide) with the StockPlay logo, nav links (Dashboard, Trade, Learn, Leaderboard, Profile), and a bottom user menu. No bottom tab bar is visible.

3. **Given** I resize the browser window across the 1024px breakpoint,
   **When** the transition occurs,
   **Then** the layout switches between sidebar and bottom tab bar with no layout shift, flicker, or JS errors.

4. **Given** I navigate between pages using the sidebar or bottom tab bar,
   **When** a link is active,
   **Then** the active nav item is visually highlighted using the `primary` design token (`#acc7ff`).

5. **Given** the app is rendered server-side,
   **When** the HTML is hydrated,
   **Then** there is no hydration mismatch — both nav components are rendered but CSS-controlled visibility determines which is shown (no conditional JS rendering based on `window.innerWidth`).

## Tasks / Subtasks

- [x] Task 1 — Create `AppShell` layout component (AC: 1, 2, 3, 5)
  - [x] Create `apps/web/components/layouts/AppShell.tsx`
  - [x] Component accepts `children: React.ReactNode` prop
  - [x] Render both `<Sidebar>` and `<BottomNav>` in the DOM at all times (SSR-safe)
  - [x] Use Tailwind to hide/show: `<Sidebar className="hidden lg:flex ...">` and `<BottomNav className="flex lg:hidden ...">`
  - [x] Main content area: `<main className="lg:ml-[220px] pb-16 lg:pb-0">` (accounts for bottom nav height on mobile)

- [x] Task 2 — Create `Sidebar` component (AC: 2, 4)
  - [x] Create `apps/web/components/layouts/Sidebar.tsx`
  - [x] Fixed left sidebar: `fixed left-0 top-0 h-full w-[220px] flex flex-col bg-[#1e2022] border-r border-[#2e3035] z-40`
  - [x] Logo section at top: StockPlay wordmark or icon
  - [x] Nav links (Dashboard `/dashboard`, Trade `/trade`, Learn `/learn`, Leaderboard `/leaderboard`, Profile `/profile`)
  - [x] Use Next.js `usePathname()` to determine active link; active state: `text-[#acc7ff] bg-[#acc7ff]/10 rounded-lg`
  - [x] User menu/avatar section pinned to bottom of sidebar
  - [x] Each nav item: icon (Lucide) + label, full-width clickable area

- [x] Task 3 — Create `BottomNav` component (AC: 1, 4)
  - [x] Create `apps/web/components/layouts/BottomNav.tsx`
  - [x] Fixed bottom bar: `fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around bg-[#1e2022] border-t border-[#2e3035] z-40`
  - [x] 5 nav items: Dashboard, Trade, Learn, Leaderboard, Profile — icon + small label
  - [x] Active state: `text-[#acc7ff]`; inactive: `text-[#8b909f]`
  - [x] Use Next.js `usePathname()` for active detection

- [x] Task 4 — Wire `AppShell` into authenticated layout (AC: 1, 2)
  - [x] Wrap `apps/web/app/(dashboard)/layout.tsx` with `<AppShell>`
  - [x] Remove any existing nav/layout markup in `(dashboard)/layout.tsx` that duplicates AppShell responsibility
  - [x] Confirm all existing T1 pages (`/dashboard`, `/trade`, `/portfolio`) render inside AppShell without layout regressions

- [x] Task 5 — Tests (AC: 1, 2, 4, 5)
  - [x] `AppShell.test.tsx` — renders children, renders both Sidebar and BottomNav in DOM
  - [x] `Sidebar.test.tsx` — active link highlighted when pathname matches, all 5 nav links present
  - [x] `BottomNav.test.tsx` — active link highlighted when pathname matches, all 5 nav items present

## Dev Notes

### Stitch Design References

| Screen | Stitch ID | Device | Notes |
|---|---|---|---|
| StockPlay Dashboard - Desktop | `5ca7025a8d20489b96403837b8bb70a2` | DESKTOP 2560px | Shows sidebar structure, nav item styling |
| StockPlay Onboarding - Desktop | `7db7eb8490a943e99ec07c36c2c44e9c` | DESKTOP 2560px | Shows sidebar in unauthenticated context |
| Dashboard & Path | `e546d615793e4e4c8f9ec5860d5b0fc3` | MOBILE 780px | Shows bottom tab bar layout |

All Stitch screens accessible via project `914389739818317223`.

### Design Tokens (from Editorial Intelligence / Scholar Pulse)

```typescript
// Sidebar / BottomNav background
bg-[#1e2022]           // surface-container token

// Border
border-[#2e3035]       // outline-variant token

// Active nav item
text-[#acc7ff]         // primary token
bg-[#acc7ff]/10        // primary at 10% opacity

// Inactive nav item
text-[#8b909f]         // outline token

// Base background
bg-[#121416]           // surface token
```

### AppShell Structure

```tsx
// apps/web/components/layouts/AppShell.tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#121416]">
      {/* Sidebar — visible lg+ only */}
      <Sidebar className="hidden lg:flex" />

      {/* Main content — offset by sidebar on lg+ */}
      <main className="lg:ml-[220px] pb-16 lg:pb-0 min-h-screen">
        {children}
      </main>

      {/* Bottom nav — visible <lg only */}
      <BottomNav className="flex lg:hidden" />
    </div>
  );
}
```

### SSR Safety

Do **not** use `useEffect` + `useState` with `window.innerWidth` to switch components. Both nav components must be in the initial HTML. CSS Tailwind responsive classes handle visibility. This avoids hydration mismatch and layout flash.

### Nav Items

```typescript
const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/trade',        label: 'Trade',        icon: TrendingUp },
  { href: '/learn',        label: 'Learn',        icon: BookOpen },
  { href: '/leaderboard',  label: 'Leaderboard',  icon: Trophy },
  { href: '/profile',      label: 'Profile',      icon: User },
] as const;
```

Use Lucide React icons (already in project from T1 stories).

### Existing Layout Files to Check Before Starting

| File | Expected State | Action |
|---|---|---|
| `apps/web/app/(dashboard)/layout.tsx` | Has some nav scaffold | Replace with `<AppShell>` wrapper |
| `apps/web/components/` | May have partial nav components | Consolidate into AppShell pattern |

### Scope Boundaries — DO NOT Implement

- Desktop Onboarding layout (registration/login pages for `lg+`) → T1.16
- Desktop Dashboard content layout (column grid for wider viewports) → T1.17
- Mobile-specific screen content changes → already done in T1.1–T1.14
- Notification bell / user avatar popover in sidebar → T2/T3

### References

- [Source: docs/architecture.md#UI/UX Design Context Update — Desktop Layout Architecture]
- [Source: docs/prd.md#Desktop Screen Inventory]
- [Source: docs/architecture.md#Implementation Patterns — Naming Conventions]
- Stitch project: `914389739818317223`

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Implementation Plan
- Task 1: Created `apps/web/components/layouts/AppShell.tsx` — SSR-safe wrapper; renders both `<Sidebar className="hidden lg:flex">` and `<BottomNav className="flex lg:hidden">` always in DOM; `<main className="lg:ml-[220px] pb-16 lg:pb-0 min-h-screen">` for content offset.
- Task 2: Created `apps/web/components/layouts/Sidebar.tsx` — fixed 220px left sidebar using design tokens (`#1e2022`, `#2e3035`, `#acc7ff`); 5 nav items (Dashboard/Trade/Learn/Leaderboard/Profile) with Lucide icons; `usePathname()` active detection; StockPlay logo with "SP" initials; bottom user section with avatar initial + sign-out button reusing T1.3's `handleSignOut` pattern (`POST /api/logout` then `signOut`).
- Task 3: Created `apps/web/components/layouts/BottomNav.tsx` — fixed bottom bar `h-16 z-40`; same 5 nav items; `usePathname()` active detection; active=`text-[#acc7ff]`, inactive=`text-[#8b909f]`.
- Task 4: Updated `apps/web/app/(dashboard)/layout.tsx` — replaced old `<Sidebar>` + `<div>` wrapper with `<AppShell>`. Kept `<TopBar>` as first child of AppShell to preserve XP/streak display and session error auto-signout (T1.3 AC). Old `components/layout/Sidebar.tsx` left in place (not deleted) — no longer imported by layout.
- Task 5: Created 3 test files using `renderToStaticMarkup` + `vi.mock` for `next/navigation`, `next-auth/react`, `next/link`. Fixed vitest.config.ts to add `resolve.alias: { '@': path.resolve(__dirname, '.') }` to resolve `@/lib/utils` path alias (was missing from existing config).

### Completion Notes
- 22/22 web tests pass (19 new: 5 AppShell + 8 Sidebar + 6 BottomNav; 3 pre-existing DPA)
- 118/118 API tests pass — zero regressions
- `vitest.config.ts` updated with path alias — this also fixes the pre-existing DPA tests (they didn't need it but now the config is correct for all future web tests)
- SSR safety: both Sidebar and BottomNav always in DOM; visibility controlled by Tailwind `hidden lg:flex` / `flex lg:hidden` — no `window.innerWidth` JS switching (AC5)
- Old `components/layout/Sidebar.tsx` is now orphaned (not imported anywhere) — left for cleanup in a future story or code review

## File List
- `apps/web/components/layouts/AppShell.tsx` — created
- `apps/web/components/layouts/Sidebar.tsx` — created
- `apps/web/components/layouts/BottomNav.tsx` — created
- `apps/web/components/layouts/AppShell.test.tsx` — created (5 tests)
- `apps/web/components/layouts/Sidebar.test.tsx` — created (8 tests)
- `apps/web/components/layouts/BottomNav.test.tsx` — created (6 tests)
- `apps/web/app/(dashboard)/layout.tsx` — modified (AppShell replaces Sidebar+wrapper)
- `apps/web/vitest.config.ts` — modified (added path alias resolve)
- `docs/stories/t1-15-responsive-appshell-layout.md` — updated (task checkboxes, dev record, status → review)
- `docs/stories/sprint-status.yaml` — updated (t1-15 → review)

## Change Log
- 2026-03-30: T1.15 implemented — AppShell, Sidebar, BottomNav components; (dashboard)/layout.tsx wired; vitest path alias fix; 19 new tests (140 total passing) (claude-sonnet-4-6)
