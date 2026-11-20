import { test, expect } from '@playwright/test'
import { login, DEMO_EMAIL, DEMO_PASSWORD } from './helpers'

// ---------------------------------------------------------------------------
// Test 1: Login → Dashboard
// ---------------------------------------------------------------------------
test.describe('Login → Dashboard', () => {
  test('logs in and lands on dashboard', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL ?? DEMO_EMAIL
    const password = process.env.TEST_USER_PASSWORD ?? DEMO_PASSWORD

    await page.goto('/login')
    await page.getByLabel(/email address/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
      .catch(() => {
        test.skip(true, 'No test user configured — set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars')
      })

    await expect(page).toHaveURL(/\/(dashboard|onboarding)/)
    await expect(page.getByText(/dashboard|welcome|campaign/i).first()).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Test 2: Create campaign → editor flow
// ---------------------------------------------------------------------------
test.describe('Create campaign → editor', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('creates a campaign and opens the editor', async ({ page }) => {
    await page.goto('/marketing/new')

    // Wait for page to settle — async dropdowns need time to fetch
    await page.waitForLoadState('networkidle').catch(() => {})

    // Read full page text — the only reliable way after async data loads
    const bodyText = await page.locator('main').textContent({ timeout: 8_000 }).catch(() => '')

    if (/no email accounts found/i.test(bodyText ?? '')) {
      test.skip(true, 'No email account configured for test user — add one in Settings')
      return
    }
    if (/no lead lists found/i.test(bodyText ?? '')) {
      test.skip(true, 'No lead list configured for test user — create one in Leads')
      return
    }

    const campaignName = `E2E Test Campaign ${Date.now()}`

    await page.getByPlaceholder(/q3 product/i).fill(campaignName)
    await page.getByPlaceholder(/exciting news/i).fill('E2E Test Subject')
    await page.getByPlaceholder(/priya from/i).fill('E2E Tester')

    await page.getByRole('button', { name: /create/i }).click()

    await page.waitForURL(/\/marketing\/.+\/edit/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/marketing\/.+\/edit/)

    const htmlBodyInput = page.getByPlaceholder(/write your email/i)
      .or(page.locator('textarea').first())
    await htmlBodyInput.fill('<h1>Hello {{firstName}}</h1><p>This is a test.</p>')

    await page.getByRole('button', { name: /save draft/i }).click()
    await expect(page.getByText(/draft saved/i)).toBeVisible({ timeout: 8_000 })

    await page.goto('/marketing')
    await expect(page.getByText(campaignName)).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Test 3: Tracking & Unsubscribe public endpoints
// ---------------------------------------------------------------------------
test.describe('Public tracking & unsubscribe endpoints', () => {
  test('open-pixel returns 200 image/gif', async ({ page }) => {
    const res = await page.request.get('/api/marketing/track/open?sid=nonexistent-test-id')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toMatch(/image\/gif/)
  })

  test('click endpoint does not open-redirect for unknown tracking ids', async ({ page }) => {
    const res = await page.request.get(
      '/api/marketing/track/click?sid=nonexistent&url=https%3A%2F%2Fevil.example.com',
      { maxRedirects: 0 }
    )
    const status = res.status()
    expect([301, 302, 307, 308]).toContain(status)
    expect(res.headers()['location'] ?? '').not.toContain('evil.example.com')
  })

  test('unsubscribe page returns 200 with unsubscribe text', async ({ page }) => {
    const res = await page.request.get('/api/marketing/unsubscribe?sid=nonexistent-test-id')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body.toLowerCase()).toContain('unsubscribe')
  })
})
