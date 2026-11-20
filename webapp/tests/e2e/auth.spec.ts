import { test, expect } from '@playwright/test'

const DEMO_EMAIL = 'akhilesh@demo.com'
const DEMO_PASSWORD = 'password123'

test.describe('Landing page', () => {
  test('shows hero, pricing and CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('₹1,499').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()
  })

  test('nav links to login and signup', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /log in/i }).click()
    await expect(page).toHaveURL('/login')

    await page.goto('/')
    await page.getByRole('link', { name: /start free/i }).first().click()
    await expect(page).toHaveURL('/signup')
  })
})

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('renders email and password fields', async ({ page }) => {
    await expect(page.getByLabel(/email address/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('invalid credentials do not redirect to dashboard', async ({ page }) => {
    await page.locator('#email').fill('notauser@nowhere.com')
    await page.locator('#password').fill('wrongpass123')
    await page.getByRole('button', { name: /sign in/i }).click()
    // Must NOT reach dashboard — bad credentials should keep user on /login
    await page.waitForTimeout(4000)
    await expect(page).toHaveURL(/\/login/)
    await expect(page).not.toHaveURL('/dashboard')
  })

  test('redirects to dashboard on valid login', async ({ page }) => {
    await page.getByLabel(/email address/i).fill(DEMO_EMAIL)
    await page.getByLabel(/password/i).fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 })
  })

  test('has link to signup page', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click()
    await expect(page).toHaveURL('/signup')
  })
})

test.describe('Signup page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
  })

  test('renders signup form fields', async ({ page }) => {
    await expect(page.getByLabel(/full name/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  test('shows error on duplicate email', async ({ page }) => {
    await page.getByLabel(/full name/i).fill('Test User')
    await page.getByLabel(/email/i).fill(DEMO_EMAIL) // already seeded
    await page.getByLabel(/password/i).fill('anypassword')
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByText(/already in use/i)).toBeVisible({ timeout: 8000 })
  })

  test('signs up with a new email and lands on dashboard', async ({ page }) => {
    const unique = `test_${Date.now()}@outreachai.in`
    await page.getByLabel(/full name/i).fill('E2E Tester')
    await page.getByLabel(/email/i).fill(unique)
    await page.getByLabel(/password/i).fill('securepass123')
    await page.getByRole('button', { name: /create account/i }).click()
    // New users go to /onboarding first
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15000 })
  })
})
