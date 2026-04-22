'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/nav-items';
import { NotificationBell } from '@/components/NotificationBell';

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  // P2: wrap both fetch and signOut; if logout endpoint fails we still sign
  // out client-side, but log the error so it's not silently swallowed.
  async function handleSignOut() {
    try {
      const res = await fetch('/api/logout', { method: 'POST' });
      if (!res.ok) {
        console.error('[Sidebar] /api/logout returned', res.status);
      }
    } catch (err) {
      console.error('[Sidebar] /api/logout network error', err);
    }
    try {
      await signOut({ callbackUrl: '/login' });
    } catch (err) {
      console.error('[Sidebar] signOut error', err);
    }
  }

  return (
    // P1: base includes `flex` so the component is self-contained; parent
    // passes `hidden lg:flex` to control visibility, which overrides safely.
    <aside
      className={cn(
        'fixed left-0 top-0 h-full w-[220px] flex flex-col bg-surface-container border-r border-outline-variant z-40',
        className,
      )}
    >
      {/* Logo */}
      <div className="p-5 border-b border-outline-variant">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-sm text-surface font-display">
            SP
          </div>
          <span className="font-bold text-on-surface text-sm">StockPlay</span>
        </Link>
      </div>

      {/* Nav links */}
      {/* P8: aria-label distinguishes this nav from BottomNav for screen readers */}
      <nav aria-label="Main navigation" className="flex-1 px-3 py-4 space-y-1">
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high',
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
        <NotificationBell />
      </nav>

      {/* User menu — bottom */}
      <div className="p-3 border-t border-outline-variant">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary">
            {session?.user?.name?.[0]?.toUpperCase() ?? session?.user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-xs text-on-surface-variant truncate flex-1">
            {session?.user?.name ?? session?.user?.email ?? ''}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          aria-label="Sign out"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors w-full"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
