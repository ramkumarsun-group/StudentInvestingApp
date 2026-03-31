'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/nav-items';

export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname();

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
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
