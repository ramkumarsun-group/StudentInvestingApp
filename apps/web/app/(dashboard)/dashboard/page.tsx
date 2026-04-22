'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TrendingUp, TrendingDown, BookOpen, Trophy, Flame, Zap, ArrowRight } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatUSD, formatPercent } from '@student-investing/shared-utils';
import PortfolioMiniChart from '@/components/charts/PortfolioMiniChart';
import { cn } from '@/lib/utils';
import { computeXpProgress } from '@/lib/learn-utils';

export default function DashboardPage() {
  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => apiClient.get('/portfolio').then((r: { data: Record<string, unknown> }) => r.data),
  });

  const { data: xp } = useQuery({
    queryKey: ['xp'],
    queryFn: () => apiClient.get('/gamification/xp').then((r: { data: Record<string, unknown> }) => r.data),
  });

  const { data: streak } = useQuery({
    queryKey: ['streak'],
    queryFn: () => apiClient.get('/gamification/streak').then((r: { data: Record<string, unknown> }) => r.data),
  });

  const { data: history } = useQuery({
    queryKey: ['portfolio-history'],
    queryFn: () => apiClient.get('/portfolio/history').then((r: { data: unknown[] }) => r.data),
  });

  const { data: trending } = useQuery({
    queryKey: ['trending'],
    queryFn: () => apiClient.get('/market/trending').then((r: { data: unknown[] }) => r.data),
  });

  const { data: progress } = useQuery({
    queryKey: ['learn-progress'],
    queryFn: () => apiClient.get('/learn/progress').then((r: { data: unknown[] }) => r.data),
  });

  const portfolioData = portfolio as { total_value: number; total_return_pct: number; virtual_cash: number } | undefined;
  const xpData = xp as { total_xp: number; current_level: number; level_name: string; xp_to_next_level: number } | undefined;
  // P-06: use computeXpProgress for correct per-level progress (xpIntoLevel / xpNeeded)
  const xpProgress = xpData ? computeXpProgress(xpData.total_xp) : null;
  const streakData = streak as { current_streak: number; longest_streak: number } | undefined;
  const historyData = (history ?? []) as { value: number; date: string }[];
  const trendingData = (trending ?? []) as { symbol: string; price: number; change_pct: number }[];
  const progressData = (progress ?? []) as { title: string; lesson_count: number; completed_lessons: number }[];

  const isPositive = (portfolioData?.total_return_pct ?? 0) >= 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-on-surface-variant text-sm mt-0.5">Your investing overview</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left column — portfolio summary */}
        <div className="space-y-6">
          {/* Portfolio Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 md:col-span-2">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-on-surface-variant text-sm">Portfolio Value</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {portfolioData ? formatUSD(portfolioData.total_value) : '—'}
                  </p>
                  <p className={cn('text-sm font-medium mt-1', isPositive ? 'positive' : 'negative')}>
                    {portfolioData ? formatPercent(portfolioData.total_return_pct) : '—'}
                    {isPositive ? <TrendingUp size={14} className="inline ml-1" /> : <TrendingDown size={14} className="inline ml-1" />}
                  </p>
                </div>
                <Link href="/trade" className="btn-primary text-sm">
                  Trade
                </Link>
              </div>
              <PortfolioMiniChart data={historyData} />
            </div>

            <div className="space-y-4">
              {/* XP Card */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={18} className="text-yellow-400" />
                  <span className="font-semibold text-white">Level {xpProgress?.levelId ?? xpData?.current_level ?? 1}</span>
                  <span className="text-on-surface-variant text-sm">{xpProgress?.levelName ?? xpData?.level_name}</span>
                </div>
                <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-container to-primary rounded-full transition-all duration-1000"
                    style={{ width: `${xpProgress?.pct ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-on-surface-variant mt-1.5">
                  {xpProgress
                    ? xpProgress.isMaxLevel
                      ? `${xpProgress.totalXp} XP — Max Level!`
                      : `${xpProgress.xpIntoLevel} / ${xpProgress.xpNeeded} XP to next level`
                    : '0 XP'
                  }
                </p>
              </div>

              {/* Streak Card */}
              <div className="card p-4">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-orange-400" />
                  <div>
                    <p className="font-semibold text-white">{streakData?.current_streak ?? 0} day streak</p>
                    <p className="text-xs text-on-surface-variant">Best: {streakData?.longest_streak ?? 0} days</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right aside — market movers + learning progress */}
        <aside className="space-y-6">
          {/* Market Movers */}
          <div className="card p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-white">Market Movers</h2>
              <Link href="/trade" className="text-primary text-sm hover:text-primary flex items-center gap-1">
                Trade <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              {trendingData.map((q) => (
                <Link
                  key={q.symbol}
                  href={`/trade?symbol=${q.symbol}`}
                  className="bg-surface-container-high hover:bg-surface-bright rounded-lg p-3 transition-colors"
                >
                  <p className="font-semibold text-white text-sm">{q.symbol}</p>
                  <p className="text-white font-mono text-sm mt-1">{formatUSD(q.price)}</p>
                  <p className={cn('text-xs mt-0.5', q.change_pct >= 0 ? 'positive' : 'negative')}>
                    {formatPercent(q.change_pct)}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {/* Learning Progress */}
          <div className="card p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <BookOpen size={18} className="text-primary" />
                Learning
              </h2>
              <Link href="/learn" className="text-primary text-sm hover:text-primary flex items-center gap-1">
                All <ArrowRight size={14} />
              </Link>
            </div>
            <div className="space-y-3">
              {progressData.map((m) => {
                const pct = m.lesson_count > 0
                  ? Math.round((m.completed_lessons / m.lesson_count) * 100)
                  : 0;
                return (
                  <div key={m.title} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-on-surface-variant truncate">{m.title}</span>
                        <span className="text-on-surface-variant ml-2 shrink-0">{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container-high rounded-full">
                        <div
                          className="h-full bg-primary-container rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {progressData.length === 0 && (
                <p className="text-on-surface-variant text-sm">
                  No modules started yet.{' '}
                  <Link href="/learn" className="text-primary hover:text-primary">
                    Start learning →
                  </Link>
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
