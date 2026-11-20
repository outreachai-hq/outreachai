import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// Import route handlers
import { POST as register } from '@/app/api/auth/register/route'
import { POST as extensionAuth } from '@/app/api/extension/auth/route'

const mockUser = {
  id: 'user_123',
  email: 'test@example.com',
  password: bcrypt.hashSync('password123', 1),
  name: 'Test User',
  plan: 'pro',
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost:3000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 if email or password missing', async () => {
    const res = await register(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/password/i)
  })

  it('returns 409 if email already exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any)
    const res = await register(makeRequest({ email: 'test@example.com', password: 'pass123' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/already in use/i)
  })

  it('creates user and returns 200 when email is new', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser as any)
    const res = await register(makeRequest({ email: 'new@example.com', password: 'pass123', name: 'New User' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.email).toBe(mockUser.email)
    expect(json.password).toBeUndefined() // never expose password
  })
})

describe('POST /api/extension/auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 if credentials missing', async () => {
    const res = await extensionAuth(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 if user not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    const res = await extensionAuth(makeRequest({ email: 'nobody@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 if password wrong', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any)
    const res = await extensionAuth(makeRequest({ email: 'test@example.com', password: 'wrongpass' }))
    expect(res.status).toBe(401)
  })

  it('returns token and userId on valid credentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any)
    const res = await extensionAuth(makeRequest({ email: 'test@example.com', password: 'password123' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    // API returns a signed JWT, not the raw user ID
    expect(typeof json.token).toBe('string')
    expect(json.token.length).toBeGreaterThan(10)
    expect(json.userId).toBe(mockUser.id)
    expect(json.plan).toBe('pro')
  })
})
