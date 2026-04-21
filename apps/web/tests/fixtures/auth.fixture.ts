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

    await use(student);

    // Teardown — runs even if test fails
    await request.delete(`${API_BASE}/test/teardown`, {
      data: { email: student.email },
    });
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
 * Logs in with credentials and stores cookies/localStorage to playwright/.auth/student.json.
 */
export async function setupStudentStorageState(
  request: APIRequestContext,
  baseURL: string,
): Promise<void> {
  const student = createStudent({ email: 'e2e-fixture@stockplay.test' });

  // Ensure fixture user exists (seed is idempotent — returns 200 if user exists)
  const seedRes = await request.post(`${API_BASE}/test/seed`, {
    data: { users: [student] },
  });
  if (seedRes.status() !== 201 && seedRes.status() !== 200) {
    throw new Error(`Auth setup seed failed: ${await seedRes.text()}`);
  }
}
