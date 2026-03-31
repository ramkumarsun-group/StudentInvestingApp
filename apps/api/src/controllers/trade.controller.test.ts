import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../services/trading/order.service', () => ({
  placeOrder: vi.fn(),
}));

vi.mock('../config/db', () => ({
  db: {
    query: vi.fn(),
  },
}));

vi.mock('../services/gamification/xp.service', () => ({
  awardXp: vi.fn(),
}));

import { createOrder, getOrders, cancelOrder } from './trade.controller';
import { placeOrder } from '../services/trading/order.service';
import { db } from '../config/db';
import { awardXp } from '../services/gamification/xp.service';

// P-8 fix: declare outside but create per-test so mock state never leaks between tests
let mockRes: Response;

function makeReq(body: Record<string, unknown>, userId = 'user-1'): Request {
  return {
    body,
    user: { userId },
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  // P-8 fix: fresh mock object per test — prevents stale mockReturnThis chains
  mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
});

describe('createOrder()', () => {
  it('valid buy → placeOrder called, returns 201 with order data', async () => {
    const fakePortfolioId = 'portfolio-1';
    const fakeOrder = {
      id: 'order-uuid-1',
      symbol: 'AAPL',
      side: 'buy',
      quantity: '10',
      fill_price: '190.19',
      status: 'filled',
      total_value: '1901.90',
      filled_at: '2026-03-26T00:00:00.000Z',
    };

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: fakePortfolioId }], rowCount: 1 } as never) // portfolio lookup
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never); // trade count

    vi.mocked(placeOrder).mockResolvedValue(fakeOrder as never);
    vi.mocked(awardXp).mockResolvedValue(undefined as never);

    const req = makeReq({
      symbol: 'AAPL',
      assetType: 'stock',
      side: 'buy',
      orderType: 'market',
      quantity: 10,
    });

    await createOrder(req, mockRes);

    expect(vi.mocked(placeOrder)).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId: fakePortfolioId,
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ data: fakeOrder });
  });

  it('placeOrder throws "Insufficient cash" → 422 with INSUFFICIENT_BALANCE code', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'portfolio-1' }],
      rowCount: 1,
    } as never);

    vi.mocked(placeOrder).mockRejectedValue(new Error('Insufficient cash'));

    const req = makeReq({
      symbol: 'AAPL',
      assetType: 'stock',
      side: 'buy',
      orderType: 'market',
      quantity: 999,
    });

    await createOrder(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(422);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        code: 'INSUFFICIENT_BALANCE',
        message: 'Insufficient cash balance.',
      },
    });
  });

  it('placeOrder throws "No price available" → 422 with MARKET_DATA_UNAVAILABLE code', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'portfolio-1' }],
      rowCount: 1,
    } as never);

    vi.mocked(placeOrder).mockRejectedValue(new Error('No price available for AAPL'));

    const req = makeReq({
      symbol: 'AAPL',
      assetType: 'stock',
      side: 'buy',
      orderType: 'market',
      quantity: 5,
    });

    await createOrder(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(422);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        code: 'MARKET_DATA_UNAVAILABLE',
        message: 'Market data is unavailable. Please try again.',
      },
    });
  });

  it('placeOrder throws unknown error → 500 with INTERNAL_ERROR code', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'portfolio-1' }],
      rowCount: 1,
    } as never);

    vi.mocked(placeOrder).mockRejectedValue(new Error('Unexpected DB failure'));

    const req = makeReq({
      symbol: 'AAPL',
      assetType: 'stock',
      side: 'buy',
      orderType: 'market',
      quantity: 5,
    });

    await createOrder(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Order failed.',
      },
    });
  });

  it('invalid body (missing quantity) → 400 validation error', async () => {
    const req = makeReq({
      symbol: 'AAPL',
      assetType: 'stock',
      side: 'buy',
      orderType: 'market',
      // quantity omitted
    });

    await createOrder(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(vi.mocked(placeOrder)).not.toHaveBeenCalled();
  });

  it('valid sell order with sufficient holdings → placeOrder called with side: sell, returns 201', async () => {
    const fakePortfolioId = 'portfolio-1';
    const fakeOrder = {
      id: 'order-uuid-sell-1',
      symbol: 'AAPL',
      side: 'sell',
      quantity: '5',
      fill_price: '189.81',
      status: 'filled',
      total_value: '949.05',
      filled_at: '2026-03-26T00:00:00.000Z',
    };

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: fakePortfolioId }], rowCount: 1 } as never) // portfolio lookup
      .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as never); // trade count

    vi.mocked(placeOrder).mockResolvedValue(fakeOrder as never);
    vi.mocked(awardXp).mockResolvedValue(undefined as never);

    const req = makeReq({
      symbol: 'AAPL',
      assetType: 'stock',
      side: 'sell',
      orderType: 'market',
      quantity: 5,
    });

    await createOrder(req, mockRes);

    expect(vi.mocked(placeOrder)).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId: fakePortfolioId,
        symbol: 'AAPL',
        side: 'sell',
        quantity: 5,
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ data: fakeOrder });
  });

  it('placeOrder throws "Insufficient holdings" → 422 with INSUFFICIENT_HOLDINGS code', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'portfolio-1' }],
      rowCount: 1,
    } as never);

    vi.mocked(placeOrder).mockRejectedValue(new Error('Insufficient holdings'));

    const req = makeReq({
      symbol: 'AAPL',
      assetType: 'stock',
      side: 'sell',
      orderType: 'market',
      quantity: 999,
    });

    await createOrder(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(422);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        code: 'INSUFFICIENT_HOLDINGS',
        message: 'You do not have enough shares to sell.',
      },
    });
  });
});

// ─── T1.12: getOrders ─────────────────────────────────────────────────────────

function makeParamsReq(params: Record<string, string>, userId = 'user-1'): Request {
  return { params, user: { userId } } as unknown as Request;
}

describe('getOrders()', () => {
  it('portfolio found → returns orders array with 200', async () => {
    const fakeOrders = [
      {
        id: 'order-1',
        symbol: 'AAPL',
        asset_type: 'stock',
        side: 'buy',
        quantity: 5,
        fill_price: '190.19',
        total_value: '950.95',
        status: 'filled',
        placed_at: '2026-03-26T00:00:00.000Z',
      },
    ];

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'portfolio-1' }], rowCount: 1 } as never) // portfolio lookup
      .mockResolvedValueOnce({ rows: fakeOrders, rowCount: 1 } as never); // orders query

    const req = makeReq({}, 'user-1');
    await getOrders(req, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ data: fakeOrders });
  });

  it('no portfolio → returns { data: [] } (not 404)', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const req = makeReq({}, 'user-1');
    await getOrders(req, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ data: [] });
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});

// ─── T1.12: cancelOrder ───────────────────────────────────────────────────────

describe('cancelOrder()', () => {
  it('pending order → status updated to cancelled, returns 200', async () => {
    const cancelledOrder = {
      id: 'order-uuid-1',
      status: 'cancelled',
      symbol: 'AAPL',
    };

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'portfolio-1' }], rowCount: 1 } as never) // portfolio lookup
      .mockResolvedValueOnce({ rows: [cancelledOrder], rowCount: 1 } as never); // UPDATE returning cancelled order

    const req = makeParamsReq({ orderId: 'order-uuid-1' });
    await cancelOrder(req, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ data: cancelledOrder });
  });

  it('order already filled → 404 with "not found or cannot be cancelled"', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'portfolio-1' }], rowCount: 1 } as never) // portfolio lookup
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // UPDATE returns empty (status≠pending)

    const req = makeParamsReq({ orderId: 'order-uuid-filled' });
    await cancelOrder(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Order not found or cannot be cancelled',
    });
  });
});
