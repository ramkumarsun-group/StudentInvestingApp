# Story T2.12: Shareable Badge Cards and In-App Notifications

**Status:** done
**Epic:** Thread 2 — Learning & Gamification Loop
**Sprint Key:** t2-12-shareable-badge-cards-and-in-app-notifications
**Date Prepared:** 2026-04-11

---

## Story

As a student,
I want to share my earned badges as styled image cards and see a notification history for achievements,
So that I can celebrate accomplishments with others and never miss an unlock event.

---

## Acceptance Criteria

**AC1 — Share button on earned badge cards**
**Given** I have at least one earned badge on `/badges`
**When** I view my earned badges
**Then** each earned badge card shows a "Share" button

**AC2 — Canvas badge card generated on share**
**Given** I click "Share" on an earned badge
**When** the image is generated
**Then** a 280×280px PNG is produced with a rarity-based gradient background, the badge emoji/icon, badge name, and "username • StockPlay" watermark

**AC3 — Native share sheet on mobile (FR41)**
**Given** `navigator.canShare({ files: [...] })` returns true (mobile browser)
**When** I click "Share"
**Then** the native share sheet opens with the generated image and text `"I earned the {name} badge on StockPlay!"`

**AC4 — Download fallback on desktop (FR41)**
**Given** `navigator.canShare` is not available or returns false (desktop browser)
**When** I click "Share"
**Then** the badge image downloads as `{slug}-badge.png`

**AC5 — Notification bell shows unread count (FR42)**
**Given** I have unread notifications (badge unlock, level-up, or streak milestone) since last dismissal
**When** I view the Sidebar (desktop `lg+`)
**Then** a bell icon with a red count badge is visible; mobile shows a red dot on the Badges link in BottomNav

**AC6 — Notification panel lists recent events**
**Given** I have at least one notification
**When** I click the bell icon
**Then** a panel opens showing the last 10 notifications with type icon, message, and relative timestamp; clicking outside dismisses it

**AC7 — Mark all read clears unread count**
**Given** I have unread notifications
**When** I click "Mark all read" in the notification panel
**Then** the unread count resets to 0 and the panel closes

**AC8 — Notifications persist across navigation**
**Given** I have notifications from this session
**When** I navigate to another page and return
**Then** the notifications are still present (persisted in `localStorage` via Zustand persist)

---

## What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/web/lib/use-badge-notifier.ts` — `createBadgeNotifier` | ✅ Complete | Pure factory with `onNewBadge(name)` callback. Extend `useBadgeNotifier` to also call `addNotification`. Do not change `createBadgeNotifier` — it's tested. |
| `apps/web/components/BadgeNotifier.tsx` | ✅ Complete | Headless component in AppShell. Keep as-is; toast fires alongside notification store update. |
| `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` | ✅ Level-up modal + streak milestone toast | Both exist in `completeMutation.onSuccess` and `quizMutation.onSuccess`. Wire `addNotification` calls here without changing existing behaviour. |
| `apps/web/app/(dashboard)/badges/page.tsx` | ✅ Badge grid with `BadgeCard` | `BadgeCard` renders earned/locked. Add share button inside the earned card. |
| `apps/web/components/layouts/Sidebar.tsx` | ✅ Desktop nav | Add `<NotificationBell />` in the `<nav>` area, below the NAV_ITEMS list. |
| `apps/web/components/layouts/BottomNav.tsx` | ✅ Mobile nav | Wrap each icon in `<div className="relative">` and add a red dot for `href === '/badges'` when `unreadCount > 0`. |
| `packages/shared-types/src/gamification.ts` — `Badge` | ✅ Has `slug` field | Use `badge.slug` for the download filename. |
| Zustand `^4.5.0` | ✅ Installed | `apps/web/package.json`. Use `create` + `persist` middleware. |

**Rarity gradients for canvas (use these exact values):**
```ts
const RARITY_GRADIENTS: Record<string, [string, string]> = {
  common:    ['#374151', '#1f2937'],
  rare:      ['#1e3a5f', '#1e40af'],
  epic:      ['#3b0764', '#6d28d9'],
  legendary: ['#78350f', '#b45309'],
};
```

**`getXp` response shape already in scope:** `session.user.name ?? session.user.email ?? 'Student'` provides the watermark username.

---

## Tasks / Subtasks

### Task 1 — Create `useNotificationStore` (AC5–AC8) [x]

**File:** `apps/web/lib/notification-store.ts` (new file)

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'badge_unlock' | 'level_up' | 'streak_milestone';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: string; // ISO string
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (type: NotificationType, message: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (type, message) =>
        set((state) => {
          const next: NotificationItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type,
            message,
            createdAt: new Date().toISOString(),
            read: false,
          };
          const updated = [next, ...state.notifications].slice(0, 50);
          return { notifications: updated, unreadCount: state.unreadCount + 1 };
        }),

      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),
    }),
    { name: 'stockplay-notifications' }
  )
);
```

---

### Task 2 — Wire badge unlock into notification store (AC5, AC8) [x]

**File:** `apps/web/lib/use-badge-notifier.ts`

Import `useNotificationStore` and call `addNotification` inside `useBadgeNotifier`. Do NOT change `createBadgeNotifier` (it is tested separately and must remain pure):

```ts
import { useNotificationStore } from './notification-store';

// Modify useBadgeNotifier only:
export function useBadgeNotifier() {
  const qc = useQueryClient();
  useEffect(() =>
    createBadgeNotifier(qc, (name) => {
      toast.success(`Badge unlocked: ${name} 🏅`);
      useNotificationStore.getState().addNotification('badge_unlock', `Badge unlocked: ${name} 🏅`);
    }),
  [qc]);
}
```

`useNotificationStore.getState()` is the Zustand imperative accessor — safe to call outside React render cycles.

---

### Task 3 — Wire level-up and streak milestone into store (AC5) [x]

**File:** `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx`

Add import at the top:
```tsx
import { useNotificationStore } from '@/lib/notification-store';
```

In both `completeMutation.onSuccess` and `quizMutation.onSuccess`, add notification calls alongside existing logic (do NOT remove the modal or toast):

**Level-up (after `setLevelUpModal`):**
```tsx
if (data.data.leveledUp) {
  const lvl = LEVELS.find((l) => l.id === data.data.newLevel);
  if (lvl) {
    setLevelUpModal({ level: lvl.id, levelName: lvl.name, badgeColor: lvl.badgeColor });
    useNotificationStore.getState().addNotification('level_up', `Level up! You're now a ${lvl.name} 🎉`);
  }
}
```

**Streak milestone (after `toast.success`):**
```tsx
if (MILESTONE_STREAKS.includes(streakCount)) {
  toast.success(`🔥 ${streakCount}-day streak! +${streakCount * 10} XP bonus`);
  useNotificationStore.getState().addNotification('streak_milestone', `🔥 ${streakCount}-day streak! +${streakCount * 10} XP bonus`);
}
```

Apply the same changes to both `completeMutation.onSuccess` and `quizMutation.onSuccess`.

---

### Task 4 — Create `NotificationBell` component (AC5, AC6, AC7) [x]

**File:** `apps/web/components/NotificationBell.tsx` (new file)

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Award, TrendingUp, Flame, CheckCheck } from 'lucide-react';
import { useNotificationStore, NotificationType } from '@/lib/notification-store';
import { timeAgo } from '@/lib/utils';
import React from 'react';

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  badge_unlock:     <Award size={14} className="text-yellow-400" />,
  level_up:         <TrendingUp size={14} className="text-[#acc7ff]" />,
  streak_milestone: <Flame size={14} className="text-orange-400" />,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllRead } = useNotificationStore();
  const ref = useRef<HTMLDivElement>(null);
  const recent = notifications.slice(0, 10);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-[#8b909f] hover:text-white hover:bg-white/5 transition-colors"
      >
        <Bell size={18} />
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-auto w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-72 bg-[#1e2022] border border-[#2e3035] rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e3035]">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => { markAllRead(); setOpen(false); }}
                className="text-xs text-[#acc7ff] hover:underline flex items-center gap-1"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No notifications yet</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-[#2e3035]">
              {recent.map((n) => (
                <li key={n.id} className={`px-4 py-3 flex items-start gap-3 ${n.read ? 'opacity-60' : ''}`}>
                  <span className="mt-0.5 shrink-0">{TYPE_ICONS[n.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white leading-snug">{n.message}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-1.5 h-1.5 bg-[#acc7ff] rounded-full mt-1.5 shrink-0" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

---

### Task 5 — Mount bell in Sidebar; add dot indicator to BottomNav (AC5) [x]

**File: `apps/web/components/layouts/Sidebar.tsx`**

Add import and render `<NotificationBell />` inside `<nav aria-label="Main navigation">`, after the `NAV_ITEMS.map(...)` block:

```tsx
import { NotificationBell } from '@/components/NotificationBell';

// After NAV_ITEMS map, still inside <nav>:
<NotificationBell />
```

**File: `apps/web/components/layouts/BottomNav.tsx`**

Import the store and add a red dot overlay on the Badges link:

```tsx
import { useNotificationStore } from '@/lib/notification-store';

// Inside BottomNav component body:
const { unreadCount } = useNotificationStore();

// Modify the NAV_ITEMS.map render to wrap Icon in relative div:
<Link key={href} href={href} aria-current={isActive ? 'page' : undefined} className={...}>
  <div className="relative">
    <Icon size={20} />
    {href === '/badges' && unreadCount > 0 && (
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1e2022]" />
    )}
  </div>
  <span className="text-[10px] font-medium">{label}</span>
</Link>
```

---

### Task 6 — Canvas badge card + share button (AC1–AC4) [x]

**File:** `apps/web/lib/badge-card.ts` (new file)

```ts
export interface BadgeCardOptions {
  name: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  username: string;
}

const RARITY_GRADIENTS: Record<string, [string, string]> = {
  common:    ['#374151', '#1f2937'],
  rare:      ['#1e3a5f', '#1e40af'],
  epic:      ['#3b0764', '#6d28d9'],
  legendary: ['#78350f', '#b45309'],
};

export async function generateBadgeCard(opts: BadgeCardOptions): Promise<Blob> {
  const SIZE = 280;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const [c1, c2] = RARITY_GRADIENTS[opts.rarity] ?? RARITY_GRADIENTS.common;
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, SIZE, SIZE, 16);
  ctx.fill();

  // Badge icon (emoji)
  ctx.font = '64px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(opts.icon, SIZE / 2, SIZE / 2 - 20);

  // Badge name
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(opts.name, SIZE / 2, SIZE / 2 + 50);

  // Username + branding
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`${opts.username} • StockPlay`, SIZE / 2, SIZE - 20);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}
```

**File:** `apps/web/app/(dashboard)/badges/page.tsx`

Modify `BadgeCard` to add share button on earned cards:

```tsx
// Add imports at top of file:
import { useSession } from 'next-auth/react';
import { Share2 } from 'lucide-react';
import { generateBadgeCard } from '@/lib/badge-card';

// Modify BadgeCard signature and body:
function BadgeCard({ badge, earned }: { badge: Badge & { earned_at?: string }; earned: boolean }) {
  const { data: session } = useSession();

  async function handleShare() {
    const username = session?.user?.name ?? session?.user?.email ?? 'Student';
    const blob = await generateBadgeCard({
      name: badge.name,
      icon: badge.iconUrl ?? '🏆',
      rarity: badge.rarity,
      username,
    });
    const file = new File([blob], `${badge.slug}-badge.png`, { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        text: `I earned the ${badge.name} badge on StockPlay!`,
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${badge.slug}-badge.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className={cn(
      'rounded-xl p-4 border text-center transition-all',
      earned ? RARITY_STYLES[badge.rarity] : 'border-surface-800 bg-surface-900 opacity-50 grayscale',
    )}>
      <div className="text-3xl mb-2">{badge.iconUrl ?? '🏆'}</div>
      <p className={cn('text-sm font-semibold', earned ? RARITY_TEXT[badge.rarity] : 'text-slate-600')}>
        {badge.name}
      </p>
      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{badge.description}</p>
      {earned && badge.earned_at && (
        <p className="text-xs text-slate-600 mt-2">Earned {timeAgo(badge.earned_at)}</p>
      )}
      <span className={cn(
        'inline-block text-xs px-2 py-0.5 rounded-full mt-2 capitalize',
        earned ? RARITY_TEXT[badge.rarity] + ' bg-current/10' : 'text-slate-600',
      )}>
        {badge.rarity}
      </span>
      {earned && (
        <button
          onClick={handleShare}
          className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-white mx-auto transition-colors"
          aria-label={`Share ${badge.name} badge`}
        >
          <Share2 size={12} />
          Share
        </button>
      )}
    </div>
  );
}
```

---

### Task 7 — Write tests (AC5–AC8, AC1–AC2) [x]

**File:** `apps/web/lib/notification-store.test.ts` (new file)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from './notification-store';

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });
  });

  it('addNotification increments unreadCount and prepends notification', () => {
    useNotificationStore.getState().addNotification('badge_unlock', 'Badge unlocked: First Trade 🏅');
    const { notifications, unreadCount } = useNotificationStore.getState();
    expect(unreadCount).toBe(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('badge_unlock');
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].message).toBe('Badge unlocked: First Trade 🏅');
  });

  it('caps notifications at 50', () => {
    for (let i = 0; i < 55; i++) {
      useNotificationStore.getState().addNotification('badge_unlock', `Badge ${i}`);
    }
    expect(useNotificationStore.getState().notifications).toHaveLength(50);
  });

  it('markAllRead sets unreadCount to 0 and marks all read', () => {
    useNotificationStore.getState().addNotification('level_up', 'Level up! You are now a Novice 🎉');
    useNotificationStore.getState().addNotification('streak_milestone', '🔥 7-day streak! +70 XP bonus');
    useNotificationStore.getState().markAllRead();
    const { unreadCount, notifications } = useNotificationStore.getState();
    expect(unreadCount).toBe(0);
    expect(notifications.every((n) => n.read)).toBe(true);
  });

  it('newest notification appears first', () => {
    useNotificationStore.getState().addNotification('badge_unlock', 'First');
    useNotificationStore.getState().addNotification('level_up', 'Second');
    const { notifications } = useNotificationStore.getState();
    expect(notifications[0].message).toBe('Second');
    expect(notifications[1].message).toBe('First');
  });
});
```

**File:** `apps/web/lib/badge-card.test.ts` (new file)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Canvas API (unavailable in jsdom/vitest node environment)
const mockFillText = vi.fn();
const mockContext = {
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillStyle: '' as string,
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  fill: vi.fn(),
  font: '' as string,
  textAlign: '' as string,
  textBaseline: '' as string,
  fillText: mockFillText,
};

vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'canvas') {
    return {
      width: 0,
      height: 0,
      getContext: () => mockContext,
      toBlob: (cb: (b: Blob) => void) => cb(new Blob(['png'], { type: 'image/png' })),
    } as unknown as HTMLCanvasElement;
  }
  // Fall through to real createElement for non-canvas elements
  return (document as unknown as { _createElement: typeof document.createElement })._createElement(tag);
});

import { generateBadgeCard } from './badge-card';

describe('generateBadgeCard()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a Blob', async () => {
    const blob = await generateBadgeCard({
      name: 'First Trade', icon: '🏆', rarity: 'common', username: 'Alice',
    });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('draws the badge name text', async () => {
    await generateBadgeCard({ name: 'First Trade', icon: '🏆', rarity: 'common', username: 'Alice' });
    expect(mockFillText).toHaveBeenCalledWith('First Trade', expect.any(Number), expect.any(Number));
  });

  it('draws username and branding watermark', async () => {
    await generateBadgeCard({ name: 'First Trade', icon: '🏆', rarity: 'common', username: 'Alice' });
    expect(mockFillText).toHaveBeenCalledWith('Alice • StockPlay', expect.any(Number), expect.any(Number));
  });
});
```

---

### Task 8 — Run full test suite [x]

```bash
cd apps/web && node_modules/.bin/vitest run
# Expected: all existing tests pass + 4 notification-store tests + 3 badge-card tests = 7 new

cd apps/api && npx vitest run
# Expected: all existing API tests pass (no API changes in this story)
```

---

## Dev Notes

### Files to modify

1. `apps/web/lib/use-badge-notifier.ts` — add `addNotification` call in `useBadgeNotifier`
2. `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — add `addNotification` for level-up and streak milestone
3. `apps/web/app/(dashboard)/badges/page.tsx` — add share button to `BadgeCard`
4. `apps/web/components/layouts/Sidebar.tsx` — add `<NotificationBell />`
5. `apps/web/components/layouts/BottomNav.tsx` — add unread dot on Badges link

### Files to create

6. `apps/web/lib/notification-store.ts` — Zustand store with persist middleware
7. `apps/web/components/NotificationBell.tsx` — bell icon + dropdown panel
8. `apps/web/lib/badge-card.ts` — Canvas PNG generator
9. `apps/web/lib/notification-store.test.ts` — 4 tests
10. `apps/web/lib/badge-card.test.ts` — 3 tests

**No API changes. No new npm dependencies (zustand already installed).**

### Zustand `persist` in tests

The `persist` middleware activates in the browser. In Vitest (Node environment), `localStorage` is not available. Since tests call `useNotificationStore.setState(...)` to reset before each test, the persist layer is bypassed entirely — no localStorage mock required.

### `createElement` mock fallback in badge-card.test.ts

The `document.createElement` spy must fall through to the real implementation for non-canvas elements. The mock uses `document._createElement` as a fallback reference — but since `vi.spyOn` replaces the method, you may need to save the original before spying:

```ts
const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'canvas') { /* mock */ }
  return originalCreateElement(tag);
});
```

Use this pattern instead of `_createElement` to avoid property-access errors.

### `navigator.canShare` check

Always check `navigator.canShare?.({ files: [file] })` (with the actual files payload) before calling `navigator.share`. Some desktop browsers have `navigator.share` but reject file sharing. The optional chain `?.` handles environments where `canShare` is undefined.

### Canvas `roundRect` browser support

`CanvasRenderingContext2D.roundRect` is supported in Chrome 99+, Firefox 112+, Safari 15.4+. No polyfill needed for the Phase 1 target (modern mobile + desktop). If `roundRect` throws in an older browser, fall back to `fillRect` with `borderRadius` — but do not add this unless a test fails.

### NotificationBell panel positioning

The panel opens to the right of the bell (`left-full ml-2`). In the Sidebar (220px wide), the panel expands into the main content area — this is intentional and `z-50` ensures it renders above content. On `lg` breakpoint minimum widths the panel fits without overflow.

### `timeAgo` availability

`timeAgo` is already exported from `apps/web/lib/utils.ts` (used in `badges/page.tsx`). Import directly from `@/lib/utils`.

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Vitest `persist` middleware issue: `vi.mock('zustand/middleware', () => ({ persist: (fn) => fn }))` is required because ES static imports are hoisted above `beforeAll`, so Zustand captures the undefined Node `localStorage` at module init time before any `vi.stubGlobal` can run. Mocking the middleware entirely is the clean solution.
- `badge-card.test.ts`: `vi.stubGlobal('document', ...)` used to provide a mock Canvas element in the Node test environment (jsdom is not installed in this project).

### Completion Notes List
- All 8 tasks completed. 7 new tests added (4 notification-store, 3 badge-card). Full web suite: **99 tests, 0 failures** across 15 test files.
- API test suite: 69 tests pass. 4 test files fail due to pre-existing missing packages (`zod`, `jsonwebtoken`, `axios`) in worktree — unrelated to T2.12 (no API files were modified).
- `createBadgeNotifier` in `use-badge-notifier.ts` left completely unchanged per story constraint.
- Zustand `persist` middleware mock in `notification-store.test.ts` uses `vi.mock` (hoisted) instead of `vi.stubGlobal` (not hoisted) to correctly bypass localStorage dependency at module load time.

### Code Review Patch Pass (2026-04-12)
Post-review adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) surfaced 11 patch findings, all fixed:
- **P1** `badge-card.ts` — `canvas.toBlob` null crash: replaced `resolve(b!)` with `b ? resolve(b) : reject(new Error(...))`
- **P2** `badges/page.tsx` — `handleShare` unhandled rejection: wrapped entire async body in try/catch; `AbortError` suppressed silently
- **P3** `badges/page.tsx` — `URL.revokeObjectURL` race: moved revoke to `setTimeout(..., 100)` after anchor click
- **P4** `badges/page.tsx` — Firefox detached anchor: `document.body.appendChild(a)` / `removeChild(a)` around `.click()`
- **P5** `lesson/page.tsx` — streak double-fire (AC violation): removed streak notification from `quizMutation.onSuccess`; streak fires only in `completeMutation.onSuccess`
- **P8** `badge-card.ts` — `roundRect` browser compat: added `roundedRect()` shim with arc-based fallback for Safari < 15.4 / Chrome < 99
- **P11** `NotificationBell.tsx` — "Mark all read" conditional (AC7): button now always rendered; `disabled` when `unreadCount === 0` instead of hidden
- **P10** `NotificationBell.tsx` — viewport overflow: added `max-w-[calc(100vw-3rem)]` to panel
- Full suite still 99/99 web tests passing after patches.

### File List
- `apps/web/lib/notification-store.ts` — **created** — Zustand store with `addNotification`, `markAllRead`, 50-item cap, `persist` middleware
- `apps/web/lib/notification-store.test.ts` — **created** — 4 unit tests; uses `vi.mock('zustand/middleware')` to bypass `persist` in Node
- `apps/web/lib/badge-card.ts` — **created** — Canvas 280×280 PNG generator with rarity gradients, emoji icon, name, watermark
- `apps/web/lib/badge-card.test.ts` — **created** — 3 unit tests; uses `vi.stubGlobal('document', ...)` to mock Canvas in Node
- `apps/web/components/NotificationBell.tsx` — **created** — Bell button + dropdown panel with type icons, relative timestamps, mark-all-read, outside-click dismiss
- `apps/web/lib/use-badge-notifier.ts` — **modified** — `useBadgeNotifier` now also calls `addNotification('badge_unlock', ...)` alongside existing toast
- `apps/web/app/(dashboard)/learn/[moduleSlug]/[lessonSlug]/page.tsx` — **modified** — `addNotification` wired for level-up and streak milestone in both `completeMutation` and `quizMutation`
- `apps/web/app/(dashboard)/badges/page.tsx` — **modified** — `BadgeCard` gets `handleShare` with Canvas generation + Web Share API / download fallback; Share button rendered on earned cards
- `apps/web/components/layouts/Sidebar.tsx` — **modified** — `<NotificationBell />` mounted after NAV_ITEMS list
- `apps/web/components/layouts/BottomNav.tsx` — **modified** — `unreadCount` from store; red dot overlay on Badges link when `unreadCount > 0`
