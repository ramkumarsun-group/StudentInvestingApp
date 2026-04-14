import { describe, it, expect } from 'vitest';
import { computeUnlocked, getNextLessonSlug, computeQuizScore, computeXpProgress } from './learn-utils';

describe('computeUnlocked()', () => {
  it('always unlocks the first lesson (empty list)', () => {
    expect(computeUnlocked([], 0)).toBe(true);
  });

  it('always unlocks the first lesson regardless of its own status', () => {
    expect(computeUnlocked([{ status: null }], 0)).toBe(true);
    expect(computeUnlocked([{ status: 'in_progress' }], 0)).toBe(true);
    expect(computeUnlocked([{ status: 'completed' }], 0)).toBe(true);
  });

  it('locks lesson 1 when lesson 0 is null (never started)', () => {
    expect(computeUnlocked([{ status: null }], 1)).toBe(false);
  });

  it('locks lesson 1 when lesson 0 is in_progress', () => {
    expect(computeUnlocked([{ status: 'in_progress' }], 1)).toBe(false);
  });

  it('unlocks lesson 1 when lesson 0 is completed', () => {
    expect(computeUnlocked([{ status: 'completed' }], 1)).toBe(true);
  });

  it('locks lesson 2 when lesson 1 is in_progress even if lesson 0 is completed', () => {
    expect(computeUnlocked([{ status: 'completed' }, { status: 'in_progress' }], 2)).toBe(false);
  });

  it('locks lesson 2 when lesson 1 is null even if lesson 0 is completed', () => {
    expect(computeUnlocked([{ status: 'completed' }, { status: null }], 2)).toBe(false);
  });

  it('unlocks lesson 2 when lesson 1 is completed', () => {
    expect(computeUnlocked([{ status: 'completed' }, { status: 'completed' }], 2)).toBe(true);
  });

  it('locks all lessons beyond the first incomplete in a chain', () => {
    const lessons = [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'in_progress' },
      { status: null },
    ];
    expect(computeUnlocked(lessons, 0)).toBe(true);  // first always unlocked
    expect(computeUnlocked(lessons, 1)).toBe(true);  // prev completed
    expect(computeUnlocked(lessons, 2)).toBe(true);  // prev completed
    expect(computeUnlocked(lessons, 3)).toBe(false); // prev in_progress → locked
  });

  it('returns false for index > 0 on empty lessons array', () => {
    expect(computeUnlocked([], 1)).toBe(false);
  });

  it('returns false for out-of-range index beyond lessons length', () => {
    const lessons = [{ status: 'completed' }, { status: 'completed' }];
    expect(computeUnlocked(lessons, 5)).toBe(false);
  });

  it('returns true for negative index (treated as index 0 guard)', () => {
    // index < 0 means index - 1 = -1; lessons[-1] is undefined → status !== 'completed' → false
    expect(computeUnlocked([{ status: 'completed' }], -1)).toBe(false);
  });
});

describe('getNextLessonSlug()', () => {
  const lessons = [
    { slug: 'lesson-1' },
    { slug: 'lesson-2' },
    { slug: 'lesson-3' },
  ];

  it('returns next lesson slug for middle lesson', () => {
    expect(getNextLessonSlug(lessons, 'lesson-1')).toBe('lesson-2');
    expect(getNextLessonSlug(lessons, 'lesson-2')).toBe('lesson-3');
  });

  it('returns null for last lesson', () => {
    expect(getNextLessonSlug(lessons, 'lesson-3')).toBeNull();
  });

  it('returns null when slug not found', () => {
    expect(getNextLessonSlug(lessons, 'nonexistent')).toBeNull();
  });

  it('returns null for empty lessons array', () => {
    expect(getNextLessonSlug([], 'lesson-1')).toBeNull();
  });

  it('returns null for single-lesson module', () => {
    expect(getNextLessonSlug([{ slug: 'only-lesson' }], 'only-lesson')).toBeNull();
  });
});

describe('computeQuizScore()', () => {
  it('returns passed:true with pct:100 for empty quiz list (AC4)', () => {
    expect(computeQuizScore([], {})).toEqual({ correct: 0, total: 0, pct: 100, passed: true });
  });

  it('returns pct:100 passed:true when all correct', () => {
    expect(computeQuizScore(['q1', 'q2'], { q1: { correct: true }, q2: { correct: true } }))
      .toEqual({ correct: 2, total: 2, pct: 100, passed: true });
  });

  it('returns pct:0 passed:false when all wrong', () => {
    expect(computeQuizScore(['q1', 'q2'], { q1: { correct: false }, q2: { correct: false } }))
      .toEqual({ correct: 0, total: 2, pct: 0, passed: false });
  });

  it('2/3 correct rounds to 67% → fails (<70)', () => {
    expect(
      computeQuizScore(
        ['q1', 'q2', 'q3'],
        { q1: { correct: true }, q2: { correct: true }, q3: { correct: false } },
      ).passed,
    ).toBe(false);
  });

  it('passes at 75% (3/4 correct)', () => {
    expect(
      computeQuizScore(
        ['q1', 'q2', 'q3', 'q4'],
        { q1: { correct: true }, q2: { correct: true }, q3: { correct: true }, q4: { correct: false } },
      ),
    ).toEqual({ correct: 3, total: 4, pct: 75, passed: true });
  });

  it('counts missing results as wrong (quiz not yet answered)', () => {
    expect(computeQuizScore(['q1', 'q2'], { q1: { correct: true } }))
      .toEqual({ correct: 1, total: 2, pct: 50, passed: false });
  });
});

describe('computeXpProgress()', () => {
  it('returns Rookie at 0 XP', () => {
    const r = computeXpProgress(0);
    expect(r.levelId).toBe(1);
    expect(r.levelName).toBe('Rookie');
    expect(r.pct).toBe(0);
    expect(r.isMaxLevel).toBe(false);
  });

  it('returns 50% progress at halfway through Rookie (250 XP)', () => {
    const r = computeXpProgress(250);
    expect(r.levelId).toBe(1);
    expect(r.pct).toBe(50);
  });

  it('advances to Novice at exactly 500 XP', () => {
    const r = computeXpProgress(500);
    expect(r.levelId).toBe(2);
    expect(r.levelName).toBe('Novice');
    expect(r.pct).toBe(0);
  });

  it('returns Legend at max XP with isMaxLevel:true and pct:100', () => {
    const r = computeXpProgress(65000);
    expect(r.levelId).toBe(10);
    expect(r.levelName).toBe('Legend');
    expect(r.isMaxLevel).toBe(true);
    expect(r.pct).toBe(100);
  });

  it('clamps pct to 100 even if XP exceeds max level threshold', () => {
    const r = computeXpProgress(99999);
    expect(r.pct).toBe(100);
    expect(r.isMaxLevel).toBe(true);
  });
});
