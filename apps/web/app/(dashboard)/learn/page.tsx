'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BookOpen, Lock, CheckCircle, ChevronRight, Clock } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Module } from '@student-investing/shared-types';

// P-10: Record<string, string> type annotation + fallback guard for unknown difficulty values from API
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'text-positive bg-positive/10',
  intermediate: 'text-yellow-400 bg-yellow-400/10',
  advanced: 'text-negative bg-negative/10',
};

export default function LearnPage() {
  const [showProModal, setShowProModal] = useState(false);

  const { data } = useQuery({
    queryKey: ['modules'],
    queryFn: () => apiClient.get('/learn/modules').then((r: { data: (Module & { lesson_count: number; completed_lessons: number; completion_pct: number; total_estimated_minutes: number })[] }) => r.data),
  });

  const modules = (data ?? []) as (Module & { lesson_count: number; completed_lessons: number; completion_pct: number; total_estimated_minutes: number })[];
  const beginner = modules.filter((m) => m.difficulty === 'beginner');
  // P-05: each difficulty level gets its own section for progressive disclosure
  const intermediate = modules.filter((m) => m.difficulty === 'intermediate');
  const advanced = modules.filter((m) => m.difficulty === 'advanced');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen size={24} className="text-primary" />
          Learn
        </h1>
        <p className="text-on-surface-variant mt-1">Complete modules to earn XP and unlock badges</p>
      </div>

      <ModuleSection title="Beginner" modules={beginner} onProClick={() => setShowProModal(true)} />
      {intermediate.length > 0 && <ModuleSection title="Intermediate" modules={intermediate} onProClick={() => setShowProModal(true)} />}
      {advanced.length > 0 && <ModuleSection title="Advanced" modules={advanced} onProClick={() => setShowProModal(true)} />}

      {showProModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-2">
              <Lock size={20} className="text-primary" />
              <h3 className="text-lg font-semibold text-white">Pro Module</h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              This module is available to Pro subscribers. Upgrade to StockPlay Pro for $4.99/month
              to unlock all Pro modules and the AI Coach.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowProModal(false)}
                className="flex-1 py-2 rounded-lg bg-surface-container-high text-on-surface-variant text-sm font-medium hover:text-on-surface transition-colors"
              >
                Not now
              </button>
              <Link
                href="/settings"
                onClick={() => setShowProModal(false)}
                className="flex-1 py-2 rounded-lg bg-primary-container text-white text-sm font-semibold text-center hover:opacity-80 transition-opacity"
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

function ModuleSection({ title, modules, onProClick }: { title: string; modules: (Module & { lesson_count: number; completed_lessons: number; completion_pct: number; total_estimated_minutes: number })[]; onProClick: () => void }) {
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
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', DIFFICULTY_COLORS[m.difficulty] ?? 'text-on-surface-variant bg-surface-container-high')}>
                    {m.difficulty}
                  </span>
                  {isLocked && (
                    <>
                      <Lock size={14} className="text-on-surface-variant" />
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Pro</span>
                    </>
                  )}
                  {isComplete && <CheckCircle size={14} className="text-positive" />}
                  <span className="text-xs text-on-surface-variant flex items-center gap-1">
                    <Clock size={11} />
                    {m.total_estimated_minutes} min
                  </span>
                </div>
                <span className="text-xs text-primary font-semibold">+{m.xp_reward} XP</span>
              </div>
              <h3 className="font-semibold text-white group-hover:text-primary transition-colors">{m.title}</h3>
              <p className="text-on-surface-variant text-sm mt-1 line-clamp-2">{m.description}</p>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-on-surface-variant mb-1.5">
                  <span>{m.completed_lessons}/{m.lesson_count} lessons</span>
                  {/* P-09: completed modules show "Complete ✓" gamification signal */}
                  {isComplete
                    ? <span className="text-positive font-medium">Complete ✓</span>
                    : <span>{m.completion_pct}%</span>
                  }
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  {/* P-08: role="progressbar" + ARIA attributes for assistive technology */}
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={m.completion_pct}
                    className={cn('h-full rounded-full transition-all', isComplete ? 'bg-positive' : 'bg-primary-container')}
                    style={{ width: `${m.completion_pct}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-on-surface-variant group-hover:text-primary transition-colors">
                {isLocked ? 'Requires Pro' : isComplete ? 'Review' : 'Continue'}
                <ChevronRight size={12} />
              </div>
            </>
          );

          return isLocked ? (
            // P-04: role + tabIndex + keyboard handler make locked cards accessible (WCAG 2.1 SC 2.1.1)
            <div
              key={m.slug}
              onClick={onProClick}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onProClick()}
              role="button"
              tabIndex={0}
              className="card p-5 hover:border-surface-bright transition-all group cursor-pointer opacity-60"
            >
              {cardContent}
            </div>
          ) : (
            <Link
              key={m.slug}
              href={`/learn/${m.slug}`}
              className="card p-5 hover:border-surface-bright transition-all group"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
