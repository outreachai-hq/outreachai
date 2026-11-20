import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login')
  })

  test('shows welcome message', async ({ page }) => {
    await expect(page.getByText(/welcome back/i)).toBeVisible()
  })

  test('shows getting started checklist', async ({ page }) => {
    await expect(page.getByText(/get started/i).first()).toBeVisible()
  })

  test('sidebar navigation is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /home/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /templates/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /sequences/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
  })

  test('navigates to templates from sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /templates/i }).click()
    await expect(page).toHaveURL('/templates')
  })

  test('navigates to sequences from sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /sequences/i }).click()
    await expect(page).toHaveURL('/sequences')
  })
})
