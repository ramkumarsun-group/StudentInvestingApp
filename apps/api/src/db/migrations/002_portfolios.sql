CREATE TABLE IF NOT EXISTS portfolios (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL DEFAULT 'My Portfolio',
  virtual_cash      INTEGER NOT NULL DEFAULT 10000000,
  total_value       INTEGER NOT NULL DEFAULT 10000000,
  total_return_pct  NUMERIC(8,4) NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
