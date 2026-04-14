'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Award, TrendingUp, Flame, CheckCheck } from 'lucide-react';
import React from 'react';
import { useNotificationStore } from '@/lib/notification-store';
import type { NotificationType } from '@/lib/notification-store';
import { timeAgo } from '@/lib/utils';

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  badge_unlock: <Award size={14} className="text-yellow-400" />,
  level_up: <TrendingUp size={14} className="text-[#acc7ff]" />,
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
        // P10: max-w guard prevents the panel from escaping the viewport on narrow widths
        <div className="absolute left-full top-0 ml-2 w-72 max-w-[calc(100vw-3rem)] bg-[#1e2022] border border-[#2e3035] rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e3035]">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {/* P11: always render "Mark all read"; disabled (not hidden) when no unreads — AC7 compliance */}
            <button
              onClick={() => {
                markAllRead();
                setOpen(false);
              }}
              disabled={unreadCount === 0}
              className="text-xs text-[#acc7ff] hover:underline flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            >
              <CheckCheck size={12} /> Mark all read
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No notifications yet</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-[#2e3035]">
              {recent.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 flex items-start gap-3 ${n.read ? 'opacity-60' : ''}`}
                >
                  <span className="mt-0.5 shrink-0">{TYPE_ICONS[n.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white leading-snug">{n.message}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 bg-[#acc7ff] rounded-full mt-1.5 shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
