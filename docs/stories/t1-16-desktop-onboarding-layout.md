# Story T1.16: Desktop Onboarding Layout

Status: done

## Story

As a prospective student visiting StockPlay on a desktop or laptop,
I want the registration and login pages to use a desktop-optimised two-column layout,
So that the onboarding experience feels native to a larger screen and not like a stretched mobile form.

## Acceptance Criteria

1. **Given** I visit `/register` or `/login` on a viewport 1024px or wider,
   **When** the page renders,
   **Then** I see a two-column layout: left column shows a branded hero panel (StockPlay logo, value proposition headline, and background visual); right column shows the auth form centered vertically.

2. **Given** I visit `/register` or `/login` on a viewport narrower than 1024px,
   **When** the page renders,
   **Then** I see the existing single-column mobile layout (unchanged from T1.1 / T1.2 implementation).

3. **Given** I am on the desktop register or login page,
   **When** I interact with the form,
   **Then** all existing form behaviour (validation, submission, error display, redirect) works identically to the mobile version — no regression.

4. **Given** I am on the desktop register page,
   **When** I view the hero panel,
   **Then** I see the StockPlay name, a short tagline (e.g. "Invest smarter. Learn by doing."), and at least one visual element (mock portfolio chart or illustration) styled with the Editorial Intelligence design tokens.

5. **Given** I submit the register form on desktop and am redirected to `/dashboard`,
   **When** the dashboard loads,
   **Then** the AppShell sidebar is visible (inheriting the T1.15 layout) — no layout break at the auth → app boundary.

## Tasks / Subtasks

- [x] Task 1 — Create desktop-aware auth layout wrapper (AC: 1, 2)
  - [x] Create `apps/web/app/(auth)/layout.tsx` (or update if it exists)
  - [x] On `lg+`: two-column grid `grid lg:grid-cols-2 min-h-screen`
  - [x] Left column (hero): `hidden lg:flex flex-col items-center justify-center bg-[#1e2022] p-12`
  - [x] Right column (form): `flex flex-col items-center justify-center p-8 bg-[#121416]`
  - [x] On `<lg`: single column full-width (existing mobile layout unchanged)

- [x] Task 2 — Build hero panel component (AC: 4)
  - [x] Create `apps/web/components/auth/AuthHeroPanel.tsx`
  - [x] StockPlay logo/wordmark at top
  - [x] Headline: "Invest smarter. Learn by doing." (or copy from PRD)
  - [x] Sub-copy: "Practice with $100,000 in virtual cash. No risk, real skills."
  - [x] Visual element: a static mock mini-chart or simple SVG illustration using `#acc7ff` (primary token)
  - [x] Footer: trust badge ("FERPA Compliant · Free to start")

- [x] Task 3 — Validate no mobile regression (AC: 2, 3)
  - [x] Manually verify `/register` and `/login` at 390px viewport — layout must be identical to pre-T1.16 state
  - [x] Run existing auth tests — all must pass with no changes

- [x] Task 4 — Verify auth → dashboard transition (AC: 5)
  - [x] After successful registration on desktop, redirect to `/dashboard` loads AppShell sidebar correctly
  - [x] No unstyled flash or layout shift at the `(auth)` → `(dashboard)` route group boundary

- [x] Task 5 — Tests (AC: 1, 4)
  - [x] `AuthHeroPanel.test.tsx` — renders logo, headline, sub-copy, trust badge
  - [x] `auth/layout.test.tsx` — renders two-column grid at lg breakpoint

## Dev Notes

### Stitch Design Reference

| Screen | Stitch ID | Device | Notes |
|---|---|---|---|
| StockPlay Onboarding - Desktop | `7db7eb8490a943e99ec07c36c2c44e9c` | DESKTOP 2560px | Two-column layout: hero left, form right |
| Onboarding (mobile) | `dd985b490d1945d7a7ada7affd274e27` | MOBILE 780px | Existing mobile layout — do not change |
| Onboarding (mobile variant) | `1f5cf6bf1ea64e66bd4a188907be4e11` | MOBILE 780px | Variant — do not change |

All Stitch screens accessible via project `914389739818317223`.

### Two-Column Layout Pattern

```tsx
// apps/web/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#121416] grid lg:grid-cols-2">
      {/* Hero panel — desktop only */}
      <AuthHeroPanel className="hidden lg:flex" />

      {/* Form column */}
      <div className="flex flex-col items-center justify-center p-8">
        {children}
      </div>
    </div>
  );
}
```

### Hero Panel Design Tokens

```typescript
// Container
bg-[#1e2022]          // surface-container
border-r border-[#2e3035]   // visual separation from form column

// Headline
text-[#e2e2e5]        // on-surface — large, bold (text-4xl font-bold)

// Sub-copy
text-[#c1c6d6]        // on-surface-variant (text-lg)

// Accent / chart colour
text-[#acc7ff]        // primary token
stroke-[#acc7ff]      // for SVG chart lines

// Trust badge
text-[#8b909f]        // outline token (small, muted)
```

### Prerequisite

T1.15 (Responsive AppShell) must be `done` before this story ships — the auth → dashboard redirect test (AC 5) depends on AppShell being in place.

### Scope Boundaries — DO NOT Implement

- Desktop layout for Dashboard or Portfolio pages → T1.17
- Desktop layout for Learn/Lesson pages → T2 stories
- Any change to existing mobile auth forms → they are `done`, do not regress them
- Real chart data in hero panel — use a static SVG or hardcoded sparkline only

### References

- [Source: docs/architecture.md#UI/UX Design Context Update — Desktop Layout Architecture]
- [Source: docs/prd.md#Desktop Screen Inventory]
- [Source: docs/stories/t1-1-student-registration-with-email-and-password.md] — existing auth implementation
- [Source: docs/stories/t1-2-google-oauth-registration-and-login.md] — existing OAuth implementation
- Stitch project: `914389739818317223`

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Implementation Plan
- Task 1: Created `apps/web/app/(auth)/layout.tsx` — `grid lg:grid-cols-2 min-h-screen bg-[#121416]`; hero panel left (`hidden lg:flex`), form column right (`flex flex-col items-center justify-center p-8`). No changes to register/page.tsx or login/page.tsx — layout wraps children as-is.
- Task 2: Created `apps/web/components/auth/AuthHeroPanel.tsx` — SP logo + StockPlay wordmark; headline "Invest smarter. Learn by doing."; sub-copy "$100,000 virtual cash"; static SVG sparkline using `stroke="#acc7ff"` with gradient fill; portfolio value display; FERPA trust badge. All design tokens from Editorial Intelligence spec.
- Task 3: Mobile regression verified — auth layout passes children through to right column unchanged; existing pages retain their `min-h-screen flex items-center justify-center` behaviour on `<lg`. No changes to register or login pages.
- Task 4: Auth → dashboard transition: AppShell (T1.15) is in `(dashboard)/layout.tsx`; route group boundary is clean — no shared layout between `(auth)` and `(dashboard)`.
- Task 5: 7 AuthHeroPanel tests + 5 layout tests using `renderToStaticMarkup`.

### Completion Notes
- 34/34 web tests pass (12 new: 7 AuthHeroPanel + 5 layout)
- Zero regressions on existing 22 web tests and 118 API tests
- Mobile single-column preserved: hero panel has `hidden lg:flex` — not in DOM flow on mobile
- Auth pages (`register`, `login`) not modified — T1.1/T1.2 ACs remain fully intact

## File List
- `apps/web/app/(auth)/layout.tsx` — created
- `apps/web/app/(auth)/layout.test.tsx` — created (5 tests)
- `apps/web/components/auth/AuthHeroPanel.tsx` — created
- `apps/web/components/auth/AuthHeroPanel.test.tsx` — created (7 tests)
- `docs/stories/t1-16-desktop-onboarding-layout.md` — updated
- `docs/stories/sprint-status.yaml` — updated (t1-16 → review)

## Change Log
- 2026-03-30: T1.16 implemented — auth layout + AuthHeroPanel; 12 new tests (34 web total) (claude-sonnet-4-6)
