-- Leaderboard is primarily served from Redis sorted sets.
-- This table stores historical snapshots for persistence.

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username        VARCHAR(50) NOT NULL,
  avatar_url      TEXT,
  current_level   INTEGER NOT NULL DEFAULT 1,
  portfolio_value NUMERIC(14,2) NOT NULL DEFAULT 100000,
  return_pct      NUMERIC(8,4) NOT NULL DEFAULT 0,
  snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_return ON leaderboard_snapshots(return_pct DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user_time ON leaderboard_snapshots(user_id, snapshotted_at DESC);
