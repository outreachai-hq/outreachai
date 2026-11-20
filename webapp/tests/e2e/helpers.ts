import { Page } from '@playwright/test'

// Test user seeded via scripts/seed-test-user.ts. Credentials come from the environment:
//   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... npm run test:critical
export const TEST_EMAIL    = process.env.TEST_USER_EMAIL    ?? 'e2e@example.com'
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ''
if (!TEST_PASSWORD) {
  console.warn('[e2e] TEST_USER_PASSWORD is not set — login-based tests will fail')
}

// kept for backward compat
export const DEMO_EMAIL    = TEST_EMAIL
export const DEMO_PASSWORD = TEST_PASSWORD

/** Log in with the test user and wait for dashboard */
export async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email address/i).fill(TEST_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 })
}
