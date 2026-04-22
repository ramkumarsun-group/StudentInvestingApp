import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';
import crypto from 'node:crypto';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P1-010 — Quiz submission awards XP exactly once.
 * @P1 @Integration
 *
 * Seeds a student + test module (lesson + quiz).
 * Submits the quiz twice with the correct answer.
 * Verifies:
 * - First submission: correct=true, xpEarned > 0
 * - Second submission: alreadyAnswered=true, xpEarned = 0 (no XP replay)
 * - XP events log contains exactly 1 quiz_correct row for this quiz
 *
 * P1-010-A: TEST_MODULE_SLUG is generated inside the test via crypto.randomUUID()
 * so parallel Playwright workers never share the same slug.
 */
test(
  '@P1 @Integration quiz submission awards XP exactly once on duplicate submit',
  async ({ request }) => {
    // Generate per-worker unique slug to avoid parallel worker collisions (P1-010-A)
    const TEST_MODULE_SLUG = `quiz-dedup-module-${crypto.randomUUID()}`;
    const student = createStudent();

    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: {
        users: [student],
        testModule: { slug: TEST_MODULE_SLUG, title: 'Quiz Dedup Test', xpReward: 25 },
      },
    });
    expect(seedRes.status()).toBe(201);
    const { testModule } = await seedRes.json();
    const { lessonId, quizId } = testModule as { moduleId: string; lessonId: string; quizId: string };

    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: student.email, password: student.password },
    });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;

    try {
      // Start lesson first (required to create progress row)
      await request.post(`${API_BASE}/learn/lessons/${lessonId}/start`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // First quiz submission — should succeed and award XP
      const submit1 = await request.post(`${API_BASE}/learn/quizzes/${quizId}/submit`, {
        data: { optionId: 'opt_a' }, // 'opt_a' is the correct answer (seeded by testModule)
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(submit1.status()).toBe(200);
      const data1 = (await submit1.json()).data;
      expect(data1.correct).toBe(true);
      expect(data1.xpEarned).toBeGreaterThan(0);
      expect(data1.alreadyAnswered).toBeFalsy();

      // Second quiz submission — must be idempotent (no XP re-award)
      const submit2 = await request.post(`${API_BASE}/learn/quizzes/${quizId}/submit`, {
        data: { optionId: 'opt_a' },
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(submit2.status()).toBe(200);
      const data2 = (await submit2.json()).data;
      expect(data2.alreadyAnswered).toBe(true);
      expect(data2.xpEarned).toBe(0);

      // XP log should contain exactly 1 quiz_correct row
      const xpRes = await request.get(`${API_BASE}/gamification/xp-log`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(xpRes.status()).toBe(200);
      const xpLog = (await xpRes.json()).data as { event_type: string }[];
      const quizXpRows = xpLog.filter((e) => e.event_type === 'quiz_correct');
      expect(quizXpRows).toHaveLength(1);
    } finally {
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email, testModuleSlug: TEST_MODULE_SLUG },
      });
    }
  },
);
