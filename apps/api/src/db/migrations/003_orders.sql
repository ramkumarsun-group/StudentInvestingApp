CREATE TABLE IF NOT EXISTS orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id   UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol         VARCHAR(20) NOT NULL,
  asset_type     VARCHAR(10) NOT NULL,
  side           VARCHAR(4) NOT NULL,
  order_type     VARCHAR(10) NOT NULL DEFAULT 'market',
  quantity       NUMERIC(18,8) NOT NULL,
  limit_price    NUMERIC(14,4),
  fill_price     NUMERIC(14,4),
  fill_quantity  NUMERIC(18,8),
  status         VARCHAR(12) NOT NULL DEFAULT 'pending',
  total_value    NUMERIC(14,2),
  commission     NUMERIC(8,4) NOT NULL DEFAULT 0,
  error_message  TEXT,
  placed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filled_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_portfolio ON orders(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed ON orders(placed_at DESC);
