import { test, expect } from '@playwright/test'
import { login } from './helpers'

// Requires ADMIN_EMAILS to include TEST_USER_EMAIL on the server under test.
test.describe('Admin · Users', () => {
  test('API rejects unauthenticated requests', async ({ request }) => {
    const res = await request.get('/api/admin/users')
    expect(res.status()).toBe(401)
  })

  test('admin can see all registered users', async ({ page }) => {
    await login(page)
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: 'Registered users' })).toBeVisible()
    await expect(page.getByText(/\d+ total users/)).toBeVisible({ timeout: 15_000 })
    const rows = page.locator('tbody tr')
    await expect(rows.first()).toBeVisible()

    // Search narrows the list
    await page.getByPlaceholder('Search by email or name').fill('zzz-no-such-user-zzz')
    await expect(page.getByText('No users match your filters.')).toBeVisible({ timeout: 10_000 })

    // Sidebar link visible for admins
    await expect(page.getByRole('link', { name: /Admin · Users/ })).toBeVisible()
    await page.screenshot({ path: 'test-results/admin-users.png', fullPage: true })
  })
})
