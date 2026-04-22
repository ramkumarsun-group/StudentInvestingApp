import { test } from '@playwright/test';

/**
 * P0-008 — Stripe webhook replay protection (integration).
 * @P0 @Integration @Security
 *
 * Full end-to-end integration testing of the Stripe webhook replay path
 * requires a valid HMAC signature, which in turn requires the Stripe CLI
 * (`stripe listen --forward-to localhost:4000/api/v1/subscriptions/webhook`).
 *
 * The production webhook handler (`apps/api/src/controllers/subscription.controller.ts`)
 * always calls `stripe.webhooks.constructEvent()` and throws on bad signatures —
 * there is no NODE_ENV=test bypass for HMAC in the current implementation, and
 * adding one would be a non-trivial production-code change.
 *
 * Unit-level coverage (mocking Stripe + db) is provided by:
 *   apps/api/src/controllers/subscription.controller.test.ts
 *
 * That unit test covers:
 *   1. Returns 200 immediately when event_id is already in processed_webhook_events
 *   2. Processes and records new events correctly (3 DB calls)
 *   3. Returns 400 when Stripe signature verification fails
 *
 * To run a real end-to-end replay test locally:
 *   stripe listen --forward-to http://localhost:4000/api/v1/subscriptions/webhook
 *   stripe trigger customer.subscription.updated
 *   # Then replay via: stripe events resend <evt_id>
 */
test.skip(
  '@P0 @Integration @Security Stripe webhook replay returns 200 without re-processing',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  () => {},
  // Requires Stripe CLI for HMAC-signed test events.
  // See apps/api/src/controllers/subscription.controller.test.ts for unit coverage.
);
