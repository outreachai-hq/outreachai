import { describe, it, expect, vi, afterEach } from 'vitest'
import { getJwtSecret } from '@/lib/jwtSecret'

afterEach(() => vi.unstubAllEnvs())

describe('getJwtSecret', () => {
  it('uses NEXTAUTH_SECRET when set', () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'my-real-secret')
    expect(new TextDecoder().decode(getJwtSecret())).toBe('my-real-secret')
  })

  it('throws in production when NEXTAUTH_SECRET is missing', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => getJwtSecret()).toThrow(/NEXTAUTH_SECRET must be set/)
  })

  it('falls back to a dev key outside production', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('NODE_ENV', 'test')
    expect(getJwtSecret().length).toBeGreaterThan(0)
  })
})
