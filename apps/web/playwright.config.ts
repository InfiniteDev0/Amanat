import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of sign-in against LOCAL Supabase (Docker) and the app's
// dev server: `pnpm --filter @sarrif/web test:e2e` (README, "Tests").
// Needs `pnpm exec supabase start` first, and apps/web/.env.local filled in.
export default defineConfig({
  testDir: './e2e',
  // One at a time: the tests share one local Supabase and its mailbox.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000/en',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
