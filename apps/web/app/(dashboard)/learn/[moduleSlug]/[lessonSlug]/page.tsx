'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle, Zap, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { LessonBlock, Quiz } from '@student-investing/shared-types';

export default function LessonPage() {
  const { moduleSlug, lessonSlug } = useParams<{ moduleSlug: string; lessonSlug: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<Record<string, { correct: boolean; explanation: string }>>({});

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
    status: string; quizzes: Quiz[];
  } | undefined;

  // Auto-start when loaded
  useEffect(() => {
    if (lessonId && lesson?.status !== 'completed') {
      apiClient.post(`/learn/lessons/${lessonId}/start`, {}).catch(() => {});
    }
  }, [lessonId, lesson?.status]);

  const completeMutation = useMutation({
    mutationFn: () => apiClient.post(`/learn/lessons/${lessonId}/complete`, {}),
    onSuccess: (data: { data: { xpEarned: number } }) => {
      toast.success(`+${data.data.xpEarned} XP earned!`);
      qc.invalidateQueries({ queryKey: ['modules'] });
      qc.invalidateQueries({ queryKey: ['xp'] });
      router.push(`/learn/${moduleSlug}`);
    },
  });

  const quizMutation = useMutation({
    mutationFn: ({ quizId, optionId }: { quizId: string; optionId: string }) =>
      apiClient.post(`/learn/quizzes/${quizId}/submit`, { optionId }),
    onSuccess: (data: { data: { correct: boolean; explanation: string; xpEarned: number } }, vars) => {
      setQuizResults((prev) => ({
        ...prev,
        [vars.quizId]: { correct: data.data.correct, explanation: data.data.explanation },
      }));
      if (data.data.correct) toast.success(`+${data.data.xpEarned} XP`);
    },
  });

  if (!lesson) return <div className="text-slate-400 text-center mt-20">Loading...</div>;

  const allQuizzesAnswered = lesson.quizzes.length === 0 || lesson.quizzes.every((q) => quizResults[q.id] !== undefined);

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
              onSelect={(optionId) => {
                setQuizAnswers((prev) => ({ ...prev, [quiz.id]: optionId }));
                quizMutation.mutate({ quizId: quiz.id, optionId });
              }}
            />
          ))}
        </div>
      )}

      {/* Complete Button */}
      <button
        onClick={() => completeMutation.mutate()}
        disabled={!allQuizzesAnswered || lesson.status === 'completed' || completeMutation.isPending}
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

function QuizBlock({
  quiz,
  selectedOptionId,
  result,
  onSelect,
}: {
  quiz: Quiz;
  selectedOptionId?: string;
  result?: { correct: boolean; explanation: string };
  onSelect: (optionId: string) => void;
}) {
  return (
    <div className="card p-5 space-y-4">
      <p className="font-medium text-white">{quiz.questionText}</p>
      <div className="space-y-2">
        {quiz.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => !result && onSelect(opt.id)}
            disabled={!!result}
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
