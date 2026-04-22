-- Migration 014: Add idempotency constraint to xp_events
-- Prevents duplicate XP awards for the same reference_id (e.g., same order ID)
-- Partial index: only applies when reference_id is NOT NULL

CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_events_idempotent
  ON xp_events(user_id, event_type, reference_id)
  WHERE reference_id IS NOT NULL;
