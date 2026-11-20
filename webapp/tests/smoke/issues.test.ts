import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { GET, POST } from '@/app/api/issues/route'
import { PATCH } from '@/app/api/issues/[id]/route'

vi.mock('@/lib/ai', () => ({})) // not used here but prevents import errors

function makeReq(method: string, url: string, body?: unknown, headers?: Record<string, string>) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const MOCK_ISSUE = {
  id: 'issue_1', title: 'Test bug', description: 'Steps to reproduce...',
  type: 'bug', email: 'user@example.com', url: 'http://localhost/enrichment',
  userAgent: null, status: 'open', createdAt: new Date(), updatedAt: new Date(),
}

const ADMIN_KEY = 'test-admin-secret-123'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ADMIN_SECRET = ADMIN_KEY
})

describe('POST /api/issues (public — no auth required)', () => {
  it('returns 400 when title is missing', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/issues', { description: 'desc' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/title/i)
  })

  it('returns 400 when description is missing', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/issues', { title: 'My bug' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/description/i)
  })

  it('returns 400 when title exceeds 200 chars', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/issues', {
      title: 'x'.repeat(201), description: 'desc',
    }))
    expect(res.status).toBe(400)
  })

  it('creates issue and returns 201 for valid input', async () => {
    vi.mocked(prisma.issueReport.create).mockResolvedValueOnce(MOCK_ISSUE as any)
    const res = await POST(makeReq('POST', 'http://localhost/api/issues', {
      title: 'Test bug', description: 'Steps to reproduce the issue', type: 'bug',
      email: 'user@example.com',
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.id).toBe('issue_1')
  })

  it('defaults type to "bug" for unknown types', async () => {
    vi.mocked(prisma.issueReport.create).mockResolvedValueOnce(MOCK_ISSUE as any)
    await POST(makeReq('POST', 'http://localhost/api/issues', {
      title: 'Test', description: 'desc', type: 'unknown_type',
    }))
    expect(prisma.issueReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'bug' }) })
    )
  })
})

describe('GET /api/issues (admin only)', () => {
  it('returns 401 without admin key', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/issues'))
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong admin key', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/issues', undefined, { 'x-admin-key': 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns all issues with correct admin key', async () => {
    vi.mocked(prisma.issueReport.findMany).mockResolvedValueOnce([MOCK_ISSUE] as any)
    const res = await GET(makeReq('GET', 'http://localhost/api/issues', undefined, { 'x-admin-key': ADMIN_KEY }))
    expect(res.status).toBe(200)
    const issues = await res.json()
    expect(issues).toHaveLength(1)
    expect(issues[0].title).toBe('Test bug')
  })
})

describe('PATCH /api/issues/[id] (admin only)', () => {
  it('returns 401 without admin key', async () => {
    const req = makeReq('PATCH', 'http://localhost/api/issues/issue_1', { status: 'resolved' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'issue_1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid status', async () => {
    const req = makeReq('PATCH', 'http://localhost/api/issues/issue_1',
      { status: 'deleted' }, { 'x-admin-key': ADMIN_KEY })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'issue_1' }) })
    expect(res.status).toBe(400)
  })

  it('updates status for valid input', async () => {
    vi.mocked(prisma.issueReport.update).mockResolvedValueOnce({ ...MOCK_ISSUE, status: 'resolved' } as any)
    const req = makeReq('PATCH', 'http://localhost/api/issues/issue_1',
      { status: 'resolved' }, { 'x-admin-key': ADMIN_KEY })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'issue_1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('resolved')
  })

  it('accepts all valid status values', async () => {
    for (const status of ['open', 'in_progress', 'resolved', 'wont_fix']) {
      vi.mocked(prisma.issueReport.update).mockResolvedValueOnce({ ...MOCK_ISSUE, status } as any)
      const req = makeReq('PATCH', 'http://localhost/api/issues/issue_1',
        { status }, { 'x-admin-key': ADMIN_KEY })
      const res = await PATCH(req, { params: Promise.resolve({ id: 'issue_1' }) })
      expect(res.status).toBe(200)
    }
  })
})
