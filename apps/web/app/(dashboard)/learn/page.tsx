'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BookOpen, Lock, CheckCircle, ChevronRight, Clock } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Module } from '@student-investing/shared-types';

// P9: typed as Record so unknown difficulty falls through to the fallback
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'text-emerald-400 bg-emerald-400/10',
  intermediate: 'text-yellow-400 bg-yellow-400/10',
  advanced: 'text-rose-400 bg-rose-400/10',
};

type ModuleWithMeta = Module & {
  lesson_count: number;
  completed_lessons: number;
  completion_pct: number;
  total_estimated_minutes: number;
};

export default function LearnPage() {
  const [showProModal, setShowProModal] = useState(false);

  const { data } = useQuery({
    queryKey: ['modules'],
    queryFn: () => apiClient.get('/learn/modules').then((r: { data: ModuleWithMeta[] }) => r.data),
  });

  const modules = (data ?? []) as ModuleWithMeta[];
  // P8: each difficulty level gets its own section — intermediate no longer falls into "Advanced"
  const beginner = modules.filter((m) => m.difficulty === 'beginner');
  const intermediate = modules.filter((m) => m.difficulty === 'intermediate');
  const advanced = modules.filter((m) => m.difficulty === 'advanced');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen size={24} className="text-brand-400" />
          Learn
        </h1>
        <p className="text-slate-400 mt-1">Complete modules to earn XP and unlock badges</p>
      </div>

      <ModuleSection title="Beginner" modules={beginner} onProClick={() => setShowProModal(true)} />
      {intermediate.length > 0 && <ModuleSection title="Intermediate" modules={intermediate} onProClick={() => setShowProModal(true)} />}
      {advanced.length > 0 && <ModuleSection title="Advanced" modules={advanced} onProClick={() => setShowProModal(true)} />}

      {showProModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-2">
              <Lock size={20} className="text-brand-400" />
              <h3 className="text-lg font-semibold text-white">Pro Module</h3>
            </div>
            <p className="text-sm text-slate-400">
              This module is available to Pro subscribers. Upgrade to StockPlay Pro for $4.99/month
              to unlock all Pro modules and the AI Coach.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowProModal(false)}
                className="flex-1 py-2 rounded-lg bg-surface-800 text-slate-400 text-sm font-medium hover:text-slate-200 transition-colors"
              >
                Not now
              </button>
              <Link
                href="/settings"
                onClick={() => setShowProModal(false)}
                className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold text-center hover:bg-brand-500 transition-colors"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleSection({ title, modules, onProClick }: { title: string; modules: ModuleWithMeta[]; onProClick: () => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">{title} Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((m) => {
          const isComplete = m.completion_pct === 100;
          const isLocked = m.requires_pro;

          const cardContent = (
            <>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  {/* P9: fallback colour for any unknown difficulty value */}
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', DIFFICULTY_COLORS[m.difficulty] ?? 'text-slate-400 bg-slate-400/10')}>
                    {m.difficulty}
                  </span>
                  {isLocked && (
                    <>
                      <Lock size={14} className="text-slate-500" />
                      <span className="text-xs font-semibold text-brand-400 bg-brand-400/10 px-1.5 py-0.5 rounded">Pro</span>
                    </>
                  )}
                  {isComplete && <CheckCircle size={14} className="text-emerald-400" />}
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock size={11} />
                    {m.total_estimated_minutes} min
                  </span>
                </div>
                <span className="text-xs text-brand-400 font-semibold">+{m.xp_reward} XP</span>
              </div>
              <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors">{m.title}</h3>
              <p className="text-slate-400 text-sm mt-1 line-clamp-2">{m.description}</p>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>{m.completed_lessons}/{m.lesson_count} lessons</span>
                  {isComplete ? (
                    <span className="text-green-400 font-medium">Complete ✓</span>
                  ) : (
                    <span>{m.completion_pct}%</span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
                  {/* P11: role="progressbar" + ARIA attributes for assistive technology */}
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={m.completion_pct}
                    className={cn('h-full rounded-full transition-all', isComplete ? 'bg-emerald-500' : 'bg-brand-500')}
                    style={{ width: `${m.completion_pct}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-slate-500 group-hover:text-brand-400 transition-colors">
                {isLocked ? 'Requires Pro' : isComplete ? 'Review' : 'Continue'}
                <ChevronRight size={12} />
              </div>
            </>
          );

          return isLocked ? (
            // P10: role + tabIndex + keyboard handler make locked cards accessible
            <div
              key={m.slug}
              onClick={onProClick}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onProClick()}
              role="button"
              tabIndex={0}
              className="card p-5 hover:border-surface-700 transition-all group cursor-pointer opacity-60"
            >
              {cardContent}
            </div>
          ) : (
            <Link
              key={m.slug}
              href={`/learn/${m.slug}`}
              className="card p-5 hover:border-surface-700 transition-all group"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
