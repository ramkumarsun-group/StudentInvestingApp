'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, TrendingUp, BookOpen, Trophy, Award,
  MessageSquare, Users, Settings, GraduationCap, Swords,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';

const studentNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trade', label: 'Trade', icon: TrendingUp },
  { href: '/learn', label: 'Learn', icon: BookOpen },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/badges', label: 'Badges', icon: Award },
  { href: '/challenges', label: 'Challenges', icon: Swords },
  { href: '/ai-coach', label: 'AI Coach', icon: MessageSquare },
];

const teacherNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/classes', label: 'My Classes', icon: GraduationCap },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isTeacher = session?.user?.role === 'teacher' || session?.user?.role === 'admin';
  const nav = isTeacher ? teacherNav : studentNav;

  return (
    <aside className="w-64 bg-surface-900 border-r border-surface-800 flex flex-col">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center font-bold text-sm">
            SI
          </div>
          <span className="font-bold text-white">StudentInvest</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 pb-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-brand-600/20 text-brand-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800',
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-surface-800">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-surface-800 transition-colors"
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
