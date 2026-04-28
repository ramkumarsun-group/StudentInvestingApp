/**
 * Test-only routes — NEVER exposed outside NODE_ENV=test.
 *
 * These endpoints allow E2E and integration tests to:
 *   - Seed isolated users, portfolios, and holdings
 *   - Tear down all data for a seeded user after each test
 *
 * Security: every handler short-circuits with 404 unless NODE_ENV === 'test'.
 */

import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { setCache } from '../config/redis';

const router = Router();

function guardTestOnly(req: Request, res: Response): boolean {
  if (process.env.NODE_ENV !== 'test') {
    res.status(404).json({ error: 'Not found' });
    return false;
  }
  return true;
}

/**
 * POST /api/v1/test/seed
 *
 * Body: { users: [{ email, password, username?, displayName?, dateOfBirth? }] }
 * Response: 201 { seeded: [{ userId, email }] }
 *
 * Idempotent: if the user already exists (same email), returns 200 with existing userId.
 */
router.post('/seed', async (req: Request, res: Response) => {
  if (!guardTestOnly(req, res)) return;

  const { users = [] } = req.body as {
    users?: {
      email: string;
      password: string;
      username?: string;
      displayName?: string;
      dateOfBirth?: string;
      portfolioValue?: number;   // override initial portfolio total_value (sets return_pct too)
      isPro?: boolean;           // seed an active subscription for Pro gate tests
      streakLastDate?: string;   // ISO date — seeds streak.last_activity_date for streak tests
    }[];
  };

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'users array is required and must not be empty' });
  }

  const seeded: { userId: string; email: string }[] = [];

  for (const user of users) {
    const { email, password, username, dateOfBirth, portfolioValue, isPro, streakLastDate } = user;

    if (!email || !password) {
      return res.status(400).json({ error: 'Each user requires email and password' });
    }

    // Idempotent — return existing user if already seeded
    const existing = await db.query<{ id: string }>('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) {
      seeded.push({ userId: existing.rows[0].id, email });
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 4); // low rounds for test speed
    const safeUsername =
      username ??
      email
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 18) + '_t';
    const dob = dateOfBirth ?? '2000-01-01';

    const userRes = await db.query<{ id: string }>(
      `INSERT INTO users(email, username, password_hash, role, date_of_birth, is_minor)
       VALUES($1, $2, $3, 'student', $4, false)
       RETURNING id`,
      [email, safeUsername, passwordHash, dob],
    );

    const userId = userRes.rows[0].id;

    // Initialise portfolio (optionally override total value for leaderboard tests)
    const initCash = portfolioValue ?? 100_000;
    const returnPct = portfolioValue != null ? ((portfolioValue - 100_000) / 100_000) * 100 : 0;
    await db.query(
      `INSERT INTO portfolios(user_id, virtual_cash, total_value, total_return_pct)
       VALUES($1, $2, $3, $4)`,
      [userId, initCash, initCash, returnPct],
    );

    // Optionally seed a Pro subscription
    if (isPro) {
      const testSubId = `sub_test_${userId.slice(0, 8)}`;
      const testCustId = `cus_test_${userId.slice(0, 8)}`;
      await db.query(
        `INSERT INTO subscriptions(user_id, plan, status, stripe_sub_id, stripe_customer_id,
           current_period_start, current_period_end)
         VALUES($1,'student_pro','active',$2,$3,NOW(),NOW() + INTERVAL '30 days')
         ON CONFLICT(stripe_sub_id) DO NOTHING`,
        [userId, testSubId, testCustId],
      );
    }

    // Optionally seed a streak row with a specific last_activity_date (for streak increment tests)
    if (streakLastDate) {
      await db.query(
        `INSERT INTO streaks(user_id, current_streak, longest_streak, last_activity_date)
         VALUES($1, 1, 1, $2)
         ON CONFLICT(user_id) DO UPDATE SET last_activity_date=$2`,
        [userId, streakLastDate],
      );
    }

    seeded.push({ userId, email });
  }

  // Optionally seed market quote cache entries for trade tests
  const { quotes = [] } = req.body as {
    quotes?: { symbol: string; assetType?: string; price: number }[];
  };
  for (const q of quotes) {
    const assetType = q.assetType ?? 'stock';
    const quoteObj = {
      symbol: q.symbol,
      price: q.price,
      change: 0,
      changePercent: 0,
      high: q.price,
      low: q.price,
      open: q.price,
      volume: 1000,
      assetType,
      timestamp: new Date().toISOString(),
    };
    await setCache(`quote:${assetType}:${q.symbol}`, quoteObj, 300);
  }

  // Optionally seed a Pro-gated module for gate tests
  const { proModuleSlug } = req.body as { proModuleSlug?: string };
  if (proModuleSlug) {
    await db.query(
      `INSERT INTO modules(slug, title, description, difficulty, estimated_minutes, xp_reward, requires_pro, is_published)
       VALUES($1, 'Test Pro Module', 'Test pro module for E2E tests', 'intermediate', 30, 200, true, true)
       ON CONFLICT(slug) DO NOTHING`,
      [proModuleSlug],
    );
  }

  // Optionally seed a full test module with a lesson and quiz (for module completion + quiz dedup tests)
  const { testModule } = req.body as {
    testModule?: { slug: string; title?: string; xpReward?: number };
  };
  let testModuleIds: { moduleId: string; lessonId: string; quizId: string } | undefined;
  if (testModule?.slug) {
    const modRes = await db.query<{ id: string }>(
      `INSERT INTO modules(slug, title, description, difficulty, xp_reward, requires_pro, is_published)
       VALUES($1, $2, 'Auto-seeded test module', 'beginner', $3, false, true)
       ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title RETURNING id`,
      [testModule.slug, testModule.title ?? 'Test Module', testModule.xpReward ?? 50],
    );
    const moduleId = modRes.rows[0].id;

    const lessonRes = await db.query<{ id: string }>(
      `INSERT INTO lessons(module_id, slug, title, content_json, xp_reward, sort_order)
       VALUES($1, $2, 'Test Lesson', '[]', 25, 1)
       ON CONFLICT DO NOTHING RETURNING id`,
      [moduleId, `${testModule.slug}-lesson-1`],
    );
    // Handle ON CONFLICT case — re-fetch if lesson already existed
    const lessonId = lessonRes.rows[0]?.id ?? (
      await db.query<{ id: string }>('SELECT id FROM lessons WHERE module_id=$1 LIMIT 1', [moduleId])
    ).rows[0].id;

    // P-06: ON CONFLICT DO NOTHING prevents duplicate quiz rows on re-seed/retry
    const quizRes = await db.query<{ id: string }>(
      `INSERT INTO quizzes(lesson_id, question_text, options, explanation, xp_reward)
       VALUES($1, 'Test question?',
         '[{"id":"opt_a","text":"Correct","is_correct":true},{"id":"opt_b","text":"Wrong","is_correct":false}]',
         'The correct answer is A.', 10)
       ON CONFLICT DO NOTHING RETURNING id`,
      [lessonId],
    );
    // Re-fetch if quiz already existed
    const quizId = quizRes.rows[0]?.id ?? (
      await db.query<{ id: string }>('SELECT id FROM quizzes WHERE lesson_id=$1 LIMIT 1', [lessonId])
    ).rows[0].id;

    testModuleIds = { moduleId, lessonId, quizId };
  }

  // AC2: single-user callers get { userId, email } at the top level for convenience;
  // multi-user calls get { seeded: [...] }. Both shapes always include testModule when present.
  const responseBase = seeded.length === 1
    ? { userId: seeded[0].userId, email: seeded[0].email, seeded }
    : { seeded };
  return res.status(201).json({ ...responseBase, ...(testModuleIds ? { testModule: testModuleIds } : {}) });
});

/**
 * DELETE /api/v1/test/teardown
 *
 * Body: { email: string }
 * Response: 200 { ok: true }
 *
 * Cascading delete of ALL data for the test user in FK-safe order.
 */
router.delete('/teardown', async (req: Request, res: Response) => {
  if (!guardTestOnly(req, res)) return;

  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const userRes = await db.query<{ id: string }>('SELECT id FROM users WHERE email=$1', [email]);

  if (userRes.rows.length === 0) {
    // Already gone — idempotent
    return res.status(200).json({ ok: true });
  }

  const userId = userRes.rows[0].id;

  // Delete in FK-safe order (children before parents)
  await db.query('DELETE FROM xp_events        WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM user_badges      WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM user_lesson_progress WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM streaks          WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM orders           WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM holdings         WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM portfolio_history WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM portfolios       WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM refresh_tokens   WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM users            WHERE id=$1',      [userId]);

  // Also clean up any test modules and webhook events if requested
  const { proModuleSlug, stripeEventIds, testModuleSlug } = req.body as {
    proModuleSlug?: string;
    stripeEventIds?: string[];
    testModuleSlug?: string;
  };
  if (proModuleSlug) {
    await db.query('DELETE FROM modules WHERE slug=$1', [proModuleSlug]);
  }
  if (testModuleSlug) {
    await db.query('DELETE FROM modules WHERE slug=$1', [testModuleSlug]);
  }
  if (stripeEventIds?.length) {
    await db.query(
      'DELETE FROM processed_webhook_events WHERE stripe_event_id = ANY($1)',
      [stripeEventIds],
    );
  }

  return res.status(200).json({ ok: true });
});

export default router;
