import { describe, it, expect, beforeEach, vi } from 'vitest';

// Bypass Zustand persist middleware in Node (no localStorage available).
// vi.mock is hoisted above imports by Vitest's transform, so this runs
// before notification-store.ts is evaluated and captures localStorage.
vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}));

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
