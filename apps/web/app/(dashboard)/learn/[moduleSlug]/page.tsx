'use client';

import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ChevronLeft, CheckCircle, Clock, Zap, ChevronRight, Lock } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { computeUnlocked } from '@/lib/learn-utils';
import type { Module } from '@student-investing/shared-types';

type LessonSummary = {
  id: string;
  title: string;
  slug: string;
  estimated_minutes: number;
  xp_reward: number;
  status: string | null;
};

export default function ModulePage() {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const { data: session } = useSession();
  const qc = useQueryClient();

  // Check Pro status from ['modules'] cache before fetching detail — avoids 403 flash
  const modulesCache = qc.getQueryData<{ data: (Module & { requires_pro: boolean })[] }>(['modules']);
  const cachedMod = modulesCache?.data?.find((m) => m.slug === moduleSlug);
  const isProLocked = (cachedMod?.requires_pro ?? false) && !session?.user?.isPro;

  const { data, error } = useQuery({
    queryKey: ['module', moduleSlug],
    queryFn: () => apiClient.get(`/learn/modules/${moduleSlug}`).then((r: { data: Record<string, unknown> }) => r.data),
    enabled: !isProLocked, // Skip fetch if we already know it's Pro-locked
    retry: false,          // Don't retry 403 responses
  });

  // P7: only treat a 403 as a Pro paywall — other errors (500, network) should not render the
  // upgrade screen. Any non-403 error falls through to show an empty/loading state.
  const is403 = (error as { response?: { status?: number } } | null)?.response?.status === 403;
  const showProPaywall = isProLocked || is403;

  if (showProPaywall) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/learn" className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm">
          <ChevronLeft size={16} />
          Back to Learn
        </Link>
        <div className="card p-8 text-center space-y-4 max-w-sm mx-auto">
          <div className="w-14 h-14 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto">
            <Lock size={24} className="text-brand-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Pro Module</h2>
          <p className="text-sm text-slate-400">
            This module is available to Pro subscribers. Upgrade to StockPlay Pro for $4.99/month
            to unlock all Pro modules and the AI Coach.
          </p>
          <div className="flex gap-3 pt-2">
            <Link
              href="/learn"
              className="flex-1 py-2 rounded-lg bg-surface-800 text-slate-400 text-sm font-medium hover:text-slate-200 transition-colors text-center"
            >
              Back to Learn
            </Link>
            <Link
              href="/settings"
              className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold text-center hover:bg-brand-500 transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mod = data as {
    title: string; description: string; xp_reward: number;
    lessons: LessonSummary[];
  } | undefined;

  const lessons = mod?.lessons ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/learn" className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm">
        <ChevronLeft size={16} />
        Back to Learn
      </Link>

      {mod && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-white">{mod.title}</h1>
            <p className="text-slate-400 mt-1">{mod.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-brand-400 text-sm font-semibold flex items-center gap-1">
                <Zap size={14} />
                {mod.xp_reward} XP
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {lessons.map((lesson, i) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                index={i + 1}
                moduleSlug={moduleSlug}
                isUnlocked={computeUnlocked(lessons, i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LessonCard({
  lesson,
  index,
  moduleSlug,
  isUnlocked,
}: {
  lesson: LessonSummary;
  index: number;
  moduleSlug: string;
  isUnlocked: boolean;
}) {
  const isCompleted = lesson.status === 'completed';

  if (!isUnlocked) {
    return (
      <div className="card p-4 flex items-center gap-4 opacity-50 cursor-not-allowed">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-800 shrink-0">
          <Lock size={14} className="text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-500">{lesson.title}</p>
          <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
            <span className="flex items-center gap-1"><Clock size={11} /> {lesson.estimated_minutes} min</span>
            {/* P9: xp_reward can be null for lessons with a missing seed value */}
            <span className="flex items-center gap-1"><Zap size={11} /> {lesson.xp_reward ?? 0} XP</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/learn/${moduleSlug}/${lesson.slug}`}
      className="card p-4 flex items-center gap-4 hover:border-surface-700 transition-all group"
    >
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
        isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-800 text-slate-400',
      )}>
        {isCompleted ? <CheckCircle size={16} /> : index}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium', isCompleted ? 'text-slate-400' : 'text-white group-hover:text-brand-300 transition-colors')}>
          {lesson.title}
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
          <span className="flex items-center gap-1"><Clock size={11} /> {lesson.estimated_minutes} min</span>
          {/* P9: xp_reward can be null for lessons with a missing seed value */}
          <span className="flex items-center gap-1 text-brand-400"><Zap size={11} /> {lesson.xp_reward ?? 0} XP</span>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {isCompleted && <span className="text-xs text-green-400 font-medium">Completed</span>}
        {lesson.status === 'in_progress' && <span className="text-xs text-brand-400 font-medium">In Progress</span>}
        <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400" />
      </div>
    </Link>
  );
}
