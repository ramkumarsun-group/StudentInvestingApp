CREATE TABLE IF NOT EXISTS holdings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id       UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol             VARCHAR(20) NOT NULL,
  asset_type         VARCHAR(10) NOT NULL,
  quantity           NUMERIC(18,8) NOT NULL,
  avg_cost_basis     NUMERIC(14,4) NOT NULL,
  current_price      NUMERIC(14,4),
  market_value       NUMERIC(14,2),
  unrealized_pnl     NUMERIC(14,2),
  unrealized_pnl_pct NUMERIC(8,4),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON holdings(portfolio_id);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  symbol          VARCHAR(20) NOT NULL,
  asset_type      VARCHAR(10) NOT NULL,
  price           NUMERIC(14,4) NOT NULL,
  volume          BIGINT,
  market_cap      NUMERIC(20,2),
  change_pct_24h  NUMERIC(8,4),
  snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_symbol_time ON price_snapshots(symbol, snapshotted_at DESC);
