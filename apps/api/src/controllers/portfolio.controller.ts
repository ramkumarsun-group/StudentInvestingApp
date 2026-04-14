import { Request, Response } from 'express';
import { db } from '../config/db';
import { getCachedQuote } from '../services/market/market-cache.service';
import { calcPnl } from '@student-investing/shared-utils';

export async function getPortfolio(req: Request, res: Response) {
  const { rows } = await db.query(
    `SELECT p.*, u.username FROM portfolios p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id=$1 AND p.is_active=true`,
    [req.user!.userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Portfolio not found' });
  return res.json({ data: rows[0] });
}

export async function getHoldings(req: Request, res: Response) {
  const portRes = await db.query(
    'SELECT id FROM portfolios WHERE user_id=$1 AND is_active=true',
    [req.user!.userId],
  );
  if (portRes.rows.length === 0) return res.status(404).json({ error: 'Portfolio not found' });
  const portfolioId = portRes.rows[0].id;

  const { rows: holdings } = await db.query(
    'SELECT * FROM holdings WHERE portfolio_id=$1 ORDER BY market_value DESC',
    [portfolioId],
  );

  // Refresh prices
  const updated = await Promise.all(
    holdings.map(async (h) => {
      const quote = await getCachedQuote(h.symbol, h.asset_type);
      if (!quote) return h;
      const { marketValue, unrealizedPnl, unrealizedPnlPct } = calcPnl(
        quote.price,
        parseFloat(h.avg_cost_basis),
        parseFloat(h.quantity),
      );
      return {
        ...h,
        current_price: quote.price,
        market_value: marketValue,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_pct: unrealizedPnlPct,
      };
    }),
  );

  return res.json({ data: updated });
}

export async function getPortfolioHistory(req: Request, res: Response) {
  const portRes = await db.query(
    'SELECT id FROM portfolios WHERE user_id=$1 AND is_active=true',
    [req.user!.userId],
  );
  if (portRes.rows.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

  const { rows } = await db.query(
    `SELECT portfolio_value, return_pct, snapshotted_at as date
     FROM leaderboard_snapshots WHERE user_id=$1
     ORDER BY snapshotted_at ASC LIMIT 365`,
    [req.user!.userId],
  );
  return res.json({ data: rows });
}

export async function resetPortfolio(req: Request, res: Response) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const portRes = await client.query(
      'SELECT id FROM portfolios WHERE user_id=$1 AND is_active=true',
      [req.user!.userId],
    );
    if (portRes.rows.length === 0) {
      // CR-P2: ROLLBACK before early return — releasing a connection with an open
      // transaction is undefined behaviour in pg; the pool could hand it to the next
      // caller with a stale transaction still active.
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    const portfolioId = portRes.rows[0].id;

    // T1.14 Task 1: clear orders first (FK on portfolio_id), then holdings, then snapshots
    await client.query('DELETE FROM orders WHERE portfolio_id=$1', [portfolioId]);
    await client.query('DELETE FROM holdings WHERE portfolio_id=$1', [portfolioId]);
    await client.query(
      'DELETE FROM leaderboard_snapshots WHERE user_id=$1',
      [req.user!.userId],
    );
    await client.query(
      `UPDATE portfolios SET virtual_cash=100000, total_value=100000, total_return_pct=0, updated_at=NOW()
       WHERE id=$1`,
      [portfolioId],
    );
    await client.query('COMMIT');
    return res.json({ data: { message: 'Portfolio reset to $100,000' } });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
