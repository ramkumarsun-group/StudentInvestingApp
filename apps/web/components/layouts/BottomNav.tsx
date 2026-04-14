'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/nav-items';
import { useNotificationStore } from '@/lib/notification-store';

export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { unreadCount } = useNotificationStore();

  return (
    // P1: base includes `flex` so the component is self-contained.
    // P7: pb-[env(safe-area-inset-bottom)] extends the bar into the iOS home
    //     indicator zone so the background fills it; content stays in h-16.
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around pb-[env(safe-area-inset-bottom)] bg-[#1e2022] border-t border-[#2e3035] z-40',
        className,
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        // P3: guard against null pathname (static/edge rendering)
        const isActive = !!pathname && (pathname === href || pathname.startsWith(href + '/'));
        return (
          <Link
            key={href}
            href={href}
            // P8: aria-current marks the active page for screen readers
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 transition-colors',
              isActive ? 'text-[#acc7ff]' : 'text-[#8b909f]',
            )}
          >
            <div className="relative">
              <Icon size={20} />
              {href === '/badges' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1e2022]" />
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
