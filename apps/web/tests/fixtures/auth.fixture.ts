import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { createStudent, type StudentPayload } from './factories';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

export interface AuthFixtures {
  student: StudentPayload;
  studentToken: string;
  apiWithAuth: APIRequestContext;
}

/**
 * Extended test with student auth fixtures.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth.fixture';
 *
 *   test('my test', async ({ page, student, studentToken }) => { ... });
 *
 * The student is seeded before the test and torn down after, even on failure.
 */
export const test = base.extend<AuthFixtures>({
  student: async ({ request }, use) => {
    const student = createStudent();

    // Seed user via test-only endpoint
    const seedRes = await request.post(`${API_BASE}/test/seed`, {
      data: { users: [student] },
    });
    expect(seedRes.status(), `Seed failed: ${await seedRes.text()}`).toBe(201);

    // P-04: try/finally ensures teardown runs even if use() throws (Dev Notes requirement)
    try {
      await use(student);
    } finally {
      // Teardown — always runs, even on test failure
      await request.delete(`${API_BASE}/test/teardown`, {
        data: { email: student.email },
      });
    }
  },

  studentToken: async ({ request, student }, use) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: student.email, password: student.password },
    });
    expect(loginRes.status(), `Login failed: ${await loginRes.text()}`).toBe(200);

    const body = await loginRes.json();
    await use(body.data?.accessToken as string);
  },

  apiWithAuth: async ({ playwright, studentToken }, use) => {
    const context = await playwright.request.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: {
        Authorization: `Bearer ${studentToken}`,
      },
    });
    await use(context);
    await context.dispose();
  },
});

export { expect } from '@playwright/test';

/**
 * Auth setup helper — called from auth.setup.ts to persist storageState.
 * Seeds the fixture student if not already present.
 * P-09: removed unused `baseURL` param — API base is always resolved from PLAYWRIGHT_API_URL env var (API_BASE constant).
 */
export async function setupStudentStorageState(
  request: APIRequestContext,
): Promise<void> {
  const student = createStudent({ email: 'e2e-fixture@stockplay.test' });

  // Ensure fixture user exists (seed is idempotent — returns 201 whether new or existing)
  const seedRes = await request.post(`${API_BASE}/test/seed`, {
    data: { users: [student] },
  });
  if (seedRes.status() !== 201) {
    throw new Error(`Auth setup seed failed (${seedRes.status()}): ${await seedRes.text()}`);
  }
}
