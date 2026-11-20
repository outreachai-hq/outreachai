import { chromium } from '../node_modules/playwright/index.mjs'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setViewportSize({ width: 1400, height: 900 })

await page.goto('http://localhost:3000/login')
await page.waitForLoadState('networkidle')

const hint = await page.locator('text=demo').first().textContent().catch(() => '')
console.log('Hint:', hint?.trim().slice(0, 120))

await page.locator('input[type="email"]').first().fill('akhilesh@demo.com')
await page.locator('input[type="password"]').first().fill('password123')
await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(8000)

console.log('URL after submit:', page.url())
const error = await page.locator('[class*="error"], [class*="alert"], p[class*="red"]').first().textContent().catch(() => '')
if (error) console.log('Error message:', error.trim())

await page.screenshot({ path: '/tmp/login-debug.png' })
await browser.close()
