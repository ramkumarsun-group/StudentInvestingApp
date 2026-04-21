import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P1-003 — Market quote cached — both requests return the Redis-seeded price.
 * @P1 @Integration
 *
 * Strategy: inject a deliberately artificial price (888.88) into Redis via the
 * seed endpoint (which sets TTL=300s — safe for slow CI). The real Alpaca price
 * for AAPL will never be 888.88, so if BOTH requests return 888.88 we know the
 * route is reading from Redis on every call, not hitting Alpaca.
 *
 * P1-003-A: Both requests assert the exact TEST_PRICE to prove Redis is the
 * source. (A targeted Redis flush between calls would more definitively prove
 * cache hit vs live-fetch, but no flush-only endpoint exists without affecting
 * other keys; the distinctive price approach is the strongest available proof.)
 *
 * P1-003-B: TTL is set to 300s by the seed endpoint (see test.routes.ts setCache
 * call). Both requests fire sequentially with no artificial delays between them,
 * so TTL expiry during CI cannot cause a flap.
 */
test(
  '@P1 @Integration market quote route reads from Redis — both requests return seeded price',
  async ({ request }) => {
    const student = createStudent();
    // P1-003-A: use a price that Alpaca will never return for AAPL (proves Redis, not live fetch)
    const TEST_PRICE = 888.88;

    // Seed injects the quote into Redis with TTL=300s (P1-003-B)
    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: {
        users: [student],
        quotes: [{ symbol: 'AAPL', assetType: 'stock', price: TEST_PRICE }],
      },
    });
    expect(seedRes.status()).toBe(201);

    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: student.email, password: student.password },
    });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;

    try {
      // First request — must return the seeded (cached) price, not a live Alpaca call
      // Route: GET /market/quote/:symbol (type defaults to 'stock')
      const quote1 = await request.get(`${API_BASE}/market/quote/AAPL`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(quote1.status()).toBe(200);
      const data1 = (await quote1.json()).data;
      // Both calls must return exactly TEST_PRICE — proves the route reads from Redis
      expect(data1.price).toBe(TEST_PRICE);

      // Second request (no delay — P1-003-B) — must also return the cached price
      const quote2 = await request.get(`${API_BASE}/market/quote/AAPL`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(quote2.status()).toBe(200);
      const data2 = (await quote2.json()).data;

      // P1-003-A: both calls must return exactly the distinctive seeded price
      expect(data2.price).toBe(TEST_PRICE);
      expect(data1.price).toBe(data2.price);
    } finally {
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email },
      });
    }
  },
);
