import { LEVELS } from '@student-investing/shared-types';

/**
 * Returns true if lesson at `index` is unlocked given the current lesson statuses.
 * Rule: lesson 0 is always unlocked; lesson N is unlocked only when lesson N-1 is 'completed'.
 */
export function computeUnlocked(
  lessons: { status: string | null }[],
  index: number,
): boolean {
  if (index === 0) return true;
  return lessons[index - 1]?.status === 'completed';
}

/**
 * Returns the slug of the next lesson in the module, or null if current is the last.
 */
export function getNextLessonSlug(
  lessons: { slug: string }[],
  currentSlug: string,
): string | null {
  const idx = lessons.findIndex((l) => l.slug === currentSlug);
  if (idx === -1 || idx === lessons.length - 1) return null;
  return lessons[idx + 1].slug;
}

export interface QuizScoreResult {
  correct: number;
  total: number;
  pct: number;     // 0–100 integer, rounded
  passed: boolean; // pct >= 70
}

/**
 * Computes quiz score from submitted results.
 * Pass threshold: ≥70% correct.
 * Missing results (unanswered quizzes) count as wrong.
 */
export function computeQuizScore(
  quizIds: string[],
  results: Record<string, { correct: boolean }>,
): QuizScoreResult {
  const total = quizIds.length;
  if (total === 0) return { correct: 0, total: 0, pct: 100, passed: true };
  const correct = quizIds.filter((id) => results[id]?.correct === true).length;
  const pct = Math.round((correct / total) * 100);
  return { correct, total, pct, passed: pct >= 70 };
}

export interface XpProgressResult {
  levelId: number;
  levelName: string;
  badgeColor: string;
  totalXp: number;
  xpIntoLevel: number;    // XP earned above current level's minXp
  xpNeeded: number;       // XP span of current level (next.minXp - current.minXp)
  pct: number;            // 0–100 rounded, 100 if max level
  isMaxLevel: boolean;
}

/**
 * Derives level name, badge colour, and XP progress bar values from total XP.
 * At max level (Level 10 Legend), isMaxLevel is true and pct is 100.
 */
export function computeXpProgress(totalXp: number): XpProgressResult {
  const sorted = [...LEVELS].sort((a, b) => b.minXp - a.minXp);
  const current = sorted.find((l) => totalXp >= l.minXp) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.id === current.id + 1);
  const isMaxLevel = !next;
  const xpIntoLevel = totalXp - current.minXp;
  const xpNeeded = next ? next.minXp - current.minXp : 1;
  const pct = isMaxLevel ? 100 : Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));
  return {
    levelId: current.id,
    levelName: current.name,
    badgeColor: current.badgeColor,
    totalXp,
    xpIntoLevel,
    xpNeeded,
    pct,
    isMaxLevel,
  };
}
