ALTER TABLE users ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: only indexes minor accounts (used in Phase 2 parental visibility queries)
CREATE INDEX IF NOT EXISTS idx_users_is_minor ON users(is_minor) WHERE is_minor = TRUE;
