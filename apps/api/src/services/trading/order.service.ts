import { db } from '../../config/db';
import { getCachedQuote } from '../market/market-cache.service';
import { calcWeightedAvgCost, calcPnl } from '@student-investing/shared-utils';
import { AssetType, OrderSide, OrderType } from '@student-investing/shared-types';

const SPREAD_PCT = 0.001; // 0.1% simulated spread

interface PlaceOrderInput {
  portfolioId: string;
  symbol: string;
  assetType: AssetType;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  limitPrice?: number;
}

export async function placeOrder(input: PlaceOrderInput) {
  const { portfolioId, symbol, assetType, side, orderType, quantity, limitPrice } = input;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const portRes = await client.query(
      'SELECT virtual_cash FROM portfolios WHERE id=$1 FOR UPDATE',
      [portfolioId],
    );
    if (portRes.rows.length === 0) throw new Error('Portfolio not found');
    const portfolio = portRes.rows[0];

    let fillPrice: number | null = null;
    let status = 'pending';

    if (orderType === 'market') {
      const quote = await getCachedQuote(symbol, assetType);
      if (!quote) throw new Error(`No price available for ${symbol}`);
      fillPrice = side === 'buy'
        ? quote.price * (1 + SPREAD_PCT)
        : quote.price * (1 - SPREAD_PCT);
      status = 'filled';
    } else {
      fillPrice = limitPrice ?? null;
      // Limit orders sit as pending — filled by price-snapshot job
    }

    const totalValue = fillPrice ? fillPrice * quantity : 0;

    if (status === 'filled' && side === 'buy') {
      if (portfolio.virtual_cash < totalValue) {
        // CR-P5: embed available cash so controller can include it in the API error response
        throw new Error(`Insufficient cash: ${portfolio.virtual_cash}`);
      }
    }

    // P-1 fix: validate sell eligibility BEFORE inserting the order row.
    // Moving this check here avoids writing an order to the DB that will
    // immediately be rolled back, and satisfies the spec intent.
    // CR-P1: FOR UPDATE (not FOR SHARE) — serialises concurrent sell requests
    // against the same holding row, preventing two parallel sells from both
    // passing the quantity check against the same balance.
    if (status === 'filled' && side === 'sell') {
      const holding = await client.query(
        'SELECT quantity FROM holdings WHERE portfolio_id=$1 AND symbol=$2 FOR UPDATE',
        [portfolioId, symbol],
      );
      if (holding.rows.length === 0 || holding.rows[0].quantity < quantity) {
        // CR-P5: embed current quantity in message so controller can surface it in API response
        const currentQty = holding.rows[0]?.quantity ?? 0;
        throw new Error(`Insufficient holdings: ${currentQty}`);
      }
    }

    // Insert order
    const orderRes = await client.query(
      `INSERT INTO orders(portfolio_id, symbol, asset_type, side, order_type, quantity, limit_price, fill_price, fill_quantity, status, total_value, filled_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        portfolioId, symbol, assetType, side, orderType, quantity, limitPrice ?? null,
        fillPrice, status === 'filled' ? quantity : null, status, totalValue,
        status === 'filled' ? new Date() : null,
      ],
    );
    const order = orderRes.rows[0];

    if (status === 'filled') {
      await applyFilledOrder(client, portfolioId, order);
    }

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function applyFilledOrder(client: import('pg').PoolClient, portfolioId: string, order: Record<string, number | string>) {
  const { symbol, asset_type, side, fill_price, fill_quantity, total_value } = order as {
    symbol: string; asset_type: string; side: string;
    fill_price: number; fill_quantity: number; total_value: number;
  };

  if (side === 'buy') {
    // Deduct cash
    await client.query(
      'UPDATE portfolios SET virtual_cash = virtual_cash - $1, updated_at=NOW() WHERE id=$2',
      [total_value, portfolioId],
    );
    // Upsert holding
    const existing = await client.query(
      'SELECT quantity, avg_cost_basis FROM holdings WHERE portfolio_id=$1 AND symbol=$2',
      [portfolioId, symbol],
    );
    if (existing.rows.length > 0) {
      const { quantity: existQty, avg_cost_basis: existAvg } = existing.rows[0];
      const newAvg = calcWeightedAvgCost(existQty, existAvg, fill_quantity, fill_price);
      await client.query(
        `UPDATE holdings SET quantity=quantity+$1, avg_cost_basis=$2, current_price=$3,
         market_value=(quantity+$1)*$3, updated_at=NOW()
         WHERE portfolio_id=$4 AND symbol=$5`,
        [fill_quantity, newAvg, fill_price, portfolioId, symbol],
      );
    } else {
      const mv = fill_quantity * fill_price;
      await client.query(
        `INSERT INTO holdings(portfolio_id, symbol, asset_type, quantity, avg_cost_basis, current_price, market_value, unrealized_pnl, unrealized_pnl_pct)
         VALUES($1,$2,$3,$4,$5,$6,$7,0,0)`,
        [portfolioId, symbol, asset_type, fill_quantity, fill_price, fill_price, mv],
      );
    }
  } else {
    // Sell: add cash, reduce holding
    await client.query(
      'UPDATE portfolios SET virtual_cash = virtual_cash + $1, updated_at=NOW() WHERE id=$2',
      [total_value, portfolioId],
    );
    const existing = await client.query(
      'SELECT quantity, avg_cost_basis FROM holdings WHERE portfolio_id=$1 AND symbol=$2',
      [portfolioId, symbol],
    );
    if (existing.rows.length > 0) {
      const newQty = existing.rows[0].quantity - fill_quantity;
      if (newQty <= 0) {
        await client.query('DELETE FROM holdings WHERE portfolio_id=$1 AND symbol=$2', [portfolioId, symbol]);
      } else {
        await client.query(
          `UPDATE holdings SET quantity=$1, market_value=$1*$2, updated_at=NOW()
           WHERE portfolio_id=$3 AND symbol=$4`,
          [newQty, fill_price, portfolioId, symbol],
        );
      }
    }
  }

  // Recalculate portfolio total value
  const holdingsRes = await client.query(
    'SELECT COALESCE(SUM(market_value), 0) AS invested_value FROM holdings WHERE portfolio_id=$1',
    [portfolioId],
  );
  const investedValue = parseFloat(holdingsRes.rows[0].invested_value);
  const cashRes = await client.query('SELECT virtual_cash FROM portfolios WHERE id=$1', [portfolioId]);
  const totalValue = investedValue + parseFloat(cashRes.rows[0].virtual_cash);
  const returnPct = ((totalValue - 100000) / 100000) * 100;

  await client.query(
    'UPDATE portfolios SET total_value=$1, total_return_pct=$2, updated_at=NOW() WHERE id=$3',
    [totalValue, returnPct, portfolioId],
  );
}
