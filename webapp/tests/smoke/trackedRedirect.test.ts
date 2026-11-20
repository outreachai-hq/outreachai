import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { resolveTrackedDestination } from '@/lib/trackedRedirect'

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com'))
afterEach(() => vi.unstubAllEnvs())

const HOME = 'https://app.example.com/'

describe('resolveTrackedDestination', () => {
  it('follows http(s) links for a known send', () => {
    expect(resolveTrackedDestination('https://customer.example.com/pricing?a=1', true))
      .toBe('https://customer.example.com/pricing?a=1')
  })

  it('handles the encoded form produced by link wrapping', () => {
    expect(resolveTrackedDestination(encodeURIComponent('https://x.example.com/a b'), true))
      .toBe('https://x.example.com/a%20b')
  })

  it('blocks open redirects when the tracking id is unknown', () => {
    expect(resolveTrackedDestination('https://evil.example.com', false)).toBe(HOME)
  })

  it('rejects non-http schemes', () => {
    expect(resolveTrackedDestination('javascript:alert(1)', true)).toBe(HOME)
    expect(resolveTrackedDestination('data:text/html,hi', true)).toBe(HOME)
  })

  it('falls back home for missing or malformed urls', () => {
    expect(resolveTrackedDestination(null, true)).toBe(HOME)
    expect(resolveTrackedDestination('not a url', true)).toBe(HOME)
    expect(resolveTrackedDestination('%E0%A4%A', true)).toBe(HOME)
  })
})
