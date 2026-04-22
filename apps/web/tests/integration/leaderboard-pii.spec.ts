import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P0-006 — Public leaderboard response contains no PII.
 * @P0 @Integration @Security @FERPA
 *
 * The global leaderboard is public (no auth required).
 * Seeds a student user so the leaderboard has at least one entry,
 * then verifies no entry exposes email, full_name, date_of_birth, or password_hash.
 */
test(
  '@P0 @Integration @Security @FERPA public leaderboard contains no PII fields',
  async ({ request }) => {
    const student = createStudent();

    // Seed at least one student so the leaderboard has data to inspect
    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: { users: [student] },
    });
    expect(seedRes.status()).toBe(201);

    try {
      const res = await request.get(`${API_BASE}/leaderboard/global`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      const entries: Record<string, unknown>[] = body.data ?? [];

      // Must have at least one entry from the seeded user
      expect(entries.length).toBeGreaterThanOrEqual(1);

      for (const entry of entries) {
        // Must NOT expose PII
        expect(entry).not.toHaveProperty('email');
        expect(entry).not.toHaveProperty('full_name');
        expect(entry).not.toHaveProperty('date_of_birth');
        expect(entry).not.toHaveProperty('password_hash');
        // Must have display-safe fields
        expect(entry).toHaveProperty('username');
        expect(entry).toHaveProperty('rank');
      }
    } finally {
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email },
      });
    }
  },
);
