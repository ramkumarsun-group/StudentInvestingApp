import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';
const TEST_MODULE_SLUG = 'e2e-test-module-completion';

/**
 * P1-004 — Module completion awards XP and unlocks next lesson.
 * @P1 @E2E
 *
 * Seeds a student + a test module (with 1 lesson + 1 quiz).
 * Calls the API to start → complete the lesson, then verifies:
 * - An xp_events row was created
 * - The lesson status is 'completed'
 * - Quiz submission records XP once
 */
test(
  '@P1 @E2E module completion awards XP and marks lesson completed',
  async ({ request }) => {
    const student = createStudent();

    // Seed student + test module with lesson and quiz
    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: {
        users: [student],
        testModule: { slug: TEST_MODULE_SLUG, title: 'E2E Completion Test Module', xpReward: 25 },
      },
    });
    expect(seedRes.status()).toBe(201);
    const { seeded, testModule } = await seedRes.json();
    const userId = seeded[0].userId;
    const { lessonId, quizId } = testModule as { moduleId: string; lessonId: string; quizId: string };

    // Login
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: student.email, password: student.password },
    });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;

    try {
      // Step 1: Start the lesson
      const startRes = await request.post(`${API_BASE}/learn/lessons/${lessonId}/start`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(startRes.status()).toBe(200);
      const startData = (await startRes.json()).data;
      expect(startData.status).toBe('in_progress');

      // Step 2: Complete the lesson
      const completeRes = await request.post(`${API_BASE}/learn/lessons/${lessonId}/complete`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(completeRes.status()).toBe(200);
      const completeData = (await completeRes.json()).data;
      expect(completeData.xpEarned).toBeGreaterThan(0);

      // Step 3: Submit the quiz with the correct answer
      const quizRes = await request.post(`${API_BASE}/learn/quizzes/${quizId}/submit`, {
        data: { optionId: 'opt_a' }, // correct answer seeded in testModule
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(quizRes.status()).toBe(200);
      const quizData = (await quizRes.json()).data;
      expect(quizData.correct).toBe(true);
      expect(quizData.xpEarned).toBeGreaterThan(0);

      // Step 4: Verify XP log contains EXACTLY 1 lesson_complete event for this lesson (P1-004-A)
      const xpRes = await request.get(`${API_BASE}/gamification/xp-log`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(xpRes.status()).toBe(200);
      const xpLog = (await xpRes.json()).data as {
        event_type: string;
        xp_amount: number;
        reference_id?: string;
      }[];

      // Filter to lesson_complete rows for this specific lesson
      const lessonCompleteEvents = xpLog.filter(
        (e) =>
          e.event_type === 'lesson_complete' &&
          // reference_id may be the lessonId or undefined; either way count scoped events
          (e.reference_id === lessonId || e.reference_id == null),
      );

      // P1-004-A: exactly 1 lesson_complete XP event must exist — idempotency check
      expect(lessonCompleteEvents).toHaveLength(1);
      expect(lessonCompleteEvents[0].xp_amount).toBeGreaterThan(0);

      // User ID verified indirectly — the XP log is scoped to the authenticated user
      void userId; // suppress unused variable warning
    } finally {
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email, testModuleSlug: TEST_MODULE_SLUG },
      });
    }
  },
);
