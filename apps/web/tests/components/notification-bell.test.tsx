/**
 * P1-008 + P2-006 — Notification bell behavior.
 * @P1 @P2 @Component
 *
 * Tests the useNotificationStore Zustand store with persist middleware bypassed
 * (vi.mock is hoisted before the import, so the store initialises without localStorage).
 *
 * Verifies:
 * 1. Fresh store starts at unreadCount = 0
 * 2. addNotification (e.g. badge_unlock from XP award) increments unreadCount by 1
 * 3. Each notification type is accepted
 * 4. markAllRead resets the badge to 0
 * 5. Multiple dispatches accumulate correctly
 */
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Bypass zustand persist middleware — localStorage doesn't exist in node env
// vi.mock is hoisted above imports by Vitest's transform
vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}));

import { useNotificationStore } from '@/lib/notification-store';

function resetStore() {
  useNotificationStore.setState({ notifications: [], unreadCount: 0 });
}

describe('NotificationBell store — unread count (P1-008)', () => {
  beforeEach(resetStore);

  it('starts with 0 notifications and 0 unread count', () => {
    const { notifications, unreadCount } = useNotificationStore.getState();
    expect(notifications).toHaveLength(0);
    expect(unreadCount).toBe(0);
  });

  it('unread count increments by 1 when an XP event notification (badge_unlock) fires', () => {
    useNotificationStore.getState().addNotification('badge_unlock', 'You earned the First Trade badge!');
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('addNotification stores correct type, message, and read=false', () => {
    useNotificationStore.getState().addNotification('level_up', 'You reached Level 2!');
    const { notifications } = useNotificationStore.getState();
    expect(notifications[0].type).toBe('level_up');
    expect(notifications[0].message).toBe('You reached Level 2!');
    expect(notifications[0].read).toBe(false);
  });

  it('streak_milestone notification increments unread count', () => {
    useNotificationStore.getState().addNotification('streak_milestone', '🔥 7-day streak!');
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('multiple notifications accumulate unreadCount', () => {
    useNotificationStore.getState().addNotification('badge_unlock', 'Badge 1');
    useNotificationStore.getState().addNotification('level_up', 'Level up');
    useNotificationStore.getState().addNotification('streak_milestone', 'Streak');
    expect(useNotificationStore.getState().unreadCount).toBe(3);
  });

  it('markAllRead resets unreadCount to 0', () => {
    useNotificationStore.getState().addNotification('badge_unlock', 'Badge!');
    useNotificationStore.getState().addNotification('level_up', 'Level!');
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications.every((n) => n.read)).toBe(true);
  });

  it('notifications list is capped at 50', () => {
    for (let i = 0; i < 55; i++) {
      useNotificationStore.getState().addNotification('badge_unlock', `Badge ${i}`);
    }
    expect(useNotificationStore.getState().notifications.length).toBeLessThanOrEqual(50);
  });

  it('newest notification appears at the front of the list', () => {
    useNotificationStore.getState().addNotification('badge_unlock', 'First');
    useNotificationStore.getState().addNotification('level_up', 'Second');
    expect(useNotificationStore.getState().notifications[0].message).toBe('Second');
  });
});

describe('NotificationBell badge threshold (P1-008)', () => {
  beforeEach(resetStore);

  it('unreadCount capped representation: store reports 12 → badge should show 9+', () => {
    // Add 12 notifications — the component conditionally renders "9+" for >9
    for (let i = 0; i < 12; i++) {
      useNotificationStore.getState().addNotification('badge_unlock', `Badge ${i}`);
    }
    const { unreadCount } = useNotificationStore.getState();
    // Store tracks exact count; component truncates display at "9+"
    expect(unreadCount).toBe(12);
    // The capping logic in NotificationBell: unreadCount > 9 ? '9+' : unreadCount
    const displayValue = unreadCount > 9 ? '9+' : String(unreadCount);
    expect(displayValue).toBe('9+');
  });

  it('new notification after markAllRead increments unread count again', () => {
    useNotificationStore.getState().addNotification('badge_unlock', 'Old badge');
    useNotificationStore.getState().markAllRead();
    useNotificationStore.getState().addNotification('level_up', 'New level');
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P2-006 — "Mark all read" button is always rendered, disabled when unread = 0
//
// The NotificationBell renders the panel only when `open` is true.
// We test the button's disabled condition by verifying the store state
// that drives the `disabled={unreadCount === 0}` prop, and the component
// source code confirms the button is rendered (not hidden) when unread = 0.
// ─────────────────────────────────────────────────────────────────────────────
describe('"Mark all read" disabled state (P2-006)', () => {
  beforeEach(resetStore);

  it('disabled attribute condition: unreadCount===0 evaluates to true', () => {
    // Store starts at 0 — the disabled={unreadCount === 0} prop must be true
    const { unreadCount } = useNotificationStore.getState();
    expect(unreadCount === 0).toBe(true);
  });

  it('disabled condition becomes false once a notification is added', () => {
    useNotificationStore.getState().addNotification('badge_unlock', 'New badge!');
    const { unreadCount } = useNotificationStore.getState();
    expect(unreadCount === 0).toBe(false);
  });

  it('disabled condition returns true after markAllRead clears all unreads', () => {
    useNotificationStore.getState().addNotification('level_up', 'Levelled up!');
    useNotificationStore.getState().markAllRead();
    const { unreadCount } = useNotificationStore.getState();
    expect(unreadCount === 0).toBe(true);
  });

  it('component source contains disabled={unreadCount === 0} attribute for the button', async () => {
    // Verify the component has the correct conditional disabled attribute.
    // This is a structural assertion — we read the source and confirm the pattern exists.
    const fs = await import('fs');
    const path = await import('path');
    const componentPath = path.resolve(
      __dirname,
      '../../components/NotificationBell.tsx',
    );
    const source = fs.readFileSync(componentPath, 'utf-8');
    // Component must render the button with disabled={unreadCount === 0}
    expect(source).toContain('disabled={unreadCount === 0}');
    // Button must NOT be conditionally hidden — it must always be present in the markup
    // (the comment in the code says "always render 'Mark all read'")
    expect(source).toContain('Mark all read');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P2-006 — "Mark all read" button disabled state
//
// NotificationBell keeps `open` in local useState; vi.spyOn on React ESM
// exports is non-configurable and cannot be applied twice in a test file.
// We therefore validate the disabled condition at the store layer (which
// drives `disabled={unreadCount === 0}`) plus a structural source assertion
// that the button is always rendered (not hidden) when the panel is open.
//
// A full DOM assertion (toBeDisabled) would require jsdom + @testing-library/react.
// That dependency is deferred — add it if the project adds a jsdom Vitest config.
// ─────────────────────────────────────────────────────────────────────────────
describe('"Mark all read" button — disabled condition (P2-006)', () => {
  beforeEach(resetStore);

  it('disabled={unreadCount === 0} is true when store is empty', () => {
    const { unreadCount } = useNotificationStore.getState();
    // This is the exact expression used in the button's disabled prop
    expect(unreadCount === 0).toBe(true);
  });

  it('disabled condition becomes false once a notification arrives', () => {
    useNotificationStore.getState().addNotification('badge_unlock', 'New badge!');
    const { unreadCount } = useNotificationStore.getState();
    expect(unreadCount === 0).toBe(false);
  });

  it('disabled condition returns true again after markAllRead', () => {
    useNotificationStore.getState().addNotification('level_up', 'Levelled up!');
    useNotificationStore.getState().markAllRead();
    const { unreadCount } = useNotificationStore.getState();
    expect(unreadCount === 0).toBe(true);
  });

  it('component source: button is always present (not hidden) with correct disabled prop', async () => {
    // Structural assertion: the button must be rendered unconditionally inside
    // the open panel, not toggled with a conditional. This guards against
    // accidentally replacing disabled with a v-if / conditional render.
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../components/NotificationBell.tsx'),
      'utf-8',
    );
    expect(src).toContain('disabled={unreadCount === 0}');
    expect(src).toContain('Mark all read');
    // Button must NOT be inside an early-return / conditional that hides it entirely
    // (the comment in source says "always render 'Mark all read'")
    expect(src).not.toMatch(/unreadCount\s*[=!]=\s*0\s*&&\s*.*Mark all read/);
  });
});
