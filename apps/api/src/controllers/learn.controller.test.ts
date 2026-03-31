import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../config/db', () => ({ db: { query: vi.fn() } }));
vi.mock('../services/gamification/xp.service', () => ({ awardXp: vi.fn() }));
vi.mock('../services/gamification/streak.service', () => ({ recordActivity: vi.fn() }));

import { getModules, getModule } from './learn.controller';
import { db } from '../config/db';

let mockRes: Response;

function makeReq(
  params: Record<string, string> = {},
  userId = 'user-1',
): Request {
  return { params, user: { userId } } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
});

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
});
