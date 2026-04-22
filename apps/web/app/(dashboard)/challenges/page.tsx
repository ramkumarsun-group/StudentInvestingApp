'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Swords, Clock, Zap, Trophy, Users } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatPercent } from '@student-investing/shared-utils';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function ChallengesPage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.get('/challenges').then((r: { data: unknown[] }) => r.data),
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/challenges/${id}/join`, {}),
    onSuccess: () => {
      toast.success('Joined challenge!');
      qc.invalidateQueries({ queryKey: ['challenges'] });
    },
    onError: () => toast.error('Failed to join'),
  });

  const challenges = (data ?? []) as {
    id: string; title: string; description: string; challenge_type: string;
    target_value: number; xp_reward: number; ends_at: string; participant_count: number;
    is_completed?: boolean; my_rank?: number; current_value?: number;
  }[];

  const TYPE_LABELS: Record<string, string> = {
    return_pct: 'Best Return',
    quiz_score: 'Quiz Score',
    module_complete: 'Modules Done',
    streak: 'Streak',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Swords size={24} className="text-purple-400" />
        Challenges
      </h1>

      {challenges.length === 0 ? (
        <div className="card p-12 text-center text-on-surface-variant">
          No active challenges right now — check back soon!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {challenges.map((c) => (
            <div key={c.id} className="card p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-purple-400 font-medium bg-purple-400/10 px-2 py-0.5 rounded-full">
                    {TYPE_LABELS[c.challenge_type] ?? c.challenge_type}
                  </span>
                  <h3 className="font-semibold text-white mt-2">{c.title}</h3>
                  <p className="text-on-surface-variant text-sm mt-1">{c.description}</p>
                </div>
                <span className="text-primary font-semibold text-sm flex items-center gap-1 shrink-0 ml-2">
                  <Zap size={13} />
                  {c.xp_reward}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {dayjs(c.ends_at).fromNow(true)} left
                </span>
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {c.participant_count} participants
                </span>
                {c.my_rank && (
                  <span className="flex items-center gap-1">
                    <Trophy size={12} className="text-yellow-400" />
                    Rank #{c.my_rank}
                  </span>
                )}
              </div>

              {c.is_completed === undefined ? (
                <button
                  onClick={() => joinMutation.mutate(c.id)}
                  disabled={joinMutation.isPending}
                  className="btn-primary w-full text-sm py-2"
                >
                  Join Challenge
                </button>
              ) : (
                <div className={cn(
                  'text-center text-sm py-2 rounded-lg',
                  c.is_completed ? 'text-positive bg-positive/10' : 'text-purple-400 bg-purple-400/10',
                )}>
                  {c.is_completed ? '✅ Completed!' : '⚡ In Progress'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
