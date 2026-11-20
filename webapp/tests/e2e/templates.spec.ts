import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Templates page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/templates')
  })

  test('shows seeded templates', async ({ page }) => {
    await expect(page.getByText('Initial Outreach')).toBeVisible()
    await expect(page.getByText('Follow-up #1 (Day 3)')).toBeVisible()
    await expect(page.getByText('Connection Request Note')).toBeVisible()
  })

  test('shows variable hints in template preview', async ({ page }) => {
    await expect(page.getByText(/\{\{firstName\}\}/).first()).toBeVisible()
  })

  test('opens new template form', async ({ page }) => {
    await page.getByRole('button', { name: /new template/i }).click()
    await expect(page.getByPlaceholder(/initial outreach/i)).toBeVisible()
  })

  test('creates a new template', async ({ page }) => {
    await page.getByRole('button', { name: /new template/i }).click()
    await page.getByPlaceholder(/initial outreach/i).fill('E2E Test Template')
    await page.getByPlaceholder(/Hi \{\{name\}\}/i).fill('Hi {{firstName}}, this is a test message.')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('E2E Test Template')).toBeVisible({ timeout: 5000 })
  })
})
