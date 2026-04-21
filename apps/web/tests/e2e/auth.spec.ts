import { test, expect } from '@playwright/test';
import { createStudent } from '../fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * P0-001 — Student can log in with valid credentials and reach dashboard.
 * @P0 @E2E @Auth
 */
test('@P0 @E2E @Auth student can log in with valid credentials and reach dashboard', async ({
  page,
  request,
}) => {
  const student = createStudent();
  // Declare email as a const BEFORE the try block so the finally block can
  // always reference it, regardless of what happened during the test (R-03).
  const studentEmail = student.email;

  // Seed
  const seedRes = await request.post(`${API_BASE}/test/seed`, {
    data: { users: [student] },
  });
  expect(seedRes.status()).toBe(201);

  try {
    // Navigate to login page
    await page.goto('/login');

    // Fill credentials
    await page.getByTestId('email').fill(studentEmail);
    await page.getByTestId('password').fill(student.password);
    await page.getByTestId('login-button').click();

    // Assert redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10_000 });

    // Assert portfolio balance visible ($100,000 starting balance)
    await expect(page.getByText(/100,000/)).toBeVisible({ timeout: 5_000 });

    // R-09: Assert that an access token was stored in localStorage after login
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).not.toBeNull();
  } finally {
    await request.delete(`${API_BASE}/test/teardown`, {
      data: { email: studentEmail },
    });
  }
});
