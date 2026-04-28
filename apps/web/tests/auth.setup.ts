import { test as setup, expect } from '@playwright/test';
import { createStudent } from './fixtures/factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';
const STORAGE_STATE = 'playwright/.auth/student.json';

/**
 * Auth setup — runs once before all tests.
 * Seeds a stable fixture student and logs in via the credentials form,
 * saving storageState to playwright/.auth/student.json.
 */
setup('authenticate as student', async ({ page, request }) => {
  const student = createStudent({ email: 'e2e-fixture@stockplay.test' });

  // Seed fixture user (idempotent — always returns 201 whether new or existing)
  // P-13: removed dead 200 check — the seed endpoint always returns 201
  const seedRes = await request.post(`${API_BASE}/test/seed`, {
    data: { users: [student] },
  });
  expect(seedRes.status()).toBe(201);

  // Log in via UI to capture full storageState (cookies + localStorage)
  await page.goto('/login');
  await page.getByTestId('email').fill(student.email);
  await page.getByTestId('password').fill(student.password);
  await page.getByTestId('login-button').click();

  await page.waitForURL('/dashboard', { timeout: 10_000 });

  // Save authenticated state
  await page.context().storageState({ path: STORAGE_STATE });
});
