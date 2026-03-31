'use client';

import { useQuery } from '@tanstack/react-query';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatUSD, formatPercent } from '@student-investing/shared-utils';
import { cn } from '@/lib/utils';

export default function LeaderboardPage() {
  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => apiClient.get('/leaderboard/global').then((r: { data: unknown[] }) => r.data),
    refetchInterval: 60000,
  });

  const { data: myRank } = useQuery({
    queryKey: ['my-rank'],
    queryFn: () => apiClient.get('/leaderboard/global/me').then((r: { data: { rank: number; returnPct: number } }) => r.data),
  });

  const entries = (leaderboard ?? []) as {
    user_id: string; username: string; avatar_url?: string; current_level: number;
    level_name: string; total_value: number; return_pct: number; rank: number;
  }[];
  const myRankData = myRank as { rank: number; returnPct: number } | undefined;

  const rankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy size={24} className="text-yellow-400" />
          Leaderboard
        </h1>
        {myRankData && (
          <div className="card px-4 py-2 text-sm">
            <span className="text-slate-400">Your rank: </span>
            <span className="text-white font-bold">#{myRankData.rank}</span>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-surface-800 grid grid-cols-12 text-xs text-slate-500 font-medium">
          <span className="col-span-1 text-center">Rank</span>
          <span className="col-span-5">Investor</span>
          <span className="col-span-3 text-right">Portfolio</span>
          <span className="col-span-3 text-right">Return</span>
        </div>
        <div className="divide-y divide-surface-800">
          {entries.map((entry) => {
            const isPositive = entry.return_pct >= 0;
            const emoji = rankEmoji(entry.rank);
            return (
              <div
                key={entry.user_id}
                className="grid grid-cols-12 items-center px-4 py-3.5 hover:bg-surface-800/50 transition-colors"
              >
                <div className="col-span-1 text-center">
                  {emoji ? (
                    <span className="text-lg">{emoji}</span>
                  ) : (
                    <span className="text-slate-500 text-sm font-mono">{entry.rank}</span>
                  )}
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {entry.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{entry.username}</p>
                    <p className="text-xs text-slate-500">Lv.{entry.current_level} {entry.level_name}</p>
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-sm text-slate-300 font-mono">{formatUSD(entry.total_value)}</span>
                </div>
                <div className={cn('col-span-3 text-right flex items-center justify-end gap-1 text-sm font-mono font-semibold', isPositive ? 'positive' : 'negative')}>
                  {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {formatPercent(entry.return_pct)}
                </div>
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No data yet — be the first to trade!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
