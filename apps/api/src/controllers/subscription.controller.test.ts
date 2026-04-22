/**
 * P0-008 — Stripe webhook replay protection (unit test).
 * @P0 @Security
 *
 * Verifies that the handleWebhook controller:
 * 1. Returns 200 immediately when a stripe_event_id is already in processed_webhook_events
 * 2. Inserts a new event and processes it when unseen
 * 3. Does not double-update subscriptions on replay
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../config/db', () => ({
  db: { query: vi.fn() },
}));

vi.mock('../config/env', () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_SECRET_KEY: 'sk_test',
  },
}));

vi.mock('stripe', () => {
  const mockStripe = {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  };
  return { default: vi.fn(() => mockStripe) };
});

import { handleWebhook } from './subscription.controller';
import { db } from '../config/db';
import Stripe from 'stripe';

const stripe = new (Stripe as unknown as new (key: string) => typeof Stripe.prototype)('sk_test');

let mockRes: Response;

function makeWebhookReq(body: unknown = {}, sig = 'test-sig'): Request {
  return {
    body,
    headers: { 'stripe-signature': sig },
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
});

describe('handleWebhook — replay protection (P0-008)', () => {
  it('returns 200 without processing when event_id already in processed_webhook_events', async () => {
    const eventId = 'evt_already_processed_123';

    // Stripe signature verification succeeds
    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
      id: eventId,
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123', status: 'active', canceled_at: null } },
    });

    // DB query for idempotency check returns a row (already processed)
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ 1: 1 }] } as never); // already processed

    await handleWebhook(makeWebhookReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ received: true });

    // Should NOT have made a second DB call to update the subscription
    expect(vi.mocked(db.query)).toHaveBeenCalledTimes(1);
  });

  it('processes event and records it when event_id is new', async () => {
    const eventId = 'evt_new_event_456';

    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
      id: eventId,
      type: 'customer.subscription.updated',
      data: {
        object: { id: 'sub_456', status: 'active', canceled_at: null },
      },
    });

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [] } as never)   // not yet processed
      .mockResolvedValueOnce({ rows: [] } as never)   // UPDATE subscriptions
      .mockResolvedValueOnce({ rows: [] } as never);  // INSERT processed_webhook_events

    await handleWebhook(makeWebhookReq(), mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ received: true });

    // Should have made 3 DB calls: check + update subscription + record event
    expect(vi.mocked(db.query)).toHaveBeenCalledTimes(3);

    // Last call should be INSERT into processed_webhook_events
    const lastCall = vi.mocked(db.query).mock.calls[2];
    expect(lastCall[0]).toContain('INSERT INTO processed_webhook_events');
    expect(lastCall[1]).toContain(eventId);
  });

  it('returns 400 when Stripe signature verification fails', async () => {
    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Signature mismatch');
    });

    await handleWebhook(makeWebhookReq(), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Webhook signature verification failed',
    });
    // No DB calls should have been made
    expect(vi.mocked(db.query)).not.toHaveBeenCalled();
  });
});
