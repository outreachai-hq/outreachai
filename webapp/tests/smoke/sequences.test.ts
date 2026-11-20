import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GET, POST, PATCH, DELETE } from '@/app/api/sequences/route'

const MOCK_USER_ID = 'user_test_123'

const mockSequence = {
  id: 'seq_1',
  userId: MOCK_USER_ID,
  name: 'Standard 3-Step Outreach',
  active: true,
  // Canonical step shape — see lib/sequenceStepSchema.ts (Plan 1).
  steps: [
    { id: 'step_1', type: 'connection_request', name: 'Initial Outreach', waitDays: 1, message: "Hi {{firstName}}, let's connect." },
    { id: 'step_2', type: 'wait', name: 'Wait', waitDays: 3 },
    { id: 'step_3', type: 'chat_message', name: 'Follow-up #1', waitDays: 0, message: 'Hey {{firstName}}, following up.' },
  ],
  createdAt: new Date(),
}

function makeRequest(method: string, body?: object, queryId?: string) {
  const url = queryId
    ? `http://localhost:3000/api/sequences?id=${queryId}`
    : 'http://localhost:3000/api/sequences'
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/sequences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all sequences for user', async () => {
    vi.mocked(prisma.sequence.findMany).mockResolvedValueOnce([mockSequence] as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    // API returns plain array
    expect(json).toHaveLength(1)
    expect(json[0].name).toBe('Standard 3-Step Outreach')
  })
})

describe('POST /api/sequences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 if name or steps missing', async () => {
    const res = await POST(makeRequest('POST', { name: 'No steps' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 if steps array is empty', async () => {
    const res = await POST(makeRequest('POST', { name: 'Test', steps: [] }))
    expect(res.status).toBe(400)
  })

  it('creates sequence with steps', async () => {
    vi.mocked(prisma.sequence.create).mockResolvedValueOnce(mockSequence as any)
    const res = await POST(makeRequest('POST', {
      name: 'Standard 3-Step Outreach',
      steps: mockSequence.steps,
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    // API returns plain object
    expect(json.name).toBe('Standard 3-Step Outreach')
  })
})

describe('PATCH /api/sequences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toggles active status', async () => {
    vi.mocked(prisma.sequence.findUnique).mockResolvedValueOnce(mockSequence as any)
    vi.mocked(prisma.sequence.update).mockResolvedValueOnce({ ...mockSequence, active: false } as any)
    const res = await PATCH(makeRequest('PATCH', { id: 'seq_1', active: false }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.active).toBe(false)
  })
})

describe('DELETE /api/sequences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes sequence', async () => {
    vi.mocked(prisma.sequence.findUnique).mockResolvedValueOnce(mockSequence as any)
    vi.mocked(prisma.sequence.delete).mockResolvedValueOnce(mockSequence as any)
    // DELETE reads id from query param
    const res = await DELETE(makeRequest('DELETE', undefined, 'seq_1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
