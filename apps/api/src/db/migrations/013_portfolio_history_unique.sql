-- Add an explicit date column so the unique index avoids a TIMESTAMPTZ→date
-- expression, which PostgreSQL rejects as non-IMMUTABLE.
ALTER TABLE leaderboard_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Back-fill any existing rows (safe to run on empty table too)
UPDATE leaderboard_snapshots
  SET snapshot_date = snapshotted_at::date
  WHERE snapshot_date = CURRENT_DATE AND snapshotted_at::date != CURRENT_DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_user_date
  ON leaderboard_snapshots(user_id, snapshot_date);
