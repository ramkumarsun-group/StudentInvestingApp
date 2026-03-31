import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ── Mock external dependencies before importing the controller ──────────────

vi.mock('../config/db', () => ({
  db: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock('../services/market/market-cache.service', () => ({
  getCachedQuote: vi.fn(),
}));

vi.mock('@student-investing/shared-utils', () => ({
  calcPnl: vi.fn(),
  formatUSD: vi.fn((v: number) => `$${v}`),
  formatPercent: vi.fn((v: number) => `${v}%`),
}));

import { getPortfolio, getPortfolioHistory, resetPortfolio } from './portfolio.controller';
import { db } from '../config/db';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: 'user-123' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getPortfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with portfolio data when portfolio found', async () => {
    const portfolioRow = {
      id: 'port-1',
      user_id: 'user-123',
      total_value: 105000,
      total_return_pct: 5,
      virtual_cash: 50000,
      username: 'trader_pro',
      is_active: true,
    };

    vi.mocked(db.query).mockResolvedValueOnce({ rows: [portfolioRow], rowCount: 1 } as never);

    const req = mockReq();
    const res = mockRes();

    await getPortfolio(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: portfolioRow });
    expect(res.status).not.toHaveBeenCalledWith(404);
  });

  it('returns 404 when no portfolio found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const req = mockReq();
    const res = mockRes();

    await getPortfolio(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Portfolio not found' });
  });
});

describe('getPortfolioHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with history data array when portfolio and snapshots exist', async () => {
    const portfolioRow = { id: 'port-1' };
    const snapshotRows = [
      { portfolio_value: 102500, return_pct: 2.5, date: '2026-03-25T21:00:00Z' },
      { portfolio_value: 103000, return_pct: 3.0, date: '2026-03-24T21:00:00Z' },
    ];

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [portfolioRow], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: snapshotRows, rowCount: 2 } as never);

    const req = mockReq();
    const res = mockRes();

    await getPortfolioHistory(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: snapshotRows });
  });

  it('returns 404 when portfolio not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const req = mockReq();
    const res = mockRes();

    await getPortfolioHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Portfolio not found' });
  });

  // T1.13 AC2: empty state — portfolio exists but 0 snapshots → 200 with empty array
  it('returns 200 with empty array when portfolio found but no snapshots (new account / post-reset)', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'port-1' }], rowCount: 1 } as never) // portfolio found
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // no snapshots yet

    const req = mockReq();
    const res = mockRes();

    await getPortfolioHistory(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: [] });
    expect(res.status).not.toHaveBeenCalledWith(404);
  });
});

// T1.14 Task 4: resetPortfolio tests
describe('resetPortfolio', () => {
  let mockClient: {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    vi.mocked(db.connect).mockResolvedValue(mockClient as never);
  });

  it('clears orders, holdings, snapshots and resets portfolio to $100,000 → 200', async () => {
    // BEGIN, portfolio lookup, DELETE orders, DELETE holdings, DELETE snapshots, UPDATE portfolios, COMMIT
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'port-1' }], rowCount: 1 }) // SELECT portfolio
      .mockResolvedValueOnce({}) // DELETE orders
      .mockResolvedValueOnce({}) // DELETE holdings
      .mockResolvedValueOnce({}) // DELETE leaderboard_snapshots
      .mockResolvedValueOnce({}) // UPDATE portfolios
      .mockResolvedValueOnce({}); // COMMIT

    const req = mockReq();
    const res = mockRes();

    await resetPortfolio(req, res);

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM orders WHERE portfolio_id=$1', ['port-1']);
    expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM holdings WHERE portfolio_id=$1', ['port-1']);
    expect(mockClient.query).toHaveBeenCalledWith(
      'DELETE FROM leaderboard_snapshots WHERE user_id=$1',
      ['user-123'],
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith({ data: { message: 'Portfolio reset to $100,000' } });
  });

  it('returns 404 when portfolio not found', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT — no portfolio

    const req = mockReq();
    const res = mockRes();

    await resetPortfolio(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Portfolio not found' });
  });

  it('rolls back and rethrows on DB error', async () => {
    const dbError = new Error('DB failure');
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'port-1' }], rowCount: 1 }) // SELECT portfolio
      .mockRejectedValueOnce(dbError); // DELETE orders — throws

    const req = mockReq();
    const res = mockRes();

    await expect(resetPortfolio(req, res)).rejects.toThrow('DB failure');

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
