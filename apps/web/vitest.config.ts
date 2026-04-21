import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    // Exclude Playwright tests — these run via `playwright test`, not vitest
    // Include tests/components/** — those are Vitest unit tests (badge-share, notification-bell)
    exclude: [
      'tests/e2e/**',           // Playwright E2E specs (use browser)
      'tests/integration/**',   // Playwright integration specs (use request)
      'tests/auth.setup.ts',    // Playwright auth setup
      'tests/fixtures/**',      // shared test factories (not test files)
      '**/node_modules/**',
    ],
    include: [
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
  },
});
