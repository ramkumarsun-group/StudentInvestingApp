# Story T1.5: FERPA Compliance — DPA and No Third-Party Trackers

Status: review

## Story

As a school administrator,
I want to confirm FERPA compliance before enrolling students,
so that I can meet our school's data governance requirements.

## Acceptance Criteria

1. **Given** I am on the school sign-up or teacher registration page,
   **When** I look for legal documentation,
   **Then** a link to the current Data Processing Agreement is visible before I submit any form.

2. **Given** any page in the application loads,
   **When** the browser network activity is inspected,
   **Then** no requests are made to Google Analytics, Meta Pixel, or any third-party advertising domain.

3. **Given** the application sends analytics events,
   **When** those events are processed,
   **Then** they go to a first-party endpoint only, with no PII included.

## Tasks / Subtasks

- [x] Task 1 — Create static DPA page (AC: 1)
  - [x] Create `apps/web/app/legal/dpa/page.tsx` — static Server Component rendering the Data Processing Agreement
  - [x] Page must be publicly accessible (no auth required) at route `/legal/dpa`
  - [x] Include: effective date, school data categories covered, retention period (30 days post-deletion), FERPA basis, contact email (`privacy@studentinvest.app`)

- [x] Task 2 — Add DPA link to registration page (AC: 1)
  - [x] In `apps/web/app/(auth)/register/page.tsx`: add DPA link above the submit button so it is visible before form submission
  - [x] Link text: "Data Processing Agreement" — opens `/legal/dpa` in a new tab
  - [x] Must be present regardless of selected role (student OR teacher) since both paths exist on this page

- [x] Task 3 — Add CSP headers to Next.js config (AC: 2)
  - [x] In `apps/web/next.config.js`: add `async headers()` function returning `Content-Security-Policy` header for `source: '/**'`
  - [x] CSP directive must include `default-src 'self'` and explicitly block known tracking domains via `connect-src 'self'` (no wildcard external)
  - [x] `script-src` must NOT include `https://www.googletagmanager.com`, `https://www.google-analytics.com`, `https://connect.facebook.net`, `https://cdn.amplitude.com`, `https://cdn.mixpanel.com`
  - [x] `img-src 'self' data: https://api.dicebear.com https://images.unsplash.com` (match existing `images.domains` in next.config.js)
  - [x] `font-src 'self' https://fonts.gstatic.com` (Next.js Google Fonts via `next/font` uses local serving — include as fallback)
  - [x] `frame-ancestors 'none'` (clickjacking protection)
  - [x] `connect-src 'self'` — first-party only; API calls go through `/api/backend/*` rewrite (already configured)

- [x] Task 4 — First-party analytics stub endpoint (AC: 3)
  - [x] Create `apps/api/src/controllers/analytics.controller.ts`
  - [x] `POST /api/v1/analytics/event` — unauthenticated (public endpoint, no JWT required)
  - [x] Zod schema: `{ event: z.string().min(1).max(100), properties: z.record(z.string(), z.string()).optional() }`
  - [x] PII guard: reject (400 `ANALYTICS_PII_REJECTED`) if any property key matches `/^(email|user_?id|name|username|phone|ip)$/i`
  - [x] On valid input: log via `logger.info('analytics_event', { event, properties })` — Pino is on FERPA allowlist
  - [x] Return `204 No Content` on success
  - [x] Register route in `apps/api/src/routes/index.ts`: `router.post('/analytics/event', analytics.trackEvent)` — no auth middleware
  - [x] Write tests: `apps/api/src/controllers/analytics.controller.test.ts`

- [x] Task 5 — Write tests (AC: 1, 2, 3)
  - [x] `apps/api/src/controllers/analytics.controller.test.ts` — co-located test file (new)
    - [x] Valid event → 204, logger.info called with event + properties
    - [x] Missing event field → 400 `VALIDATION_ERROR`
    - [x] PII key `email` in properties → 400 `ANALYTICS_PII_REJECTED`
    - [x] PII key `userId` in properties → 400 `ANALYTICS_PII_REJECTED`
    - [x] PII key `name` in properties → 400 `ANALYTICS_PII_REJECTED`
    - [x] Non-PII properties → 204, passes through
  - [x] `apps/web/app/legal/dpa/page.test.tsx` — render test (new)
    - [x] Page renders without crashing
    - [x] Contains "Data Processing Agreement" heading
    - [x] Contains "FERPA" text
  - [x] All existing 27 tests in `auth.controller.test.ts` must continue passing (no regressions)

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Action needed |
|------|--------|---------------|
| `apps/api/src/index.ts` | ✅ `helmet()` applied at line 18 — adds `X-Frame-Options`, `X-Content-Type-Options`, etc. | No changes — CSP is Next.js side |
| `apps/web/next.config.js` | ✅ `withPWA`, `transpilePackages`, `images.domains`, `rewrites()` | Add `headers()` only — do NOT touch existing config |
| `apps/web/app/layout.tsx` | ✅ No `<Script>` tags for analytics — already clean | No changes needed |
| `apps/web/app/(auth)/register/page.tsx` | ✅ Role selection (student/teacher) already in form | Task 2: add DPA link above submit button only |
| `apps/api/src/config/logger.ts` | ✅ Pino logger singleton — `logger.info()` | Import and use; do NOT reinitialise |
| `apps/api/src/routes/index.ts` | ✅ Exists — add 1 route only | DO NOT modify existing routes |

### FERPA SDK Allowlist (from architecture.md)

Blocked (must NOT be added or referenced):
- `Vercel Analytics` ⛔
- `Google Analytics` ⛔
- `Sentry cloud` 🔄 (deferred — use GlitchTip self-hosted for pilot)

Approved:
- `Pino` ✅ — use for first-party analytics logging (Task 4)

> **Rule:** Check this allowlist before adding any new dependency. T1.5 adds zero new third-party dependencies.

### CSP Header Pattern for `next.config.js`

```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js requires unsafe-eval in dev; tighten in prod later
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://api.dicebear.com https://images.unsplash.com",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
      ],
    },
  ];
},
```

> **Critical:** Place `headers()` BEFORE the `withPWA` wrap in `next.config.js`. The PWA wrapper must receive the full config including headers.

> **Note:** `'unsafe-inline'` and `'unsafe-eval'` on `script-src` are required by Next.js 14 in development. Phase 3 hardening task should add nonce-based CSP. Do NOT attempt nonce-based CSP in T1.5 — scope creep.

### Analytics Controller Pattern

```typescript
// apps/api/src/controllers/analytics.controller.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger';

const PII_KEYS = /^(email|user_?id|name|username|phone|ip)$/i;

const trackEventSchema = z.object({
  event: z.string().min(1).max(100),
  properties: z.record(z.string(), z.string()).optional(),
});

export async function trackEvent(req: Request, res: Response) {
  const body = trackEventSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid analytics payload.' } });
  }

  const { event, properties } = body.data;

  if (properties) {
    const piiKey = Object.keys(properties).find(k => PII_KEYS.test(k));
    if (piiKey) {
      return res.status(400).json({ error: { code: 'ANALYTICS_PII_REJECTED', message: `Property '${piiKey}' may contain PII and is not allowed.` } });
    }
  }

  logger.info('analytics_event', { event, properties: properties ?? {} });
  return res.status(204).send();
}
```

### DPA Page Structure

`apps/web/app/legal/dpa/page.tsx` — Server Component (no `'use client'`):

```tsx
export default function DpaPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-white">
      <h1 className="text-3xl font-bold mb-6">Data Processing Agreement</h1>
      {/* Effective date, parties, data categories, retention, FERPA basis, contact */}
    </main>
  );
}
```

No auth wrapper, no `SessionProvider` dependency — it must render publicly without JavaScript hydration issues.

### DPA Link in Register Page

Add immediately above the submit button (inside the `<form>`), visible for both student and teacher roles:

```tsx
<p className="text-xs text-slate-400 text-center">
  By registering, you agree to our{' '}
  <Link href="/legal/dpa" target="_blank" className="underline text-green-400">
    Data Processing Agreement
  </Link>
  .
</p>
```

Import `Link` from `'next/link'` — already used in the file.

### Test File Setup for `analytics.controller.test.ts`

Follow exact pattern from `auth.controller.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
// mock logger before importing controller
vi.mock('../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));
import { trackEvent } from './analytics.controller';
import { logger } from '../config/logger';
```

Mock `res` object:
```typescript
const mockRes = {
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
} as unknown as Response;
```

### Scope Boundaries — DO NOT Implement

- Nonce-based or hash-based CSP → Phase 3 security hardening
- GlitchTip self-hosted setup → infrastructure task, not in this story
- Analytics dashboard or aggregation → out of scope entirely
- DPA for school admin onboarding wizard → Phase 2 (T3)
- Cookie consent banner → not required (no cookies set by third-party trackers)
- Vercel/CDN-level header configuration → deferred (no CDN in Phase 1)

### Project Structure Notes

- New files follow existing conventions:
  - `analytics.controller.ts` → `apps/api/src/controllers/` (kebab-case)
  - `analytics.controller.test.ts` → co-located in same directory
  - `dpa/page.tsx` → `apps/web/app/legal/dpa/page.tsx` (Next.js App Router convention)
  - `dpa/page.test.tsx` → co-located in `apps/web/app/legal/dpa/`
- No new packages/dependencies required for any task in this story

### References

- [Source: docs/architecture.md#FERPA SDK Allowlist] — blocked/approved SDK list
- [Source: docs/architecture.md#Technical Constraints] — NFR3: Zero PII in third-party analytics
- [Source: apps/api/src/index.ts:18] — `helmet()` already applied; CSP lives in Next.js headers
- [Source: apps/web/next.config.js] — existing config structure to extend
- [Source: apps/web/app/layout.tsx] — no analytics scripts; clean baseline
- [Source: apps/web/app/(auth)/register/page.tsx] — add DPA link above submit button
- [Source: apps/api/src/config/logger.ts] — Pino singleton for first-party event logging
- [Source: apps/api/src/controllers/auth.controller.ts] — error envelope pattern to follow
- [Source: docs/stories/t1-4-age-verification-and-under-18-account-flagging.md] — test mock patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `apps/web/app/legal/dpa/page.tsx` — static Server Component with effective date, 7 sections covering parties, data categories, 30-day retention post-deletion, FERPA basis, sub-processors, security, and contact email `privacy@studentinvest.app`.
- Added DPA link above submit button in `apps/web/app/(auth)/register/page.tsx` — visible for both student and teacher roles. Uses `next/link` (already imported).
- Added `async headers()` in `apps/web/next.config.js` before `withPWA` wrap — CSP with `default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`. No tracking domains included in any directive.
- Created `apps/api/src/controllers/analytics.controller.ts` — PII guard regex, Zod validation, 204 on success, 400 on VALIDATION_ERROR or ANALYTICS_PII_REJECTED. Uses existing Pino logger.
- Registered `router.post('/analytics/event', analytics.trackEvent)` in `apps/api/src/routes/index.ts` — no auth middleware, placed before auth routes.
- Created `apps/api/src/controllers/analytics.controller.test.ts` — 6 tests all passing.
- Created `apps/web/app/legal/dpa/page.test.tsx` — 3 render tests using `renderToStaticMarkup` from `react-dom/server`. Added `vitest` to web devDependencies and `vitest.config.ts` with `jsx: 'automatic'` esbuild transform to support JSX without `@vitejs/plugin-react`.
- **Note on web test setup:** Web package had no test infrastructure. Added `vitest ^1.6.0` as devDependency (already used in API), a `test` script, and `vitest.config.ts`. This is the only new package added; no FERPA-prohibited dependencies were added.
- Total: 40 API tests + 3 web tests = 43 tests passing, no regressions.

### File List

- `apps/web/app/legal/dpa/page.tsx` — created (static DPA page)
- `apps/web/app/legal/dpa/page.test.tsx` — created (3 render tests)
- `apps/web/app/(auth)/register/page.tsx` — modified (DPA link above submit button)
- `apps/web/next.config.js` — modified (CSP headers via `async headers()`)
- `apps/web/package.json` — modified (added vitest devDependency + test script)
- `apps/web/vitest.config.ts` — created (vitest config with esbuild jsx:automatic)
- `apps/api/src/controllers/analytics.controller.ts` — created
- `apps/api/src/controllers/analytics.controller.test.ts` — created (6 tests)
- `apps/api/src/routes/index.ts` — modified (1 new analytics route, no auth)
- `docs/stories/t1-5-ferpa-compliance-dpa-and-no-third-party-trackers.md` — this file
- `docs/stories/sprint-status.yaml` — updated (t1-5 → review)
