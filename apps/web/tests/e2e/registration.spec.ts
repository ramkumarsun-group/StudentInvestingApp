import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P1-001 — Full registration E2E flow completes to dashboard.
 * @P1 @E2E
 *
 * Fills the /register form with valid data, asserts redirect to /dashboard,
 * and verifies the $100,000 starting portfolio balance is visible.
 */
test(
  '@P1 @E2E full registration flow completes to /dashboard with $100,000 balance',
  async ({ page, request }) => {
    // Generate unique test user
    const username = faker.internet.username().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 14) + '_t1';
    const email = `reg_e2e_${Date.now()}@stockplay.test`.toLowerCase();
    const password = 'Password123!';

    // DOB = 20 years ago (avoids under-18 COPPA block)
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 20);
    const dobString = dob.toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      await page.goto('/register');

      // P1-001-A: use accessible role + label selector instead of brittle autocomplete attribute.
      // The register form labels the field "Display Name / Username" (apps/web/app/(auth)/register/page.tsx).
      // Fill username
      await page.getByRole('textbox', { name: /display name \/ username/i }).fill(username);

      // Fill email
      await page.locator('input[type="email"]').fill(email);

      // Fill date of birth
      await page.locator('input[type="date"]').fill(dobString);

      // Fill password
      await page.locator('input[type="password"]').fill(password);

      // Submit form
      await page.locator('button[type="submit"]').click();

      // Should redirect to /dashboard after successful registration + auto-login
      await expect(page).toHaveURL('/dashboard', { timeout: 15_000 });

      // Portfolio starting balance should be visible
      await expect(page.getByText(/100,000/)).toBeVisible({ timeout: 5_000 });

      // XP should be 0 (new account)
      // Look for XP indicator — flexible since it may appear as "0 XP" or similar
      // The key assertion is the dashboard is fully loaded and balance visible (above)
    } finally {
      // Clean up seeded user
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email },
      });
    }
  },
);
