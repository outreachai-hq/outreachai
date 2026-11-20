import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GET, POST, PATCH, DELETE } from '@/app/api/templates/route'

const MOCK_USER_ID = 'user_test_123'

const mockTemplate = {
  id: 'tmpl_1',
  userId: MOCK_USER_ID,
  name: 'Initial Outreach',
  subject: null,
  message: 'Hi {{firstName}}, I noticed your work at {{company}}...',
  createdAt: new Date(),
}

function makeRequest(method: string, body?: object, queryId?: string) {
  const url = queryId
    ? `http://localhost:3000/api/templates?id=${queryId}`
    : 'http://localhost:3000/api/templates'
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all templates for user', async () => {
    vi.mocked(prisma.template.findMany).mockResolvedValueOnce([mockTemplate] as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].name).toBe('Initial Outreach')
  })

  it('returns empty array when no templates', async () => {
    vi.mocked(prisma.template.findMany).mockResolvedValueOnce([])
    const res = await GET()
    const json = await res.json()
    expect(json).toEqual([])
  })

  it('returns subject field (null for old templates)', async () => {
    vi.mocked(prisma.template.findMany).mockResolvedValueOnce([mockTemplate] as any)
    const res = await GET()
    const json = await res.json()
    expect(json[0]).toHaveProperty('subject', null)
  })

  it('returns subject field when set', async () => {
    const withSubject = { ...mockTemplate, subject: 'Quick question about {{company}}' }
    vi.mocked(prisma.template.findMany).mockResolvedValueOnce([withSubject] as any)
    const res = await GET()
    const json = await res.json()
    expect(json[0].subject).toBe('Quick question about {{company}}')
  })
})

// ── POST ──────────────────────────────────────────────────────────────────────

describe('POST /api/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 if name is missing', async () => {
    const res = await POST(makeRequest('POST', { message: 'Hello' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 if message is missing', async () => {
    const res = await POST(makeRequest('POST', { name: 'Only name' }))
    expect(res.status).toBe(400)
  })

  it('creates template without subject', async () => {
    vi.mocked(prisma.template.create).mockResolvedValueOnce(mockTemplate as any)
    const res = await POST(makeRequest('POST', {
      name: 'Initial Outreach',
      message: 'Hi {{firstName}}...',
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.name).toBe('Initial Outreach')
    expect(vi.mocked(prisma.template.create).mock.calls[0][0].data).toMatchObject({
      name: 'Initial Outreach',
      subject: null,
    })
  })

  it('creates template with subject', async () => {
    const withSubject = { ...mockTemplate, subject: 'Quick question' }
    vi.mocked(prisma.template.create).mockResolvedValueOnce(withSubject as any)
    const res = await POST(makeRequest('POST', {
      name: 'Initial Outreach',
      subject: 'Quick question',
      message: 'Hi {{firstName}}...',
    }))
    expect(res.status).toBe(201)
    expect(vi.mocked(prisma.template.create).mock.calls[0][0].data).toMatchObject({
      subject: 'Quick question',
    })
  })

  it('stores HTML message from rich editor', async () => {
    const htmlMessage = '<p>Hi <strong>{{firstName}}</strong>, I noticed your work at <em>{{company}}</em>...</p>'
    vi.mocked(prisma.template.create).mockResolvedValueOnce({ ...mockTemplate, message: htmlMessage } as any)
    const res = await POST(makeRequest('POST', {
      name: 'Rich Template',
      message: htmlMessage,
    }))
    expect(res.status).toBe(201)
    expect(vi.mocked(prisma.template.create).mock.calls[0][0].data.message).toBe(htmlMessage)
  })

  it('stores null when subject is empty string', async () => {
    vi.mocked(prisma.template.create).mockResolvedValueOnce(mockTemplate as any)
    await POST(makeRequest('POST', {
      name: 'Template',
      message: 'Hello',
      subject: '',
    }))
    expect(vi.mocked(prisma.template.create).mock.calls[0][0].data.subject).toBeNull()
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 if id missing', async () => {
    const res = await PATCH(makeRequest('PATCH', { name: 'No id' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 if template not found', async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValueOnce(null)
    const res = await PATCH(makeRequest('PATCH', { id: 'tmpl_ghost', name: 'X', message: 'Y' }))
    expect(res.status).toBe(404)
  })

  it('updates name, message and subject', async () => {
    const updated = { ...mockTemplate, name: 'Updated', subject: 'New subject', message: 'Updated message' }
    vi.mocked(prisma.template.findUnique).mockResolvedValueOnce(mockTemplate as any)
    vi.mocked(prisma.template.update).mockResolvedValueOnce(updated as any)
    const res = await PATCH(makeRequest('PATCH', {
      id: 'tmpl_1',
      name: 'Updated',
      subject: 'New subject',
      message: 'Updated message',
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('Updated')
    expect(vi.mocked(prisma.template.update).mock.calls[0][0].data).toMatchObject({
      subject: 'New subject',
    })
  })

  it('clears subject when passed as null', async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValueOnce({ ...mockTemplate, subject: 'Old subject' } as any)
    vi.mocked(prisma.template.update).mockResolvedValueOnce(mockTemplate as any)
    await PATCH(makeRequest('PATCH', { id: 'tmpl_1', name: 'X', message: 'Y', subject: null }))
    expect(vi.mocked(prisma.template.update).mock.calls[0][0].data.subject).toBeNull()
  })

  it('updates HTML message from rich editor', async () => {
    const htmlMsg = '<p><strong>Bold</strong> intro for {{firstName}}</p>'
    vi.mocked(prisma.template.findUnique).mockResolvedValueOnce(mockTemplate as any)
    vi.mocked(prisma.template.update).mockResolvedValueOnce({ ...mockTemplate, message: htmlMsg } as any)
    const res = await PATCH(makeRequest('PATCH', { id: 'tmpl_1', name: 'T', message: htmlMsg }))
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.template.update).mock.calls[0][0].data.message).toBe(htmlMsg)
  })
})

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes template by id', async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValueOnce(mockTemplate as any)
    vi.mocked(prisma.template.delete).mockResolvedValueOnce(mockTemplate as any)
    const res = await DELETE(makeRequest('DELETE', undefined, 'tmpl_1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 400 if id missing from query', async () => {
    const res = await DELETE(makeRequest('DELETE'))
    expect(res.status).toBe(400)
  })

  it('returns 404 if template not found', async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValueOnce(null)
    const res = await DELETE(makeRequest('DELETE', undefined, 'tmpl_ghost'))
    expect(res.status).toBe(404)
  })
})
