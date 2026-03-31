import cron from 'node-cron';
import { refreshLeaderboard } from '../controllers/leaderboard.controller';
import { resetMissedStreaks } from '../services/gamification/streak.service';
import { db } from '../config/db';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { getCachedQuote } from '../services/market/market-cache.service';

// Refresh leaderboard every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await refreshLeaderboard();
    logger.debug('Leaderboard refreshed');
  } catch (err) {
    logger.error('Leaderboard refresh failed', { err });
  }
});

// Reset missed streaks at midnight UTC
cron.schedule('0 0 * * *', async () => {
  try {
    await resetMissedStreaks();
    logger.info('Streak reset job completed');
  } catch (err) {
    logger.error('Streak reset failed', { err });
  }
});

// Update holding prices hourly
cron.schedule('0 * * * *', async () => {
  try {
    const { rows: holdings } = await db.query(
      'SELECT DISTINCT symbol, asset_type FROM holdings',
    );
    for (const h of holdings) {
      const quote = await getCachedQuote(h.symbol, h.asset_type);
      if (!quote) continue;
      await db.query(
        `UPDATE holdings SET current_price=$1,
           market_value=quantity*$1,
           unrealized_pnl=quantity*$1 - quantity*avg_cost_basis,
           unrealized_pnl_pct=((quantity*$1 - quantity*avg_cost_basis) / (quantity*avg_cost_basis))*100,
           updated_at=NOW()
         WHERE symbol=$2`,
        [quote.price, h.symbol],
      );
    }

    // Recalculate portfolio totals
    await db.query(`
      UPDATE portfolios p SET
        total_value = p.virtual_cash + COALESCE((
          SELECT SUM(market_value) FROM holdings WHERE portfolio_id=p.id
        ), 0),
        total_return_pct = ((p.virtual_cash + COALESCE((
          SELECT SUM(market_value) FROM holdings WHERE portfolio_id=p.id
        ), 0) - 100000) / 100000) * 100,
        updated_at = NOW()
    `);

    logger.info('Holdings prices updated');
  } catch (err) {
    logger.error('Holdings price update failed', { err });
  }
});

// Activate/complete challenges hourly
cron.schedule('0 * * * *', async () => {
  try {
    await db.query(
      `UPDATE challenges SET status='active' WHERE status='scheduled' AND starts_at <= NOW()`,
    );
    await db.query(
      `UPDATE challenges SET status='completed' WHERE status='active' AND ends_at <= NOW()`,
    );
  } catch (err) {
    logger.error('Challenge status update failed', { err });
  }
});

// Snapshot portfolio values at market close (21:00 UTC = 4pm ET, weekdays)
cron.schedule('0 21 * * 1-5', async () => {
  try {
    const { rows: portfolios } = await db.query(
      'SELECT p.id, p.user_id, p.total_value, p.total_return_pct, u.username, u.avatar_url FROM portfolios p JOIN users u ON u.id=p.user_id WHERE p.is_active=true',
    );
    for (const p of portfolios) {
      await db.query(
        // snapshot_date is an explicit DATE column (migration 013) — avoids the
        // TIMESTAMPTZ→date expression index which PostgreSQL rejects as non-IMMUTABLE.
        `INSERT INTO leaderboard_snapshots(user_id, username, avatar_url, portfolio_value, return_pct, snapshot_date)
         VALUES($1,$2,$3,$4,$5,CURRENT_DATE)
         ON CONFLICT (user_id, snapshot_date) DO NOTHING`,
        [p.user_id, p.username, p.avatar_url, p.total_value, p.total_return_pct],
      );
    }
    logger.info('Portfolio history snapshots created', { count: portfolios.length });
  } catch (err) {
    logger.error('Portfolio snapshot job failed', { err });
  }
});

logger.info('Background jobs scheduled');
