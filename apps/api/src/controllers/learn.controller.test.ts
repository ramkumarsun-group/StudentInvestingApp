import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../config/db', () => ({ db: { query: vi.fn() } }));
vi.mock('../services/gamification/xp.service', () => ({ awardXp: vi.fn() }));
vi.mock('../services/gamification/streak.service', () => ({ recordActivity: vi.fn() }));

import { getModules, getModule, startLesson, completeLesson, submitQuiz, getProgress } from './learn.controller';
import { db } from '../config/db';
import { awardXp } from '../services/gamification/xp.service';

let mockRes: Response;

function makeReq(
  params: Record<string, string> = {},
  userId = 'user-1',
  body: Record<string, unknown> = {},
  isPro = false,
): Request {
  return { params, user: { userId, isPro }, body } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
});

// ─── getModules ────────────────────────────────────────────────────────────────

describe('getModules()', () => {
  it('returns 200 with module list including completion_pct', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'mod-1',
          slug: 'intro-to-stocks',
          title: 'Introduction to Stocks',
          difficulty: 'beginner',
          xp_reward: 200,
          requires_pro: false,
          lesson_count: '3',
          completed_lessons: '1',
          total_estimated_minutes: '18',
        },
      ],
      rowCount: 1,
    } as never);

    await getModules(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: 'mod-1',
          completion_pct: 33, // Math.round(1/3 * 100)
          total_estimated_minutes: '18',
        }),
      ],
    });
  });

  it('returns 200 with empty array when no published modules', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as never);

    await getModules(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ data: [] });
  });

  it('computes completion_pct = 0 when lesson_count is 0', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'mod-2',
          lesson_count: '0',
          completed_lessons: '0',
          total_estimated_minutes: '0',
        },
      ],
      rowCount: 1,
    } as never);

    await getModules(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: [expect.objectContaining({ completion_pct: 0 })],
    });
  });

  it('computes completion_pct = 100 when all lessons completed', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'mod-3',
          lesson_count: '3',
          completed_lessons: '3',
          total_estimated_minutes: '18',
        },
      ],
      rowCount: 1,
    } as never);

    await getModules(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: [expect.objectContaining({ completion_pct: 100 })],
    });
  });
});

// ─── getModule ─────────────────────────────────────────────────────────────────

describe('getModule()', () => {
  it('returns 200 with module + lessons when slug found', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'mod-1', slug: 'intro-to-stocks', title: 'Introduction to Stocks' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({
        rows: [
          { id: 'les-1', title: 'What Is a Stock?', slug: 'what-is-a-stock', sort_order: 1, status: null },
        ],
        rowCount: 1,
      } as never);

    await getModule(makeReq({ slug: 'intro-to-stocks' }), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'mod-1',
        lessons: expect.arrayContaining([
          expect.objectContaining({ id: 'les-1' }),
        ]),
      }),
    });
  });

  it('returns 404 when module slug not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as never);

    await getModule(makeReq({ slug: 'nonexistent' }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Module not found' });
  });

  it('queries with is_published=true so drafts are not accessible (P7)', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getModule(makeReq({ slug: 'draft-module' }), mockRes);

    const sql = vi.mocked(db.query).mock.calls[0][0] as string;
    expect(sql).toMatch(/is_published\s*=\s*true/i);
  });
});

// ─── getModule() Pro gate ──────────────────────────────────────────────────────

describe('getModule() — Pro gate', () => {
  it('returns 403 for Pro module when user is not Pro', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'mod-pro', slug: 'advanced-options', requires_pro: true, is_published: true }],
    } as never);

    await getModule(makeReq({ slug: 'advanced-options' }, 'user-1', {}, false), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Student Pro subscription required' });
  });

  it('returns 200 for Pro module when user IS Pro', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'mod-pro', slug: 'advanced-options', requires_pro: true, is_published: true }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never); // lessons query

    await getModule(makeReq({ slug: 'advanced-options' }, 'user-1', {}, true), mockRes);

    expect(mockRes.status).not.toHaveBeenCalledWith(403);
  });

  it('returns 200 for free module regardless of Pro status', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'mod-1', slug: 'intro-to-stocks', requires_pro: false, is_published: true }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await getModule(makeReq({ slug: 'intro-to-stocks' }, 'user-1', {}, false), mockRes);

    expect(mockRes.status).not.toHaveBeenCalledWith(403);
  });
});

// ─── startLesson() Pro gate ────────────────────────────────────────────────────

describe('startLesson() — Pro gate', () => {
  it('returns 403 when lesson belongs to a Pro module and user is not Pro', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ module_id: 'mod-pro', requires_pro: true }],
    } as never);

    await startLesson(makeReq({ lessonId: 'lesson-pro-1' }, 'user-1', {}, false), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Student Pro subscription required' });
  });

  it('proceeds when lesson belongs to a Pro module and user IS Pro', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ module_id: 'mod-pro', requires_pro: true }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never); // upsert progress

    await startLesson(makeReq({ lessonId: 'lesson-pro-1' }, 'user-1', {}, true), mockRes);

    expect(mockRes.status).not.toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ data: { status: 'in_progress' } });
  });
});

// ─── startLesson ───────────────────────────────────────────────────────────────

describe('startLesson()', () => {
  it('returns in_progress status on first call', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ module_id: 'mod-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // upsert

    await startLesson(makeReq({ lessonId: 'les-1' }), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ data: { status: 'in_progress' } });
  });

  it('returns 404 when lesson not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await startLesson(makeReq({ lessonId: 'bad-id' }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Lesson not found' });
  });

  it('SQL includes WHERE guard to prevent regression from completed status (P5)', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ module_id: 'mod-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await startLesson(makeReq({ lessonId: 'les-1' }), mockRes);

    const upsertSql = vi.mocked(db.query).mock.calls[1][0] as string;
    expect(upsertSql).toMatch(/status\s*<>\s*'completed'/i);
  });
});

// ─── completeLesson ────────────────────────────────────────────────────────────

describe('completeLesson()', () => {
  it('awards XP and returns xpEarned on first completion', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'les-1', module_id: 'mod-1', xp_reward: 50 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ status: 'completed' }], rowCount: 1 } as never); // upsert RETURNING
    vi.mocked(awardXp).mockResolvedValueOnce({ level: 1, xpTotal: 50 } as never);

    await completeLesson(makeReq({ lessonId: 'les-1' }), mockRes);

    expect(awardXp).toHaveBeenCalledWith('user-1', 'lesson_complete', 50, 'les-1');
    expect(mockRes.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ xpEarned: 50 }),
    });
  });

  it('returns alreadyCompleted with leveledUp:false and current level on repeat call (P1+P7)', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'les-1', module_id: 'mod-1', xp_reward: 50 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)                           // upsert no-op
      .mockResolvedValueOnce({ rows: [{ current_level: 3 }], rowCount: 1 } as never);      // user_xp lookup

    await completeLesson(makeReq({ lessonId: 'les-1' }), mockRes);

    expect(awardXp).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({
      data: { alreadyCompleted: true, xpEarned: 0, leveledUp: false, newLevel: 3 },
    });
  });

  it('returns 404 when lesson not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await completeLesson(makeReq({ lessonId: 'bad-id' }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Lesson not found' });
  });
});

// ─── submitQuiz ────────────────────────────────────────────────────────────────

describe('submitQuiz()', () => {
  const quizRow = {
    id: 'quiz-1',
    lesson_id: 'les-1',
    xp_reward: 30,
    explanation: 'Because stocks.',
    options: [
      { id: 'opt-a', text: 'Wrong', is_correct: false },
      { id: 'opt-b', text: 'Right', is_correct: true },
    ],
  };

  it('returns 400 when optionId is missing (P6)', async () => {
    await submitQuiz(makeReq({ quizId: 'quiz-1' }, 'user-1', {}), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'optionId is required' });
  });

  it('awards XP and writes quiz_score on first correct answer (P2+P3)', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [quizRow], rowCount: 1 } as never)             // quiz lookup
      .mockResolvedValueOnce({ rows: [{ module_id: 'mod-1' }], rowCount: 1 } as never) // lesson lookup
      .mockResolvedValueOnce({ rows: [{ quiz_score: 100 }], rowCount: 1 } as never)  // upsert RETURNING
      .mockResolvedValueOnce({ rows: [{ current_level: 1 }], rowCount: 1 } as never); // user_xp (P4)
    vi.mocked(awardXp).mockResolvedValueOnce({ level: 1, xpTotal: 80 } as never);

    await submitQuiz(makeReq({ quizId: 'quiz-1' }, 'user-1', { optionId: 'opt-b' }), mockRes);

    expect(awardXp).toHaveBeenCalledWith('user-1', 'quiz_correct', 30, 'quiz-1');
    expect(mockRes.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ correct: true, xpEarned: 30 }),
    });
  });

  it('returns alreadyAnswered with correct:true when stored quiz_score=100 (T2.4 retry fix)', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [quizRow], rowCount: 1 } as never)               // quiz lookup
      .mockResolvedValueOnce({ rows: [{ module_id: 'mod-1' }], rowCount: 1 } as never) // lesson lookup
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)                       // upsert no-op
      .mockResolvedValueOnce({ rows: [{ quiz_score: 100 }], rowCount: 1 } as never);   // prev score lookup

    await submitQuiz(makeReq({ quizId: 'quiz-1' }, 'user-1', { optionId: 'opt-b' }), mockRes);

    expect(awardXp).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ alreadyAnswered: true, xpEarned: 0, correct: true }),
    });
  });

  it('returns alreadyAnswered with correct:false when stored quiz_score=0 (T2.4 retry fix)', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [quizRow], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ module_id: 'mod-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
      .mockResolvedValueOnce({ rows: [{ quiz_score: 0 }], rowCount: 1 } as never); // stored wrong answer

    await submitQuiz(makeReq({ quizId: 'quiz-1' }, 'user-1', { optionId: 'opt-a' }), mockRes);

    expect(awardXp).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ alreadyAnswered: true, correct: false }),
    });
  });

  it('does not award XP on first wrong answer', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [quizRow], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ module_id: 'mod-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quiz_score: 0 }], rowCount: 1 } as never)  // upsert RETURNING
      .mockResolvedValueOnce({ rows: [{ current_level: 1 }], rowCount: 1 } as never); // user_xp (P4)

    await submitQuiz(makeReq({ quizId: 'quiz-1' }, 'user-1', { optionId: 'opt-a' }), mockRes);

    expect(awardXp).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ correct: false, xpEarned: 0 }),
    });
  });

  it('returns 404 when quiz not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await submitQuiz(makeReq({ quizId: 'bad-id' }, 'user-1', { optionId: 'opt-a' }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Quiz not found' });
  });

  it('correct answer response includes leveledUp and newLevel fields', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [quizRow], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ module_id: 'mod-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quiz_score: 100 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ current_level: 1 }], rowCount: 1 } as never); // user_xp (P4)
    vi.mocked(awardXp).mockResolvedValueOnce({ totalXp: 530, newLevel: 2, leveledUp: true } as never);

    await submitQuiz(makeReq({ quizId: 'quiz-1' }, 'user-1', { optionId: 'opt-b' }), mockRes);

    const result = vi.mocked(mockRes.json).mock.calls[0][0];
    expect(result.data.leveledUp).toBe(true);
    expect(result.data.newLevel).toBe(2);
    expect(typeof result.data.leveledUp).toBe('boolean');
    expect(typeof result.data.newLevel).toBe('number');
  });

  it('wrong answer response includes leveledUp: false without calling awardXp', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [quizRow], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ module_id: 'mod-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ quiz_score: 0 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ current_level: 2 }], rowCount: 1 } as never); // user_xp (P4)

    await submitQuiz(makeReq({ quizId: 'quiz-1' }, 'user-1', { optionId: 'opt-a' }), mockRes);

    expect(awardXp).not.toHaveBeenCalled();
    const result = vi.mocked(mockRes.json).mock.calls[0][0];
    expect(result.data.leveledUp).toBe(false);
    expect(result.data.newLevel).toBe(2); // user's actual current level from user_xp mock (P4)
    expect(result.data.xpEarned).toBe(0);
  });
});

// ─── getProgress ───────────────────────────────────────────────────────────────

describe('getProgress()', () => {
  it('returns lesson_count and completed_lessons as numbers, not pg strings (P4)', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        { id: 'mod-1', slug: 'intro-to-stocks', title: 'Introduction to Stocks', lesson_count: '3', completed_lessons: '2' },
      ],
      rowCount: 1,
    } as never);

    await getProgress(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ lesson_count: 3, completed_lessons: 2 }),
      ],
    });
  });

  it('returns empty array when user has no modules', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getProgress(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ data: [] });
  });
});
