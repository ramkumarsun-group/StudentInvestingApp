'use client';

import { useSession, signOut } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Zap, ChevronDown } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useState, useEffect } from 'react';

export default function TopBar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  // AC2/AC3: Auto sign-out when refresh token is revoked or rotation replay detected
  useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError') {
      signOut({ callbackUrl: '/login?error=session_expired' });
    }
  }, [session?.error]);

  const { data: xpData } = useQuery({
    queryKey: ['xp'],
    queryFn: () => apiClient.get('/gamification/xp').then((r: { data: { total_xp: number; current_level: number; level_name: string; xp_to_next_level: number } }) => r.data),
    refetchInterval: 30000,
  });

  const { data: streakData } = useQuery({
    queryKey: ['streak'],
    queryFn: () => apiClient.get('/gamification/streak').then((r: { data: { current_streak: number } }) => r.data),
  });

  // AC1: Invalidate Redis refresh token server-side before clearing NextAuth session
  async function handleSignOut() {
    await fetch('/api/logout', { method: 'POST' });
    signOut({ callbackUrl: '/login' });
  }

  return (
    <header className="h-14 bg-surface-900 border-b border-surface-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {xpData && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-surface-800 rounded-full px-3 py-1">
              <Zap size={14} className="text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400">Lv.{xpData.current_level}</span>
              <span className="text-xs text-slate-500 ml-1">{xpData.level_name}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-24 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (xpData.total_xp / (xpData.total_xp + xpData.xp_to_next_level)) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-slate-500">{xpData.total_xp} XP</span>
            </div>
          </div>
        )}
        {streakData && streakData.current_streak > 0 && (
          <div className="flex items-center gap-1 bg-surface-800 rounded-full px-3 py-1">
            <Flame size={14} className="text-orange-400" />
            <span className="text-sm font-semibold text-orange-400">{streakData.current_streak}</span>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 hover:bg-surface-800 px-3 py-2 rounded-lg transition-colors"
        >
          <div className="w-7 h-7 bg-brand-700 rounded-full flex items-center justify-center text-xs font-bold">
            {session?.user?.name?.[0]?.toUpperCase() ?? session?.user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-sm text-slate-300 hidden sm:block">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <ChevronDown size={14} className="text-slate-500" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-surface-700 rounded-xl transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
