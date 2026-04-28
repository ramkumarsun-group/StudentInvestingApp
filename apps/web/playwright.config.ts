import { defineConfig, devices } from '@playwright/test';

/**
 * StockPlay Playwright Configuration
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  // Exclude Vitest component tests — these live in tests/components/ but run via vitest, not playwright
  testIgnore: ['**/components/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Sharding is controlled via --shard=N/2 CLI flag in CI (see .github/workflows/ci.yml).
  // Do NOT set `shard` here — it is a CLI-only option and is silently ignored or conflicts
  // with the CLI flag when both are present.

  projects: [
    /* Auth setup — runs once before all tests to create storage state */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    /* Main test project — reuses auth storage state */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/student.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Auto-start dev server when running locally */
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
