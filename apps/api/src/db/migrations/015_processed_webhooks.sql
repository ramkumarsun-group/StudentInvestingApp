-- Migration 015: Stripe webhook idempotency table
-- Prevents replay attacks by tracking processed Stripe event IDs

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  stripe_event_id  TEXT        PRIMARY KEY,
  event_type       VARCHAR(60) NOT NULL,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
