import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';
const PRO_MODULE_SLUG = 'e2e-test-pro-module';

/**
 * P0-007 — Pro module returns 403 for free-tier student.
 * @P0 @Integration @Security
 *
 * Seeds a Pro-gated module via the test seed endpoint,
 * then verifies a free-tier student gets 403.
 */
test(
  '@P0 @Integration @Security Pro module returns 403 for free-tier student',
  async ({ request }) => {
    const student = createStudent();

    // Seed user + a Pro-gated test module
    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: { users: [student], proModuleSlug: PRO_MODULE_SLUG },
    });
    // R-08: Verify seed succeeded (2xx) before proceeding — prevents vacuous 403 test
    expect(seedRes.status()).toBeGreaterThanOrEqual(200);
    expect(seedRes.status()).toBeLessThan(300);

    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: student.email, password: student.password },
    });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;

    try {
      // Free-tier student attempts to access Pro-gated module
      const moduleRes = await request.get(`${API_BASE}/learn/modules/${PRO_MODULE_SLUG}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(moduleRes.status()).toBe(403);
      const body = await moduleRes.json();
      // R-08: Assert 403 body references Pro/subscription (case-insensitive) — not a generic error
      const errorText: string =
        typeof body.error === 'string' ? body.error : JSON.stringify(body);
      expect(errorText.toLowerCase()).toMatch(/pro|subscription/);
    } finally {
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email, proModuleSlug: PRO_MODULE_SLUG },
      });
    }
  },
);
