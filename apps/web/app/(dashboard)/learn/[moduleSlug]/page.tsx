'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle, Clock, Zap, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function ModulePage() {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['module', moduleSlug],
    queryFn: () => apiClient.get(`/learn/modules/${moduleSlug}`).then((r: { data: Record<string, unknown> }) => r.data),
  });

  const mod = data as {
    title: string; description: string; xp_reward: number;
    lessons: { id: string; title: string; slug: string; estimated_minutes: number; xp_reward: number; status: string }[];
  } | undefined;

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
            {mod.lessons.map((lesson, i) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                index={i + 1}
                moduleSlug={moduleSlug}
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
}: {
  lesson: { id: string; title: string; slug: string; estimated_minutes: number; xp_reward: number; status: string };
  index: number;
  moduleSlug: string;
}) {
  const isCompleted = lesson.status === 'completed';

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
          <span className="flex items-center gap-1 text-brand-400"><Zap size={11} /> {lesson.xp_reward} XP</span>
        </div>
      </div>
      <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 shrink-0" />
    </Link>
  );
}
