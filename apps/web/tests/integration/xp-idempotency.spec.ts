import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';
import { randomUUID } from 'crypto';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P0-003 — XP award is idempotent on duplicate reference_id.
 * @P0 @Integration @Security
 */
test(
  '@P0 @Integration @Security XP award is idempotent on duplicate reference_id',
  async ({ request }) => {
    const student = createStudent();

    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: { users: [student] },
    });
    expect(seedRes.status()).toBe(201);

    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: student.email, password: student.password },
    });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;

    // Generate a unique reference_id at test runtime to avoid collisions
    // between parallel test runs and leftover data from prior runs (R-04).
    const xpPayload = {
      event_type: 'test_event',
      xp_amount: 10,
      reference_id: randomUUID(),
    };

    try {
      // First award — should succeed
      const res1 = await request.post(`${API_BASE}/gamification/xp/award`, {
        data: xpPayload,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res1.status()).toBe(201);

      // Second award with same reference_id — should conflict
      const res2 = await request.post(`${API_BASE}/gamification/xp/award`, {
        data: xpPayload,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res2.status()).toBe(409);
    } finally {
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email },
      });
    }
  },
);
