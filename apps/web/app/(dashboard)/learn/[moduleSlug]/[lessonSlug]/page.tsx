'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle, Zap, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { LessonBlock } from '@student-investing/shared-types';
import { getNextLessonSlug, computeQuizScore, type QuizScoreResult } from '@/lib/learn-utils';
import { LEVELS } from '@student-investing/shared-types';
import { useNotificationStore } from '@/lib/notification-store';

const MILESTONE_STREAKS = [3, 7, 14, 30, 60, 100];

export default function LessonPage() {
  const { moduleSlug, lessonSlug } = useParams<{ moduleSlug: string; lessonSlug: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<Record<string, { correct: boolean; explanation: string }>>({});
  const [levelUpModal, setLevelUpModal] = useState<{ level: number; levelName: string; badgeColor: string } | null>(null);

  // Get lesson by slug via module
  const { data: moduleData } = useQuery({
    queryKey: ['module', moduleSlug],
    queryFn: () => apiClient.get(`/learn/modules/${moduleSlug}`).then((r: { data: Record<string, unknown> }) => r.data),
  });

  const mod = moduleData as { lessons: { id: string; slug: string }[] } | undefined;
  const lessonId = mod?.lessons.find((l) => l.slug === lessonSlug)?.id;

  const { data: lessonData } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => apiClient.get(`/learn/lessons/${lessonId}`).then((r: { data: Record<string, unknown> }) => r.data),
    enabled: !!lessonId,
  });

  const lesson = lessonData as {
    id: string; title: string; content_json: LessonBlock[]; xp_reward: number;
    status: string; quizzes: ApiQuiz[];
  } | undefined;

  // P1 fix: only trigger on lessonId change (mount/lesson switch), not on every status update.
  // lesson?.status removed from deps — server-side WHERE guard prevents regression.
  // AbortController cancels the request if lessonId changes before it resolves.
  useEffect(() => {
    if (!lessonId) return;
    const controller = new AbortController();
    apiClient.post(`/learn/lessons/${lessonId}/start`, {}, { signal: controller.signal }).catch(() => {});
    return () => controller.abort();
  }, [lessonId]);

  const completeMutation = useMutation({
    mutationFn: () => apiClient.post(`/learn/lessons/${lessonId}/complete`, {}),
    onSuccess: async (data: { data: { xpEarned: number; leveledUp: boolean; newLevel: number } }) => {
      if (data.data.xpEarned > 0) {
        toast.success(`+${data.data.xpEarned} XP earned!`);
      }
      if (data.data.leveledUp) {
        const lvl = LEVELS.find((l) => l.id === data.data.newLevel);
        if (lvl) {
          setLevelUpModal({ level: lvl.id, levelName: lvl.name, badgeColor: lvl.badgeColor });
          useNotificationStore.getState().addNotification('level_up', `Level up! You're now a ${lvl.name} 🎉`);
        }
      }
      qc.invalidateQueries({ queryKey: ['modules'] });
      qc.invalidateQueries({ queryKey: ['module', moduleSlug] });
      // P3 fix: invalidate lesson cache so returning to this page shows correct status
      qc.invalidateQueries({ queryKey: ['lesson', lessonId] });
      qc.invalidateQueries({ queryKey: ['xp'] });
      qc.invalidateQueries({ queryKey: ['badges'] });

      // Refetch streak and fire milestone toast before navigating.
      // Guarded: a failed streak fetch must not block navigation (P1 review fix).
      try {
        await qc.refetchQueries({ queryKey: ['streak'] });
        const freshStreak = qc.getQueryData<{ data: { current_streak: number } }>(['streak']);
        const streakCount = freshStreak?.data?.current_streak ?? 0;
        if (MILESTONE_STREAKS.includes(streakCount)) {
          toast.success(`🔥 ${streakCount}-day streak! +${streakCount * 10} XP bonus`);
          useNotificationStore.getState().addNotification('streak_milestone', `🔥 ${streakCount}-day streak! +${streakCount * 10} XP bonus`);
        }
      } catch { /* streak fetch failure must not block lesson navigation */ }

      // P2 fix: read fresh cache value instead of stale closure
      const freshMod = qc.getQueryData<{ lessons: { slug: string }[] }>(['module', moduleSlug]);
      const nextSlug = getNextLessonSlug(freshMod?.lessons ?? [], lessonSlug);
      if (nextSlug) {
        router.push(`/learn/${moduleSlug}/${nextSlug}`);
      } else {
        router.push(`/learn/${moduleSlug}`);
      }
    },
  });

  const quizMutation = useMutation({
    mutationFn: ({ quizId, optionId }: { quizId: string; optionId: string }) =>
      apiClient.post(`/learn/quizzes/${quizId}/submit`, { optionId }),
    onSuccess: async (data: { data: { correct?: boolean; explanation: string; xpEarned?: number; leveledUp?: boolean; newLevel?: number; alreadyAnswered?: boolean } }, vars) => {
      // alreadyAnswered means the server already has this result stored; correct is returned
      // from the API so we can restore the right state on retry
      setQuizResults((prev) => ({
        ...prev,
        [vars.quizId]: { correct: !!data.data.correct, explanation: data.data.explanation },
      }));
      if (data.data.correct && !data.data.alreadyAnswered) toast.success(`+${data.data.xpEarned} XP`);
      if (data.data.leveledUp) {
        const lvl = LEVELS.find((l) => l.id === data.data.newLevel);
        if (lvl) {
          setLevelUpModal({ level: lvl.id, levelName: lvl.name, badgeColor: lvl.badgeColor });
          useNotificationStore.getState().addNotification('level_up', `Level up! You're now a ${lvl.name} 🎉`);
        }
      }
      qc.invalidateQueries({ queryKey: ['xp'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
      // P5: streak milestone is handled exclusively in completeMutation.onSuccess.
      // Firing it here too caused a double notification when a lesson has quizzes,
      // because both mutations fire in sequence on the same lesson completion.
    },
    // P6 fix: surface submission failures so user can retry
    onError: (_err, vars) => {
      setQuizAnswers((prev) => { const next = { ...prev }; delete next[vars.quizId]; return next; });
      toast.error('Quiz submission failed. Please try again.');
    },
  });

  if (!lesson) return <div className="text-slate-400 text-center mt-20">Loading...</div>;

  const allQuizzesAnswered = lesson.quizzes.length === 0 || lesson.quizzes.every((q) => quizResults[q.id] !== undefined);

  const quizScore: QuizScoreResult | null = allQuizzesAnswered && lesson.quizzes.length > 0
    ? computeQuizScore(lesson.quizzes.map((q) => q.id), quizResults)
    : null;

  const canComplete = lesson.quizzes.length === 0 || (quizScore?.passed === true);

  const handleRetryQuiz = () => {
    setQuizAnswers({});
    setQuizResults({});
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/learn/${moduleSlug}`} className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm">
        <ChevronLeft size={16} />
        Back to module
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
        <span className="text-brand-400 text-sm font-semibold flex items-center gap-1 mt-1">
          <Zap size={13} /> {lesson.xp_reward} XP reward
        </span>
      </div>

      {/* Lesson Content */}
      <div className="space-y-4">
        {lesson.content_json.map((block, i) => (
          <ContentBlock key={i} block={block} />
        ))}
      </div>

      {/* Quizzes */}
      {lesson.quizzes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Quiz</h2>
          {lesson.quizzes.map((quiz) => (
            <QuizBlock
              key={quiz.id}
              quiz={quiz}
              selectedOptionId={quizAnswers[quiz.id]}
              result={quizResults[quiz.id]}
              isSubmitting={quizMutation.isPending && quizMutation.variables?.quizId === quiz.id}
              onSelect={(optionId) => {
                // P5 fix: drop duplicate taps while mutation is in-flight
                if (quizMutation.isPending) return;
                setQuizAnswers((prev) => ({ ...prev, [quiz.id]: optionId }));
                quizMutation.mutate({ quizId: quiz.id, optionId });
              }}
            />
          ))}
        </div>
      )}

      {/* Quiz Score Summary */}
      {quizScore && (
        <div className={cn(
          'card p-4 text-center space-y-2',
          quizScore.passed ? 'border border-green-500/40' : 'border border-red-500/40',
        )}>
          <p className="text-lg font-semibold text-white">
            {quizScore.correct}/{quizScore.total} correct — {quizScore.pct}%
          </p>
          {quizScore.passed ? (
            <p className="text-green-400 font-medium">Passed ✓</p>
          ) : (
            <>
              <p className="text-red-400 font-medium">Failed ✗ — need ≥70% to complete</p>
              <button onClick={handleRetryQuiz} className="btn-secondary mt-2">
                Retry Quiz
              </button>
            </>
          )}
        </div>
      )}

      {/* Complete Button */}
      <button
        onClick={() => completeMutation.mutate()}
        disabled={!canComplete || lesson.status === 'completed' || completeMutation.isPending}
        className="btn-primary w-full py-3 flex items-center justify-center gap-2"
      >
        {lesson.status === 'completed' ? (
          <><CheckCircle size={16} /> Already Completed</>
        ) : completeMutation.isPending ? (
          'Completing...'
        ) : (
          <><CheckCircle size={16} /> Complete Lesson</>
        )}
      </button>

      {/* Level-Up Modal */}
      {levelUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card p-8 max-w-sm w-full text-center space-y-4">
            <div
              className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl font-bold"
              style={{ backgroundColor: levelUpModal.badgeColor + '33', border: `2px solid ${levelUpModal.badgeColor}` }}
            >
              {levelUpModal.level}
            </div>
            <h2 className="text-xl font-bold text-white">Level Up! 🎉</h2>
            <p className="text-slate-300">
              You&apos;re now a <span className="font-semibold text-white">{levelUpModal.levelName}</span>
            </p>
            <button
              onClick={() => setLevelUpModal(null)}
              className="btn-primary w-full"
            >
              Keep Learning
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContentBlock({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case 'text':
      return <p className="text-slate-300 leading-relaxed">{block.content}</p>;
    case 'callout':
      return (
        <div className={cn(
          'flex gap-3 p-4 rounded-lg border',
          block.variant === 'warning' ? 'bg-yellow-400/5 border-yellow-400/20 text-yellow-300'
            : block.variant === 'tip' ? 'bg-brand-400/5 border-brand-400/20 text-brand-300'
            : 'bg-blue-400/5 border-blue-400/20 text-blue-300',
        )}>
          <Info size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm">{block.content}</p>
        </div>
      );
    case 'key_term':
      return (
        <div className="bg-surface-800 rounded-lg p-4 border-l-4 border-brand-500">
          <p className="text-brand-400 font-semibold text-sm mb-1">{block.term}</p>
          <p className="text-slate-300 text-sm">{block.definition}</p>
        </div>
      );
    default:
      return null;
  }
}

type ApiQuiz = {
  id: string;
  question_text: string;
  options: { id: string; text: string }[];
  explanation: string;
  xp_reward: number;
};

function QuizBlock({
  quiz,
  selectedOptionId,
  result,
  isSubmitting,
  onSelect,
}: {
  quiz: ApiQuiz;
  selectedOptionId?: string;
  result?: { correct: boolean; explanation: string };
  isSubmitting: boolean;
  onSelect: (optionId: string) => void;
}) {
  return (
    <div className="card p-5 space-y-4">
      <p className="font-medium text-white">{quiz.question_text}</p>
      <div className="space-y-2">
        {quiz.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => !result && !isSubmitting && onSelect(opt.id)}
            disabled={!!result || isSubmitting}
            className={cn(
              'w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors',
              !result && !selectedOptionId
                ? 'border-surface-700 text-slate-300 hover:border-brand-500 hover:text-white'
                : selectedOptionId === opt.id && result?.correct
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : selectedOptionId === opt.id && !result?.correct
                ? 'border-rose-500 bg-rose-500/10 text-rose-300'
                : 'border-surface-700 text-slate-500',
            )}
          >
            {opt.text}
          </button>
        ))}
      </div>
      {result && (
        <div className={cn(
          'flex gap-2 p-3 rounded-lg text-sm',
          result.correct ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300',
        )}>
          {result.correct ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          <p>{result.explanation}</p>
        </div>
      )}
    </div>
  );
}
