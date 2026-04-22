import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P0-002 — Student executes a paper trade (buy AAPL) and portfolio updates.
 * @P0 @Integration @Trade
 *
 * Injects a test price into Redis via the seed endpoint so the test
 * does not depend on live Alpaca market data.
 */
test('@P0 @Integration @Trade student executes a paper buy trade and portfolio updates', async ({
  request,
}) => {
  const student = createStudent();
  const TEST_PRICE = 150.0;

  const seedRes = await request.post(`${API_BASE}/test/seed`, {
    data: {
      users: [student],
      quotes: [{ symbol: 'AAPL', assetType: 'stock', price: TEST_PRICE }],
    },
  });
  expect(seedRes.status()).toBe(201);
  const { seeded } = await seedRes.json();
  const userId = seeded[0].userId;

  // Login to get token
  const loginRes = await request.post(`${API_BASE}/auth/login`, {
    data: { email: student.email, password: student.password },
  });
  expect(loginRes.status()).toBe(200);
  const { data: authData } = await loginRes.json();
  const token = authData.accessToken;

  try {
    // Place a buy order for 1 share of AAPL
    const tradeRes = await request.post(`${API_BASE}/trade/order`, {
      data: { symbol: 'AAPL', assetType: 'stock', side: 'buy', orderType: 'market', quantity: 1 },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(tradeRes.status()).toBe(201);

    const { data: order } = await tradeRes.json();
    expect(order.symbol).toBe('AAPL');
    expect(order.side).toBe('buy');
    expect(order.quantity).toBe(1);

    // R-11: extract the orderId to filter XP events later
    const orderId: string = order.id ?? order.order_id;

    // R-06: assert fillPrice is a number before comparing (guards against string price)
    const rawFillPrice = order.fill_price ?? order.price;
    expect(typeof rawFillPrice).toBe('number');
    const fillPrice = Number(rawFillPrice);
    // Fill price should be within ±0.1% of TEST_PRICE
    expect(fillPrice).toBeGreaterThanOrEqual(TEST_PRICE * 0.999);
    expect(fillPrice).toBeLessThanOrEqual(TEST_PRICE * 1.001);

    // Portfolio cash should have decreased
    const portfolioRes = await request.get(`${API_BASE}/portfolio`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(portfolioRes.status()).toBe(200);
    const { data: portfolio } = await portfolioRes.json();
    expect(portfolio.cash_balance).toBeLessThan(100_000);

    // R-11: XP event should have been created and must reference this specific order
    const xpRes = await request.get(`${API_BASE}/gamification/xp-log`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(xpRes.status()).toBe(200);
    const { data: xpLog } = await xpRes.json();

    // Filter by both event type AND orderId so we don't match XP from other orders
    const tradeXp = xpLog.find(
      (e: { event_type: string; reference_id?: string }) =>
        (e.event_type === 'first_trade' || e.event_type === 'trade_placed') &&
        (orderId == null || e.reference_id === orderId),
    );
    expect(tradeXp).toBeDefined();
  } finally {
    await request.delete(`${API_BASE}/test/teardown`, {
      data: { email: student.email },
    });
  }
});
