import { LayoutDashboard, TrendingUp, BookOpen, Trophy, User } from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/trade',       label: 'Trade',       icon: TrendingUp },
  { href: '/learn',       label: 'Learn',       icon: BookOpen },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/profile',     label: 'Profile',     icon: User },
] as const;
