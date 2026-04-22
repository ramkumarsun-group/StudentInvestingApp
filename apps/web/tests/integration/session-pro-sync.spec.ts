import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P1-006 — Session reflects isPro after Stripe webhook.
 * @P1 @Integration
 *
 * Seeds a student with an active Pro subscription (bypassing Stripe checkout
 * by directly inserting the subscription record via the extended seed API).
 * Verifies that login returns a JWT with isPro: true in the decoded payload.
 *
 * The JWT isPro field is set at token issuance by querying the subscriptions table,
 * so a fresh login after the subscription record is inserted proves the sync works.
 */
test(
  '@P1 @Integration isPro is true in JWT after active subscription is seeded',
  async ({ request }) => {
    const student = createStudent();

    // Seed student WITH an active Pro subscription
    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: { users: [{ ...student, isPro: true }] },
    });
    expect(seedRes.status()).toBe(201);

    try {
      // Login — auth controller calls getIsPro() which checks subscriptions table
      const loginRes = await request.post(`${API_BASE}/auth/login`, {
        data: { email: student.email, password: student.password },
      });
      expect(loginRes.status()).toBe(200);
      const { data } = await loginRes.json();
      const { accessToken } = data;
      expect(typeof accessToken).toBe('string');

      // Decode the JWT payload (middle segment, base64url-encoded)
      const payloadB64 = accessToken.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf-8'),
      ) as { userId: string; role: string; isPro: boolean };

      expect(payload.isPro).toBe(true);

      // Verify session endpoint also reflects Pro status
      // P1-006-A: assert status 200 strictly — a 404 means GET /auth/session is
      // missing and must be implemented, not silently ignored.
      const sessionRes = await request.get(`${API_BASE}/auth/session`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(sessionRes.status()).toBe(200);
      const sessionData = (await sessionRes.json()).data ?? await sessionRes.json();
      expect(sessionData.isPro ?? sessionData.user?.isPro).toBe(true);
    } finally {
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email },
      });
    }
  },
);
