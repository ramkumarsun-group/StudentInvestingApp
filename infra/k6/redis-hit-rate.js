/**
 * P3-002 — Redis cache hit rate ≥ 80% under 100 req/min market quote load.
 *
 * Target endpoint:
 *   GET /api/v1/market/quote/:symbol   (AAPL, TSLA, MSFT — randomly chosen)
 *
 * Strategy:
 *   - Spike test at ~100 req/min (≈ 1.67 req/s) via constant-arrival-rate executor
 *   - Cache hit detection: X-Cache: HIT response header (set by market controller).
 *   - setup() pre-warms the cache with 3 AAPL fetches before the executor starts.
 *   - After warm-up, hit rate should stabilise at ≥ 80%.
 *
 * Threshold:
 *   - cache_hit_rate (custom) ≥ 0.80
 *   - http_req_failed rate < 1%
 *
 * Required env vars:
 *   BASE_URL      — API base (default: http://localhost:4000/api/v1)
 *   TEST_EMAIL    — seeded load-test user email
 *   TEST_PASSWORD — seeded load-test user password
 *
 * Usage:
 *   k6 run infra/k6/redis-hit-rate.js \
 *     -e BASE_URL=http://localhost:4000/api/v1 \
 *     -e TEST_EMAIL=loadtest@example.com \
 *     -e TEST_PASSWORD=LoadTest1234!
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────────
export const cacheHitRate = new Rate('cache_hit_rate');
export const errorRate = new Rate('error_rate');
export const totalRequests = new Counter('total_requests');
export const cacheHits = new Counter('cache_hits');

// ── Options: constant-arrival-rate at 100 req/min ─────────────────────────────
// R-07: extended duration from 3m to 4m for more post-warm-up measurement time.
export const options = {
  scenarios: {
    quote_spike: {
      executor: 'constant-arrival-rate',
      // 100 requests per minute = ~1.67 per second
      rate: 100,
      timeUnit: '1m',
      duration: '4m',
      preAllocatedVUs: 10,
      maxVUs: 20,
    },
  },
  thresholds: {
    // AC2: ≥ 80% of requests must be cache hits
    cache_hit_rate: ['rate>=0.80'],
    // Less than 1% errors
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';

// R-12: test multiple symbols so the cache exercises different keys
const SYMBOLS = ['AAPL', 'TSLA', 'MSFT'];

// ── Setup: authenticate + warm the Redis cache ─────────────────────────────────
// R-07: setup() pre-fetches each symbol 3 times so the cache is warm before
// the arrival-rate executor fires its first iteration.
export function setup() {
  const email = __ENV.TEST_EMAIL || 'loadtest@example.com';
  const password = __ENV.TEST_PASSWORD || 'LoadTest1234!';

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status !== 200) {
    throw new Error(`Setup failed: login returned ${loginRes.status}`);
  }

  const body = JSON.parse(loginRes.body);
  const token = body.data?.accessToken ?? body.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  // Warm up the cache — hit each symbol 3 times so all are cached before the test
  for (const symbol of SYMBOLS) {
    for (let i = 0; i < 3; i++) {
      http.get(`${BASE_URL}/market/quote/${symbol}`, { headers });
      sleep(0.5);
    }
  }

  return { token };
}

// ── Default function ───────────────────────────────────────────────────────────
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
  };

  // R-12: randomly pick a symbol each iteration
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

  const res = http.get(`${BASE_URL}/market/quote/${symbol}`, { headers });

  totalRequests.add(1);

  const isSuccess = check(res, {
    'quote: status 200': (r) => r.status === 200,
    'quote: has price': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.data?.price === 'number';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!isSuccess);

  // R-08: use X-Cache header instead of latency proxy to detect cache hits.
  // The market controller sets X-Cache: HIT when Redis serves the response,
  // and X-Cache: MISS when the upstream Alpaca/CoinGecko call is made.
  const isCacheHit = isSuccess && res.headers['X-Cache'] === 'HIT';
  cacheHitRate.add(isCacheHit);
  if (isCacheHit) cacheHits.add(1);
}

export function teardown() {
  console.log(
    'P3-002 complete. Check cache_hit_rate threshold (≥80%) for AC2 pass/fail.',
  );
  console.log(
    'Note: First request per TTL cycle will always be a cache miss; hit rate stabilises after warm-up.',
  );
}
