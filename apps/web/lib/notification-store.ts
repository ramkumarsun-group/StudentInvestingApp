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
    { name: 'stockplay-notifications' },
  ),
);
