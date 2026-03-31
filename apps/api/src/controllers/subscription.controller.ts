import { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env';
import { db } from '../config/db';

const stripe = new Stripe(env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

export async function createCheckout(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { rows } = await db.query('SELECT email FROM users WHERE id=$1', [userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: rows[0].email,
    line_items: [{ price: env.STRIPE_STUDENT_PRO_PRICE_ID, quantity: 1 }],
    success_url: `${env.WEB_URL}/settings?subscription=success`,
    cancel_url: `${env.WEB_URL}/settings?subscription=cancelled`,
    metadata: { userId },
  });

  return res.json({ data: { url: session.url } });
}

export async function createPortalSession(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { rows } = await db.query(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id=$1 AND status='active' LIMIT 1`,
    [userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'No active subscription' });

  const session = await stripe.billingPortal.sessions.create({
    customer: rows[0].stripe_customer_id,
    return_url: `${env.WEB_URL}/settings`,
  });
  return res.json({ data: { url: session.url } });
}

export async function getStatus(req: Request, res: Response) {
  const { rows } = await db.query(
    `SELECT plan, status, current_period_end FROM subscriptions
     WHERE user_id=$1 AND status='active' LIMIT 1`,
    [req.user!.userId],
  );
  return res.json({
    data: rows[0] ?? { plan: 'free', status: 'inactive', current_period_end: null },
  });
}

export async function handleWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET || '');
  } catch {
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId || !session.subscription) break;

      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      await db.query(
        `INSERT INTO subscriptions(user_id, plan, status, stripe_sub_id, stripe_customer_id, current_period_start, current_period_end)
         VALUES($1,'student_pro','active',$2,$3,to_timestamp($4),to_timestamp($5))
         ON CONFLICT(stripe_sub_id) DO UPDATE
         SET status='active', current_period_start=to_timestamp($4), current_period_end=to_timestamp($5)`,
        [userId, sub.id, sub.customer, sub.current_period_start, sub.current_period_end],
      );
      break;
    }
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await db.query(
        `UPDATE subscriptions SET status=$1, cancelled_at=$2 WHERE stripe_sub_id=$3`,
        [
          sub.status === 'active' ? 'active' : 'cancelled',
          sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
          sub.id,
        ],
      );
      break;
    }
  }

  return res.json({ received: true });
}
