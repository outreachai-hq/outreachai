import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/admin/users/route'
import { isAdminEmail } from '@/lib/admin'

const ADMIN = { user: { id: 'u_admin', email: 'Boss@Example.com', name: 'Boss' } } as any
const NORMAL = { user: { id: 'u_1', email: 'someone@example.com', name: 'Someone' } } as any

function req(qs = '') {
  return new NextRequest(`http://localhost:3000/api/admin/users${qs ? `?${qs}` : ''}`)
}

describe('isAdminEmail', () => {
  afterEach(() => { delete process.env.ADMIN_EMAILS })

  it('matches case-insensitively against the comma-separated allowlist', () => {
    process.env.ADMIN_EMAILS = ' boss@example.com , other@example.com'
    expect(isAdminEmail('BOSS@example.com')).toBe(true)
    expect(isAdminEmail('other@example.com')).toBe(true)
    expect(isAdminEmail('nope@example.com')).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
  })

  it('denies everyone when ADMIN_EMAILS is unset', () => {
    expect(isAdminEmail('boss@example.com')).toBe(false)
  })
})

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_EMAILS = 'boss@example.com'
  })
  afterEach(() => { delete process.env.ADMIN_EMAILS })

  it('401s when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('403s for a logged-in non-admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce(NORMAL)
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('returns users with counts and never leaks password hashes', async () => {
    vi.mocked(auth).mockResolvedValueOnce(ADMIN)
    vi.mocked(prisma.user.count).mockResolvedValueOnce(2 as any)
    vi.mocked(prisma.user.groupBy).mockResolvedValueOnce([
      { plan: 'free', _count: { _all: 5 } },
      { plan: 'pro', _count: { _all: 2 } },
    ] as any)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'a', email: 'a@x.com', name: 'A', plan: 'pro', password: '$2a$hash', onboardingCompleted: true,
        extensionConnected: false, createdAt: new Date(), _count: { contacts: 10, campaigns: 2, sequences: 1 } },
      { id: 'b', email: 'b@x.com', name: null, plan: 'free', password: null, onboardingCompleted: false,
        extensionConnected: true, createdAt: new Date(), _count: { contacts: 0, campaigns: 0, sequences: 0 } },
    ] as any)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.users).toHaveLength(2)
    expect(j.users[0]).toMatchObject({ authMethod: 'password', contacts: 10, campaigns: 2 })
    expect(j.users[1].authMethod).toBe('oauth')
    expect(JSON.stringify(j)).not.toContain('$2a$hash')
    expect(j.users[0]).not.toHaveProperty('password')
    expect(j.stats).toEqual({ totalUsers: 7, byPlan: { free: 5, pro: 2 } })
  })

  it('applies search, plan filter and pagination', async () => {
    vi.mocked(auth).mockResolvedValueOnce(ADMIN)
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0 as any)
    vi.mocked(prisma.user.groupBy).mockResolvedValueOnce([] as any)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])

    await GET(req('q=acme&plan=pro&page=3&pageSize=500'))
    const call = vi.mocked(prisma.user.findMany).mock.calls[0]?.[0] as any
    expect(call.where.plan).toBe('pro')
    expect(call.where.OR[0].email.contains).toBe('acme')
    expect(call.take).toBe(100)   // capped
    expect(call.skip).toBe(200)
  })
})
