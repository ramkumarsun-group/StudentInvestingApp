import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../config/db', () => ({ db: { query: vi.fn() } }));
vi.mock('../config/redis', () => ({
  redis: {
    zrevrange: vi.fn(),
    zrevrank: vi.fn(),
    zscore: vi.fn(),
    pipeline: vi.fn(),
  },
}));

import { getGlobalLeaderboard, getMyRank, refreshLeaderboard } from './leaderboard.controller';
import { db } from '../config/db';
import { redis } from '../config/redis';

let mockRes: Response;

function makeReq(userId = 'user-1'): Request {
  return { user: { userId } } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
});

// ─── getGlobalLeaderboard ──────────────────────────────────────────────────────

describe('getGlobalLeaderboard()', () => {
  it('falls back to DB when Redis returns empty', async () => {
    vi.mocked(redis.zrevrange).mockResolvedValueOnce([]);
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        {
          user_id: 'user-1',
          username: 'alice',
          avatar_url: null,
          current_level: 2,
          level_name: 'Novice',
          total_value: 105000,
          return_pct: 5.0,
          rank: 1,
        },
      ],
      rowCount: 1,
    } as never);

    await getGlobalLeaderboard({} as Request, mockRes);

    expect(redis.zrevrange).toHaveBeenCalledWith('leaderboard:global', 0, 99, 'WITHSCORES');
    expect(mockRes.json).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          user_id: 'user-1',
          username: 'alice',
          return_pct: 5.0,
          rank: 1,
        }),
      ],
    });
  });

  it('returns empty array from DB when no portfolios exist', async () => {
    vi.mocked(redis.zrevrange).mockResolvedValueOnce([]);
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await getGlobalLeaderboard({} as Request, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ data: [] });
  });

  it('returns Redis-enriched entries when Redis has data', async () => {
    // Redis returns [userId, score, ...] pairs
    vi.mocked(redis.zrevrange).mockResolvedValueOnce(['user-1', '500', 'user-2', '300']);
    // Each userId triggers a DB enrich query
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{
          username: 'alice', avatar_url: null, current_level: 2,
          level_name: 'Novice', total_value: 105000,
        }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({
        rows: [{
          username: 'bob', avatar_url: null, current_level: 1,
          level_name: 'Rookie', total_value: 103000,
        }],
        rowCount: 1,
      } as never);

    await getGlobalLeaderboard({} as Request, mockRes);

    const call = vi.mocked(mockRes.json).mock.calls[0][0];
    expect(call.data).toHaveLength(2);
    expect(call.data[0]).toMatchObject({ username: 'alice', returnPct: 5.0, rank: 1 });
    expect(call.data[1]).toMatchObject({ username: 'bob', returnPct: 3.0, rank: 2 });
  });
});

// ─── getMyRank ─────────────────────────────────────────────────────────────────

describe('getMyRank()', () => {
  it('returns rank from Redis when present', async () => {
    vi.mocked(redis.zrevrank).mockResolvedValueOnce(2); // 0-indexed → rank 3
    vi.mocked(redis.zscore).mockResolvedValueOnce('450'); // score = return_pct * 100

    await getMyRank(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: { rank: 3, returnPct: 4.5 },
    });
  });

  it('falls back to DB rank when not in Redis', async () => {
    vi.mocked(redis.zrevrank).mockResolvedValueOnce(null);
    vi.mocked(redis.zscore).mockResolvedValueOnce(null);
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ rank: '5' }],
      rowCount: 1,
    } as never);

    await getMyRank(makeReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      data: { rank: 5, returnPct: 0 },
    });
  });
});

// ─── refreshLeaderboard ────────────────────────────────────────────────────────

describe('refreshLeaderboard()', () => {
  it('reads all active portfolios and writes to Redis pipeline', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        { user_id: 'user-1', total_return_pct: '5.5' },
        { user_id: 'user-2', total_return_pct: '-1.2' },
      ],
      rowCount: 2,
    } as never);

    const mockExec = vi.fn().mockResolvedValueOnce([]);
    const mockZadd = vi.fn().mockReturnThis();
    const mockDel = vi.fn().mockReturnThis();
    vi.mocked(redis.pipeline).mockReturnValueOnce({
      del: mockDel,
      zadd: mockZadd,
      exec: mockExec,
    } as never);

    await refreshLeaderboard();

    expect(mockDel).toHaveBeenCalledWith('leaderboard:global');
    // ioredis zadd signature: zadd(key, score, member)
    expect(mockZadd).toHaveBeenCalledWith('leaderboard:global', 550, 'user-1');
    expect(mockZadd).toHaveBeenCalledWith('leaderboard:global', expect.closeTo(-120, 1), 'user-2');
    expect(mockExec).toHaveBeenCalled();
  });

  it('handles empty portfolios table gracefully', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const mockExec = vi.fn().mockResolvedValueOnce([]);
    const mockZadd = vi.fn().mockReturnThis();
    const mockDel = vi.fn().mockReturnThis();
    vi.mocked(redis.pipeline).mockReturnValueOnce({
      del: mockDel,
      zadd: mockZadd,
      exec: mockExec,
    } as never);

    await refreshLeaderboard();

    expect(mockDel).toHaveBeenCalledWith('leaderboard:global');
    expect(mockZadd).not.toHaveBeenCalled();
    expect(mockExec).toHaveBeenCalled();
  });
});
