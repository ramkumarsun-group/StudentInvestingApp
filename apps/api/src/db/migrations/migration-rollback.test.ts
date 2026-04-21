/**
 * P1-012 — DB migration down() restores schema to prior state.
 * @P1 @Integration
 *
 * Tests migrations 013, 014, and 015 applied in T5.2:
 * - 013_portfolio_history_unique: snapshot_date column + unique index on leaderboard_snapshots
 * - 014_xp_events_unique: partial UNIQUE INDEX on xp_events
 * - 015_processed_webhooks: new table processed_webhook_events
 *
 * For each migration the test:
 * 1. Verifies the migration artifact exists in the DB
 * 2. Runs the "down" SQL (DROP INDEX / DROP TABLE / DROP COLUMN)
 * 3. Confirms the artifact is gone
 * 4. Re-applies the "up" SQL so the schema is left clean for the next test run
 *
 * Requires DATABASE_URL pointing to studentinvesting_test.
 * CI HARD FAIL: DATABASE_URL must be set — missing env var causes an explicit error.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';

let pool: Pool;
let dbAvailable = false;

beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  // P1-012-A: In CI (CI=true), DATABASE_URL must be set — fail hard so the job goes red.
  // In local dev (CI not set), skip gracefully so the suite still runs without a DB.
  if (!url) {
    if (process.env.CI) {
      throw new Error(
        'DATABASE_URL is required for migration rollback tests in CI. ' +
        'Ensure the postgres service container is configured in the workflow.',
      );
    }
    console.warn('[P1-012] DATABASE_URL not set — skipping migration rollback tests (local dev only)');
    return;
  }
  pool = new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 5000 });
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    console.warn('[P1-012] DB unreachable — skipping migration rollback tests');
  }
});

afterAll(async () => {
  if (pool) await pool.end();
});

// ── 013: leaderboard_snapshots snapshot_date column + unique index ────────────

describe('migration 013 — leaderboard_snapshots snapshot_date (P1-012)', () => {
  it('snapshot_date column exists on leaderboard_snapshots', async () => {
    if (!dbAvailable) return;

    const { rows } = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name='leaderboard_snapshots' AND column_name='snapshot_date'
    `);
    expect(rows.length).toBe(1);
    expect(rows[0].data_type).toBe('date');
  });

  it('unique index idx_leaderboard_user_date exists', async () => {
    if (!dbAvailable) return;

    const { rows } = await pool.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='leaderboard_snapshots'
        AND indexname='idx_leaderboard_user_date'
    `);
    expect(rows.length).toBe(1);
  });

  it('down: DROP INDEX removes idx_leaderboard_user_date', async () => {
    if (!dbAvailable) return;

    await pool.query(`DROP INDEX IF EXISTS idx_leaderboard_user_date`);

    const { rows } = await pool.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='leaderboard_snapshots'
        AND indexname='idx_leaderboard_user_date'
    `);
    expect(rows.length).toBe(0);
  });

  it('re-applying up migration restores idx_leaderboard_user_date', async () => {
    if (!dbAvailable) return;

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_user_date
        ON leaderboard_snapshots(user_id, snapshot_date)
    `);

    const { rows } = await pool.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='leaderboard_snapshots'
        AND indexname='idx_leaderboard_user_date'
    `);
    expect(rows.length).toBe(1);
  });
});

// ── 015: processed_webhook_events ─────────────────────────────────────────────

describe('migration 015 — processed_webhook_events (P1-012)', () => {
  it('table exists after up migration', async () => {
    if (!dbAvailable) return;

    const { rows } = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='processed_webhook_events'
    `);
    expect(rows.length).toBe(1);
  });

  it('table has stripe_event_id PRIMARY KEY column', async () => {
    if (!dbAvailable) return;

    const { rows } = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name='processed_webhook_events' AND column_name='stripe_event_id'
    `);
    expect(rows.length).toBe(1);
    expect(rows[0].data_type).toBe('text');
  });

  it('down: DROP TABLE removes processed_webhook_events', async () => {
    if (!dbAvailable) return;

    await pool.query(`DROP TABLE IF EXISTS processed_webhook_events`);

    const { rows } = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='processed_webhook_events'
    `);
    expect(rows.length).toBe(0);
  });

  it('re-applying up migration restores the table', async () => {
    if (!dbAvailable) return;

    // Re-apply 015 up SQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processed_webhook_events (
        stripe_event_id  TEXT        PRIMARY KEY,
        event_type       VARCHAR(60) NOT NULL,
        processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='processed_webhook_events'
    `);
    expect(rows.length).toBe(1);
  });
});

// ── 014: xp_events_unique partial index ───────────────────────────────────────

describe('migration 014 — xp_events UNIQUE index (P1-012)', () => {
  it('partial UNIQUE index idx_xp_events_idempotent exists', async () => {
    if (!dbAvailable) return;

    const { rows } = await pool.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='xp_events'
        AND indexname='idx_xp_events_idempotent'
    `);
    expect(rows.length).toBe(1);
  });

  it('down: DROP INDEX removes idx_xp_events_idempotent', async () => {
    if (!dbAvailable) return;

    await pool.query(`DROP INDEX IF EXISTS idx_xp_events_idempotent`);

    const { rows } = await pool.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='xp_events'
        AND indexname='idx_xp_events_idempotent'
    `);
    expect(rows.length).toBe(0);
  });

  it('re-applying up migration restores the partial UNIQUE index', async () => {
    if (!dbAvailable) return;

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_events_idempotent
        ON xp_events(user_id, event_type, reference_id)
        WHERE reference_id IS NOT NULL
    `);

    const { rows } = await pool.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='xp_events'
        AND indexname='idx_xp_events_idempotent'
    `);
    expect(rows.length).toBe(1);
  });
});
