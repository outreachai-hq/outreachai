import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GET, POST, PATCH, DELETE } from '@/app/api/contacts/route'

const MOCK_USER_ID = 'user_test_123' // matches setup.ts mock session

const mockContact = {
  id: 'contact_1',
  userId: MOCK_USER_ID,
  profileId: 'john-doe',
  name: 'John Doe',
  company: 'Acme Corp',
  headline: 'VP Sales',
  linkedinUrl: 'https://linkedin.com/in/john-doe',
  status: 'sent',
  sentAt: new Date(),
  followupAt: null,
  notes: null,
  createdAt: new Date(),
}

function makeRequest(method: string, body?: object, bearerToken?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`
  return new NextRequest('http://localhost:3000/api/contacts', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns contacts for authenticated user', async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([mockContact] as any)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.contacts).toHaveLength(1)
    expect(json.contacts[0].name).toBe('John Doe')
  })

  it('returns empty array when no contacts', async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([])
    const res = await GET(makeRequest('GET'))
    const json = await res.json()
    expect(json.contacts).toEqual([])
  })
})

describe('POST /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 if name is missing', async () => {
    const res = await POST(makeRequest('POST', { company: 'Acme' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/name/i)
  })

  it('creates a contact and returns 201', async () => {
    vi.mocked(prisma.contact.create).mockResolvedValueOnce(mockContact as any)
    const res = await POST(makeRequest('POST', {
      name: 'John Doe',
      company: 'Acme Corp',
      profileId: 'john-doe',
      status: 'sent',
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.contact.name).toBe('John Doe')
  })

  it('accepts Bearer token from extension', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: MOCK_USER_ID } as any)
    vi.mocked(prisma.contact.create).mockResolvedValueOnce(mockContact as any)
    const res = await POST(makeRequest('POST', { name: 'John Doe' }, MOCK_USER_ID))
    expect(res.status).toBe(201)
  })
})

describe('PATCH /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates contact status', async () => {
    vi.mocked(prisma.contact.updateMany).mockResolvedValueOnce({ count: 1 })
    const res = await PATCH(makeRequest('PATCH', { id: 'contact_1', status: 'replied' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})

describe('DELETE /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a contact', async () => {
    vi.mocked(prisma.contact.deleteMany).mockResolvedValueOnce({ count: 1 })
    const res = await DELETE(makeRequest('DELETE', { id: 'contact_1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
