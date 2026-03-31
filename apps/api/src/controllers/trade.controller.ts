import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../config/db';
import { placeOrder } from '../services/trading/order.service';
import { awardXp } from '../services/gamification/xp.service';

const orderSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  assetType: z.enum(['stock', 'etf', 'crypto', 'bond']),
  side: z.enum(['buy', 'sell']),
  orderType: z.enum(['market', 'limit']).default('market'),
  quantity: z.number().positive(),
  limitPrice: z.number().positive().optional(),
});

export async function createOrder(req: Request, res: Response) {
  const body = orderSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten().fieldErrors });

  const portRes = await db.query(
    'SELECT id FROM portfolios WHERE user_id=$1 AND is_active=true',
    [req.user!.userId],
  );
  if (portRes.rows.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

  let order: Awaited<ReturnType<typeof placeOrder>>;
  try {
    order = await placeOrder({
      portfolioId: portRes.rows[0].id,
      ...body.data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('Insufficient cash')) {
      // CR-P5: parse available cash embedded by order.service (format "Insufficient cash: <n>")
      const cashStr = msg.split(': ')[1];
      const availableCash = cashStr !== undefined ? parseFloat(cashStr) : undefined;
      return res.status(422).json({
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient cash balance.',
          ...(availableCash !== undefined && !isNaN(availableCash) ? { availableCash } : {}),
        },
      });
    }
    if (msg.startsWith('No price available')) {
      return res.status(422).json({ error: { code: 'MARKET_DATA_UNAVAILABLE', message: 'Market data is unavailable. Please try again.' } });
    }
    if (msg === 'Portfolio not found') {
      return res.status(404).json({ error: { code: 'PORTFOLIO_NOT_FOUND', message: 'Portfolio not found.' } });
    }
    if (msg.startsWith('Insufficient holdings')) {
      // CR-P5: parse current quantity embedded by order.service (format "Insufficient holdings: <n>")
      const qtyStr = msg.split(': ')[1];
      const currentQuantity = qtyStr !== undefined ? parseFloat(qtyStr) : undefined;
      return res.status(422).json({
        error: {
          code: 'INSUFFICIENT_HOLDINGS',
          message: 'You do not have enough shares to sell.',
          ...(currentQuantity !== undefined && !isNaN(currentQuantity) ? { currentQuantity } : {}),
        },
      });
    }
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Order failed.' } });
  }

  // Award XP for first trade
  const tradeCount = await db.query(
    `SELECT COUNT(*) FROM orders o
     JOIN portfolios p ON p.id=o.portfolio_id
     WHERE p.user_id=$1 AND o.status='filled'`,
    [req.user!.userId],
  );
  if (parseInt(tradeCount.rows[0].count) === 1) {
    await awardXp(req.user!.userId, 'first_trade', 100, order.id);
  } else {
    await awardXp(req.user!.userId, 'trade_placed', 10, order.id);
  }

  return res.status(201).json({ data: order });
}

export async function getOrders(req: Request, res: Response) {
  const portRes = await db.query(
    'SELECT id FROM portfolios WHERE user_id=$1 AND is_active=true',
    [req.user!.userId],
  );
  if (portRes.rows.length === 0) return res.json({ data: [] });

  const { rows } = await db.query(
    'SELECT * FROM orders WHERE portfolio_id=$1 ORDER BY placed_at DESC LIMIT 100',
    [portRes.rows[0].id],
  );
  return res.json({ data: rows });
}

export async function cancelOrder(req: Request, res: Response) {
  const { orderId } = req.params;
  const portRes = await db.query(
    'SELECT id FROM portfolios WHERE user_id=$1 AND is_active=true',
    [req.user!.userId],
  );
  if (portRes.rows.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

  const { rows } = await db.query(
    `UPDATE orders SET status='cancelled' WHERE id=$1 AND portfolio_id=$2 AND status='pending' RETURNING *`,
    [orderId, portRes.rows[0].id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Order not found or cannot be cancelled' });
  return res.json({ data: rows[0] });
}
