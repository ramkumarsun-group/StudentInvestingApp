/**
 * P3-003 — Leaderboard renders correctly with 1,000 seeded users.
 *
 * Target endpoint:
 *   GET /api/v1/leaderboard/global
 *
 * Prerequisites:
 *   - 1,000 test users seeded via: NODE_ENV=test pnpm db:seed:load-test
 *   - The seed inserts users with random portfolio values so the rank ordering
 *     is deterministic (highest portfolio value = rank 1).
 *
 * Thresholds:
 *   - http_req_duration p(95) < 500ms
 *   - http_req_failed   rate  < 1%
 *   - leaderboard_correct_order (custom Rate) >= 0.99
 *
 * Required env vars:
 *   BASE_URL      — API base (default: http://localhost:4000/api/v1)
 *   TEST_EMAIL    — seeded load-test user email
 *   TEST_PASSWORD — seeded load-test user password
 *
 * Usage:
 *   k6 run infra/k6/leaderboard-load.js \
 *     -e BASE_URL=http://localhost:4000/api/v1 \
 *     -e TEST_EMAIL=loadtest@example.com \
 *     -e TEST_PASSWORD=LoadTest1234!
 */
import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────────
export const errorRate = new Rate('error_rate');
// R-09: Rate metric so we track the fraction of correctly-ordered responses.
// Counter('count>0') was too weak — any single pass would satisfy it.
export const orderCorrect = new Rate('leaderboard_correct_order');

// ── Options: 10 VUs for 3 minutes ─────────────────────────────────────────────
export const options = {
  vus: 10,
  duration: '3m',
  thresholds: {
    // AC3: p95 must be under 500ms even with 1,000 users in the leaderboard
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
    // R-09: ≥ 99% of leaderboard responses must have correct rank ordering
    leaderboard_correct_order: ['rate>=0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';

// ── Setup: authenticate ────────────────────────────────────────────────────────
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
  return { token: body.data?.accessToken ?? body.accessToken };
}

// ── Default function ───────────────────────────────────────────────────────────
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
  };

  const res = http.get(`${BASE_URL}/leaderboard/global`, { headers });

  const hasData = check(res, {
    'leaderboard: status 200': (r) => r.status === 200,
    'leaderboard: returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) && body.data.length > 0;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!hasData);

  // R-09: orderCorrect.add() called on EVERY iteration (outside the hasData guard)
  // so the rate denominator reflects all responses, not just successful ones.
  let isOrdered = false;

  if (hasData) {
    // AC3: verify rank ordering — rank[i] < rank[i+1] (ascending rank numbers)
    // and portfolio values are non-increasing (rank 1 has the highest value)
    try {
      const leaderboard = JSON.parse(res.body).data;

      isOrdered = true;
      for (let i = 1; i < leaderboard.length; i++) {
        const prev = leaderboard[i - 1];
        const curr = leaderboard[i];

        // Rank numbers must be strictly ascending
        if (prev.rank >= curr.rank) {
          isOrdered = false;
          break;
        }

        // Portfolio values must be non-increasing (ties allowed)
        const prevValue = prev.portfolioValue ?? prev.total_value ?? prev.value ?? 0;
        const currValue = curr.portfolioValue ?? curr.total_value ?? curr.value ?? 0;
        if (prevValue < currValue) {
          isOrdered = false;
          break;
        }
      }

      check(res, {
        'leaderboard: correct rank ordering': () => isOrdered,
      });
    } catch {
      // JSON parse error already flagged by check above; isOrdered stays false
    }
  }

  // R-09: record true/false on every iteration so rate = passing_iterations / total_iterations
  orderCorrect.add(isOrdered);
}

export function teardown() {
  console.log(
    'P3-003 complete. Verify http_req_duration p(95) < 500ms and leaderboard_correct_order rate >= 0.99.',
  );
}
