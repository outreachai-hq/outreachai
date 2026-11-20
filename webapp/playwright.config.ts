import { defineConfig, devices } from '@playwright/test'

const isProd = !!process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests/e2e',
  timeout:       isProd ? 45_000 : 30_000,
  expect:        { timeout: isProd ? 15_000 : 8_000 },
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL:       process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace:         'on-first-retry',
    screenshot:    'only-on-failure',
    navigationTimeout: isProd ? 20_000 : 10_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Test user credentials: set TEST_USER_EMAIL / TEST_USER_PASSWORD in the environment
  webServer: isProd ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
