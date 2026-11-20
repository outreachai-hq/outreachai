import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Sequences page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/sequences')
  })

  test('shows seeded sequence', async ({ page }) => {
    await expect(page.getByText('Standard 3-Step Outreach')).toBeVisible()
  })

  test('shows active badge or status', async ({ page }) => {
    await expect(page.getByText(/active|inactive|pause/i).first()).toBeVisible()
  })

  test('new sequence button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new sequence/i })).toBeVisible()
  })
})
