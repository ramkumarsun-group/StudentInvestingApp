/**
 * P3-001 — API p95 response time < 200ms under 50 concurrent users.
 *
 * Target endpoints:
 *   POST /api/v1/trade/order  — buy AAPL (paper trade)
 *   GET  /api/v1/portfolio    — fetch portfolio summary
 *
 * Pass/fail thresholds:
 *   - http_req_duration p(95) < 200ms
 *   - http_req_failed   rate  < 1%
 *
 * Required env vars:
 *   BASE_URL      — API base (default: http://localhost:4000/api/v1)
 *   TEST_EMAIL    — seeded load-test user email
 *   TEST_PASSWORD — seeded load-test user password
 *
 * Usage:
 *   k6 run infra/k6/api-load.js \
 *     -e BASE_URL=http://localhost:4000/api/v1 \
 *     -e TEST_EMAIL=loadtest@example.com \
 *     -e TEST_PASSWORD=LoadTest1234!
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
export const portfolioLatency = new Trend('portfolio_latency_ms', true);
export const tradeLatency = new Trend('trade_latency_ms', true);
// R-06: string key 'error_rate' matches threshold key — correct as-is.
export const errorRate = new Rate('error_rate');

// ── Options (50 VUs × 5 min via stages) ──────────────────────────────────────
// R-04: removed top-level vus/duration; stages is the sole timeline controller.
// Stages total 5m (30s ramp-up + 4m hold + 30s ramp-down).
export const options = {
  thresholds: {
    // AC1: p95 across ALL requests must be under 200ms
    http_req_duration: ['p(95)<200'],
    // AC1: fewer than 1% of requests may fail
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
  },
  // Graceful ramp-up to avoid thundering herd at test start
  stages: [
    { duration: '30s', target: 50 },  // ramp to 50 VUs
    { duration: '4m', target: 50 },   // hold for 4 minutes
    { duration: '30s', target: 0 },   // ramp down
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@example.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest1234!';

// ── R-05: per-VU token state — refreshed every 4 minutes as a safety net ─────
// Each VU has its own copy of these module-level variables.
let currentToken = '';
let tokenRefreshTime = 0;
const TOKEN_REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

function authenticate() {
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status !== 200) {
    console.error(`Token refresh failed: login returned ${loginRes.status}`);
    return;
  }

  const body = JSON.parse(loginRes.body);
  currentToken = body.data?.accessToken ?? body.accessToken ?? '';
  tokenRefreshTime = Date.now();
}

// ── Setup: authenticate once to validate credentials; token also used by VUs ─
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status !== 200) {
    throw new Error(
      `Setup failed: login returned ${loginRes.status} — ensure load-test user is seeded (pnpm db:seed:load-test)`,
    );
  }

  const body = JSON.parse(loginRes.body);
  return { token: body.data?.accessToken ?? body.accessToken };
}

// ── Default function (runs once per VU per iteration) ────────────────────────
export default function (data) {
  // R-05: each VU refreshes its own token every 4 minutes so a long test run
  // never hits an expired JWT mid-iteration.
  if (!currentToken || Date.now() - tokenRefreshTime > TOKEN_REFRESH_INTERVAL_MS) {
    // On first iteration, seed from setup() data to avoid an extra login round-trip.
    if (!currentToken && data.token) {
      currentToken = data.token;
      tokenRefreshTime = Date.now();
    } else {
      authenticate();
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${currentToken}`,
  };

  // ── GET /portfolio ─────────────────────────────────────────────────────────
  const portfolioRes = http.get(`${BASE_URL}/portfolio`, { headers });
  portfolioLatency.add(portfolioRes.timings.duration);

  const portfolioOk = check(portfolioRes, {
    'portfolio: status 200': (r) => r.status === 200,
    'portfolio: has data field': (r) => {
      try {
        return JSON.parse(r.body).data !== undefined;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!portfolioOk);

  sleep(0.1); // 100ms think-time between requests

  // ── POST /trade/order (buy 1 share of AAPL) ────────────────────────────────
  const tradePayload = JSON.stringify({
    symbol: 'AAPL',
    assetType: 'stock',
    side: 'buy',
    quantity: 1,
  });

  const tradeRes = http.post(`${BASE_URL}/trade/order`, tradePayload, { headers });
  tradeLatency.add(tradeRes.timings.duration);

  const tradeOk = check(tradeRes, {
    // 200 = success; 400 = validation error (insufficient funds etc.) — both are non-failures
    'trade: status 200 or 400': (r) => r.status === 200 || r.status === 400,
    'trade: no 5xx': (r) => r.status < 500,
  });
  errorRate.add(!tradeOk);

  sleep(0.5); // 500ms think-time
}

// ── Teardown: summary logging ─────────────────────────────────────────────────
export function teardown() {
  console.log('P3-001 load test complete. Check thresholds above for pass/fail.');
}
