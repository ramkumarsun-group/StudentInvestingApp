/**
 * Load-test seed: 1,000 users with random portfolio values.
 *
 * Purpose: Populate the leaderboard with realistic data for P3-003 k6 tests
 * so the query planner is exercised under real cardinality.
 *
 * Safety guards:
 *   - Only runs when NODE_ENV === 'test' (enforced at the top of the file).
 *   - All generated users have the prefix `loadtest_` in username and
 *     `loadtest+...@stockplay-test.invalid` email so they are trivially
 *     identifiable and can be cleaned up with a single WHERE clause.
 *   - A single dedicated test login user (`loadtest@example.com`) is upserted
 *     for k6 scripts that need authentication.
 *
 * Usage:
 *   NODE_ENV=test tsx apps/api/src/db/seeds/load-test-users.seed.ts
 *   — or —
 *   pnpm db:seed:load-test
 *
 * Teardown:
 *   DELETE FROM users WHERE email LIKE '%@stockplay-test.invalid';
 */
import '../../../config/env'; // load .env before any db import
import { db } from '../../config/db';
import bcrypt from 'bcryptjs';

const BATCH_SIZE = 100;
const TOTAL_USERS = 1_000;

// Portfolio value range for seeded users: $50k – $200k
// Uniform random distribution gives a realistic leaderboard spread.
const MIN_VALUE = 50_000;
const MAX_VALUE = 200_000;

function randomPortfolioValue(): number {
  return Math.round((MIN_VALUE + Math.random() * (MAX_VALUE - MIN_VALUE)) * 100) / 100;
}

/**
 * Insert a batch of users + portfolios in a single transaction.
 * R-11: uses a single multi-row INSERT for all users in the batch, then
 * individual portfolio inserts using the returned IDs. This reduces round-trips
 * from 2×count to 1 + count per batch.
 * Returns the number of rows inserted.
 */
async function insertBatch(
  startIndex: number,
  count: number,
  passwordHash: string,
): Promise<number> {
  // Build multi-row VALUES clause for all users in this batch.
  const userValues: unknown[] = [];
  const userPlaceholders: string[] = [];
  const dob = new Date(2005, 0, 1).toISOString();

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const email = `loadtest+${idx}@stockplay-test.invalid`;
    const username = `loadtest_${idx}`;
    const base = i * 5; // 0-indexed: $1,$2,$3,$4,$5 for i=0, $6,$7,... for i=1, etc.
    userPlaceholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
    );
    userValues.push(email, username, passwordHash, 'student', dob);
  }

  await db.query('BEGIN');
  let inserted = 0;
  try {
    // Single multi-row INSERT for all users in the batch — O(1) round-trips vs O(n).
    const userResult = await db.query<{ id: string; email: string }>(
      `INSERT INTO users(email, username, password_hash, role, date_of_birth)
       VALUES ${userPlaceholders.join(', ')}
       ON CONFLICT(email) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, email`,
      userValues,
    );

    // Build a lookup map from email → id for portfolio inserts.
    const idByEmail = new Map<string, string>(
      userResult.rows.map((r) => [r.email, r.id]),
    );

    // Insert portfolios individually (IDs are now known; still O(n) but no nested BEGIN).
    for (let i = 0; i < count; i++) {
      const idx = startIndex + i;
      const email = `loadtest+${idx}@stockplay-test.invalid`;
      const userId = idByEmail.get(email);
      if (!userId) continue; // should not happen

      const portfolioValue = randomPortfolioValue();
      const returnPct = ((portfolioValue - 100_000) / 100_000) * 100;

      await db.query(
        `INSERT INTO portfolios(user_id, cash_balance, total_value, total_return_pct)
         VALUES($1, $2, $3, $4)
         ON CONFLICT(user_id) DO UPDATE
           SET total_value = EXCLUDED.total_value,
               total_return_pct = EXCLUDED.total_return_pct`,
        [userId, portfolioValue, portfolioValue, returnPct],
      );

      inserted++;
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
  return inserted;
}

export async function seedLoadTestUsers(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      '❌ seedLoadTestUsers must only run in NODE_ENV=test. ' +
        'This prevents accidental pollution of dev/prod databases.',
    );
  }

  console.log(`🌱 Seeding ${TOTAL_USERS} load-test users...`);

  // Hash once; reuse for all users (avoids bcrypt overhead × 1000)
  const passwordHash = await bcrypt.hash('LoadTest1234!', 10);

  // Upsert the shared k6 login user (used by all k6 scripts for authentication)
  const loginUserResult = await db.query<{ id: string }>(
    `INSERT INTO users(email, username, password_hash, role, date_of_birth)
     VALUES($1, $2, $3, $4, $5)
     ON CONFLICT(email) DO UPDATE SET username = EXCLUDED.username
     RETURNING id`,
    ['loadtest@example.com', 'loadtest_main', passwordHash, 'student', new Date(2005, 0, 1)],
  );
  const loginUserId = loginUserResult.rows[0].id;
  await db.query(
    `INSERT INTO portfolios(user_id, cash_balance, total_value, total_return_pct)
     VALUES($1, $2, $3, $4)
     ON CONFLICT(user_id) DO UPDATE SET total_value = EXCLUDED.total_value`,
    [loginUserId, 100_000, 100_000, 0],
  );
  console.log('  ✅ Shared k6 login user upserted (loadtest@example.com)');

  // Insert numbered users in batches
  let totalInserted = 0;
  const batches = Math.ceil(TOTAL_USERS / BATCH_SIZE);

  for (let b = 0; b < batches; b++) {
    const startIndex = b * BATCH_SIZE;
    const count = Math.min(BATCH_SIZE, TOTAL_USERS - startIndex);
    const inserted = await insertBatch(startIndex, count, passwordHash);
    totalInserted += inserted;
    console.log(`  Batch ${b + 1}/${batches}: ${inserted} users inserted (total: ${totalInserted})`);
  }

  console.log(`✅ Load-test seed complete: ${totalInserted} users + portfolios seeded.`);
  console.log('   Teardown: DELETE FROM users WHERE email LIKE \'%@stockplay-test.invalid\';');
}

// ── CLI entry point ────────────────────────────────────────────────────────────
// R-13: NODE_ENV guard removed here — seedLoadTestUsers() is the canonical
// enforcement point (it throws if NODE_ENV !== 'test'). Wrapping the call here
// too was redundant and prevented the function from surfacing its own error.
seedLoadTestUsers()
  .then(() => db.end())
  .catch((err) => {
    console.error('Load-test seed failed:', err);
    process.exit(1);
  });
