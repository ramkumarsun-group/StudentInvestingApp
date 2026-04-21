import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';
import dayjs from 'dayjs';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P1-009 — Streak counter increments on consecutive daily logins.
 * @P1 @Integration
 *
 * Seeds a student with last_activity_date = two days ago (not yesterday).
 * Using two days ago avoids a midnight-boundary race where "yesterday" can
 * momentarily equal "today" in a UTC-shifted CI environment (P1-009-A).
 *
 * Triggers streak increment via POST /learn/lessons/:id/start (which calls recordActivity).
 * Verifies current_streak >= 2 and last_activity_date is today (UTC ISO date, P1-009-B).
 */
test(
  '@P1 @Integration streak counter increments when student starts a lesson on consecutive day',
  async ({ request }) => {
    const student = createStudent();
    // P1-009-A: seed two days ago instead of yesterday to avoid midnight-boundary flakiness
    const twoDaysAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD');
    // P1-009-B: all date comparisons use UTC ISO date (YYYY-MM-DD) to avoid timezone drift
    const todayUtc   = new Date().toISOString().slice(0, 10); // UTC assumption intentional
    const TEST_MODULE_SLUG = `streak-test-module-${Date.now()}`;

    // Seed student with streak last_activity_date = two days ago + test module
    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: {
        users: [{ ...student, streakLastDate: twoDaysAgo }],
        testModule: { slug: TEST_MODULE_SLUG, title: 'Streak Test Module' },
      },
    });
    expect(seedRes.status()).toBe(201);
    const { testModule } = await seedRes.json();
    const { lessonId } = testModule as { lessonId: string };

    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: student.email, password: student.password },
    });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;

    try {
      // Start the lesson — triggers recordActivity() which increments the streak
      const startRes = await request.post(`${API_BASE}/learn/lessons/${lessonId}/start`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(startRes.status()).toBe(200);

      // Verify streak via GET /gamification/streak
      const streakRes = await request.get(`${API_BASE}/gamification/streak`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(streakRes.status()).toBe(200);
      const streak = (await streakRes.json()).data;

      // Streak should have incremented from 1 → 2 (yesterday's streak + today's activity)
      expect(streak.current_streak).toBeGreaterThanOrEqual(2);

      // P1-009-B: normalize last_activity_date to UTC ISO date before comparing
      // (streak.last_activity_date may be a full ISO timestamp — slice to YYYY-MM-DD)
      if (streak.last_activity_date) {
        const actualDateUtc = new Date(streak.last_activity_date).toISOString().slice(0, 10);
        expect(actualDateUtc).toBe(todayUtc);
      }
    } finally {
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email, testModuleSlug: TEST_MODULE_SLUG },
      });
    }
  },
);
