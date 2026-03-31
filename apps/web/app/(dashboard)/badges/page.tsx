'use client';

import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
import type { Badge } from '@student-investing/shared-types';

const RARITY_STYLES = {
  common: 'border-slate-700 bg-slate-800',
  rare: 'border-blue-500/40 bg-blue-500/10',
  epic: 'border-purple-500/40 bg-purple-500/10',
  legendary: 'border-yellow-500/40 bg-yellow-500/10',
};

const RARITY_TEXT = {
  common: 'text-slate-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
};

export default function BadgesPage() {
  const { data } = useQuery({
    queryKey: ['badges'],
    queryFn: () => apiClient.get('/gamification/badges').then((r: { data: (Badge & { earned_at?: string })[] }) => r.data),
  });

  const badges = (data ?? []) as (Badge & { earned_at?: string })[];
  const earned = badges.filter((b) => b.earned_at);
  const unearned = badges.filter((b) => !b.earned_at);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Award size={24} className="text-yellow-400" />
          Badges
        </h1>
        <p className="text-slate-400 mt-1">
          {earned.length}/{badges.length} earned
        </p>
      </div>

      {earned.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Earned</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {earned.map((b) => (
              <BadgeCard key={b.id} badge={b} earned />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Locked</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {unearned.map((b) => (
            <BadgeCard key={b.id} badge={b} earned={false} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BadgeCard({ badge, earned }: { badge: Badge & { earned_at?: string }; earned: boolean }) {
  return (
    <div className={cn(
      'rounded-xl p-4 border text-center transition-all',
      earned ? RARITY_STYLES[badge.rarity] : 'border-surface-800 bg-surface-900 opacity-50 grayscale',
    )}>
      <div className="text-3xl mb-2">{badge.iconUrl ?? '🏆'}</div>
      <p className={cn('text-sm font-semibold', earned ? RARITY_TEXT[badge.rarity] : 'text-slate-600')}>
        {badge.name}
      </p>
      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{badge.description}</p>
      {earned && badge.earned_at && (
        <p className="text-xs text-slate-600 mt-2">Earned {timeAgo(badge.earned_at)}</p>
      )}
      <span className={cn(
        'inline-block text-xs px-2 py-0.5 rounded-full mt-2 capitalize',
        earned ? RARITY_TEXT[badge.rarity] + ' bg-current/10' : 'text-slate-600',
      )}>
        {badge.rarity}
      </span>
    </div>
  );
}
