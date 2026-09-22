import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the one critical-path e2e test. The chromium binary is
 * preinstalled in this environment; we point at it directly so the runner does
 * not try to download a version-pinned build.
 */
const PREINSTALLED_CHROMIUM = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: PREINSTALLED_CHROMIUM },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Deterministic auth for e2e: a syntactically-valid but unreachable Supabase
    // config makes `isSupabaseConfigured` true so protected routes redirect,
    // while getUser (no session cookie) resolves "session missing" without any
    // network call. No real database is touched.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    },
  },
});
