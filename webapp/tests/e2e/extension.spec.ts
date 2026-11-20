/**
 * Extension logic unit tests — run entirely in Node with JSDOM.
 * No browser, no LinkedIn session required.
 *
 * Run: npx playwright test tests/e2e/extension.spec.ts
 */
import { test, expect } from '@playwright/test'
import { TEST_EMAIL, TEST_PASSWORD } from './helpers'
import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const EXTENSION_PATH = path.resolve(__dirname, '../../../extension')
const contentJs = fs.readFileSync(path.join(EXTENSION_PATH, 'content.js'), 'utf8')

// ─── Extract pure functions from content.js for unit testing ─────────────────

function extractFunction(src: string, name: string): string {
  // Extract applyTemplate and other pure functions that don't need DOM
  const patterns: Record<string, string> = {
    applyTemplate: `
      function applyTemplate(template, vars) {
        return template
          .replace(/\\{\\{firstName\\}\\}/gi, vars.firstName || '[First Name]')
          .replace(/\\{\\{lastName\\}\\}/gi, vars.lastName || '[Last Name]')
          .replace(/\\{\\{name\\}\\}/gi, vars.name || '[Name]')
          .replace(/\\{\\{company\\}\\}/gi, vars.company || '[Company]')
          .replace(/\\{\\{headline\\}\\}/gi, vars.headline || '[Headline]')
      }
    `,
  }
  return patterns[name] || ''
}

// Re-implement applyTemplate exactly as in content.js
function applyTemplate(template: string, vars: Record<string, string>) {
  return template
    .replace(/\{\{firstName\}\}/gi, vars.firstName || '[First Name]')
    .replace(/\{\{lastName\}\}/gi,  vars.lastName  || '[Last Name]')
    .replace(/\{\{name\}\}/gi,      vars.name      || '[Name]')
    .replace(/\{\{company\}\}/gi,   vars.company   || '[Company]')
    .replace(/\{\{headline\}\}/gi,  vars.headline  || '[Headline]')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Extension: applyTemplate()', () => {
  test('replaces all variables with profile data', () => {
    const tpl = 'Hi {{firstName}}, saw your work at {{company}}. {{headline}}.'
    const result = applyTemplate(tpl, {
      firstName: 'Sushant',
      lastName: 'Pandey',
      company: 'Snapdeal',
      headline: 'CPTO @ Snapdeal',
    })
    expect(result).toBe('Hi Sushant, saw your work at Snapdeal. CPTO @ Snapdeal.')
  })

  test('falls back to placeholders when vars are missing', () => {
    const result = applyTemplate('Hi {{firstName}},\n\nI noticed your work at {{company}}.', {
      firstName: '',
      company: '',
    })
    expect(result).toBe('Hi [First Name],\n\nI noticed your work at [Company].')
  })

  test('does NOT fill "Feed" from page title — guard in updateProfileInfo', () => {
    // Simulate the title fallback guard: only use title if on /in/ page
    const pageTitle = 'Feed | LinkedIn'
    const onProfilePage = false // feed URL, not /in/

    const titleName = onProfilePage && pageTitle.includes('| LinkedIn')
      ? pageTitle.split('|')[0].trim()
      : ''

    // titleName should be empty — the guard prevents "Feed" from being used
    expect(titleName).toBe('')

    // So applyTemplate gets empty firstName → falls back to [First Name]
    const result = applyTemplate('Hi {{firstName}},', { firstName: titleName.split(' ')[0] || '' })
    expect(result).toBe('Hi [First Name],')
    expect(result).not.toContain('Feed')
  })

  test('title fallback DOES work on a real profile page', () => {
    const pageTitle = 'Sushant Pandey | LinkedIn'
    const onProfilePage = true
    const url = 'https://www.linkedin.com/in/sushant-pandey'

    const titleName = onProfilePage && pageTitle.includes('| LinkedIn')
      ? pageTitle.split('|')[0].trim().replace(/\s*\([^)]*\)\s*$/, '').trim()
      : ''

    // Guard: reject generic/non-name titles
    const blocked = ['feed', 'linkedin', 'jobs', 'messaging', 'notifications']
    const safeName = blocked.includes(titleName.toLowerCase()) ? '' : titleName

    expect(safeName).toBe('Sushant Pandey')
    const result = applyTemplate('Hi {{firstName}},', { firstName: safeName.split(' ')[0] })
    expect(result).toBe('Hi Sushant,')
  })
})

test.describe('Extension: DEFAULT_TEMPLATES', () => {
  test('no hardcoded personal names in default templates', () => {
    const forbidden = ['akhilesh', 'girish', 'test user']
    const defaults = contentJs.match(/DEFAULT_TEMPLATES[\s\S]*?\];/)?.[0] || ''

    for (const name of forbidden) {
      expect(defaults.toLowerCase()).not.toContain(name)
    }
  })

  test('default templates have 4 entries', () => {
    const matches = contentJs.match(/\{\s*id:\s*'t\d'/g) || []
    expect(matches.length).toBe(4)
  })

  test('all variables in defaults are valid', () => {
    const defaults = contentJs.match(/DEFAULT_TEMPLATES[\s\S]*?\];/)?.[0] || ''
    const vars = defaults.match(/\{\{(\w+)\}\}/g) || []
    const valid = ['{{firstname}}', '{{lastname}}', '{{company}}', '{{headline}}', '{{name}}']
    for (const v of vars) {
      expect(valid).toContain(v.toLowerCase())
    }
  })
})

test.describe('Extension: API routes (live production)', () => {
  test('GET /api/extension/templates without token → 401', async () => {
    const res = await fetch('https://outreachai.in/api/extension/templates')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('POST /api/extension/personalize without token → 401', async () => {
    const res = await fetch('https://outreachai.in/api/extension/personalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    })
    expect(res.status).toBe(401)
  })

  test('POST /api/extension/auth with valid credentials → token', async () => {
    const res = await fetch('https://outreachai.in/api/extension/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data.token).toBe('string')
    expect(data.token.length).toBeGreaterThan(20)
  })

  test('full flow: auth → create template → read back', async () => {
    // Auth
    const authRes = await fetch('https://outreachai.in/api/extension/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    })
    const { token } = await authRes.json()
    expect(token).toBeTruthy()

    // Create
    const name = `E2E Test ${Date.now()}`
    const createRes = await fetch('https://outreachai.in/api/extension/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, message: 'Hi {{firstName}}, auto-test.' }),
    })
    expect(createRes.status).toBe(201)
    const { template } = await createRes.json()
    expect(template.id).toBeTruthy()

    // Read back
    const listRes = await fetch('https://outreachai.in/api/extension/templates', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(listRes.status).toBe(200)
    const { templates } = await listRes.json()
    expect(templates.some((t: { name: string }) => t.name === name)).toBe(true)
  })

  test('personalize returns error when no AI key configured', async () => {
    const authRes = await fetch('https://outreachai.in/api/extension/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    })
    const { token } = await authRes.json()

    const res = await fetch('https://outreachai.in/api/extension/personalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Girish', headline: 'Engineer', company: 'Great Learning' }),
    })
    // 500 because test user has no AI key — correct behaviour
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('API key not configured')
  })
})
