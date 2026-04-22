import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P1-011 — Redis cache read correctness — same price returned consistently.
 * @P1 @Integration
 *
 * Injects a specific price into Redis (via test seed, TTL=300s) for symbol MSFT.
 * Makes 20 sequential requests within the cache TTL window.
 * Verifies that ≥90% of responses return the exact seeded price — proving the
 * route consistently reads from Redis rather than calling live Alpaca.
 *
 * NOTE: This test measures cache READ CORRECTNESS (sequential single-worker),
 * not cache hit rate under concurrent load. Load/concurrency cache performance
 * is covered by the T5.5 k6 tests. With a seeded distinctive price and a 300s
 * TTL, every request in this test should be a cache hit (expected ~100%).
 * The threshold is set to ≥90% (18/20) to tolerate at most 2 warm-up misses.
 *
 * If Alpaca were being called on each request, it would return the real
 * market price which differs from TEST_PRICE (777.77), causing test failure.
 */
test(
  '@P1 @Integration Redis cache read correctness — 20 sequential MSFT quote requests return cached price',
  async ({ request }) => {
    const student = createStudent();
    const TEST_PRICE = 777.77; // distinctive value unlikely to match real MSFT price
    // P1-011-A: increased from 10 to 20 for better statistical confidence
    const REQUESTS = 20;
    // P1-011-A: ≥90% threshold (18/20) — with TTL=300s and seeded value, no misses expected
    const HIT_RATE_THRESHOLD = 0.9;

    // Seed injects the quote with TTL=300s (see test.routes.ts setCache call)
    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: {
        users: [student],
        quotes: [{ symbol: 'MSFT', assetType: 'stock', price: TEST_PRICE }],
      },
    });
    expect(seedRes.status()).toBe(201);

    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: student.email, password: student.password },
    });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;

    try {
      let cacheHits = 0;
      let cacheMisses = 0;

      for (let i = 0; i < REQUESTS; i++) {
        const res = await request.get(`${API_BASE}/market/quote/MSFT`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status()).toBe(200);
        const { data } = await res.json();

        if (data.price === TEST_PRICE) {
          cacheHits++;
        } else {
          cacheMisses++; // price differed from seed → route bypassed Redis
        }
      }

      const hitRate = cacheHits / REQUESTS;

      // P1-011-A/B: ≥90% of requests must return the cached price
      expect(hitRate).toBeGreaterThanOrEqual(HIT_RATE_THRESHOLD);

      // At most 2 out of 20 requests may have bypassed the cache (warm-up tolerance)
      expect(cacheMisses).toBeLessThanOrEqual(2);
    } finally {
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email },
      });
    }
  },
);
