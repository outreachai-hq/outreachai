// Plan 5 (Iter 2) — smoke tests for the CustomFieldDef CRUD + run routes.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

import { GET as listDefs, POST as createDef } from '@/app/api/custom-fields/route'
import { PATCH as patchDef, DELETE as deleteDef } from '@/app/api/custom-fields/[id]/route'
import { POST as runOne } from '@/app/api/custom-fields/[id]/run/route'
import { POST as runAll } from '@/app/api/custom-fields/[id]/run-all/route'

vi.mock('@/lib/ai', () => ({ generateText: vi.fn() }))
import { generateText } from '@/lib/ai'

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof patchDef>[0]
}

describe('GET /api/custom-fields', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an invalid entity filter', async () => {
    const res = await listDefs(mkReq('http://x/api/custom-fields?entity=banana') as never)
    expect(res.status).toBe(400)
  })

  it('lists defs', async () => {
    vi.mocked(prisma.customFieldDef.findMany).mockResolvedValue([
      { id: 'd1', entity: 'lead', key: 'industry_tier', type: 'select' } as never,
    ])
    const res = await listDefs(mkReq('http://x/api/custom-fields?entity=lead') as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.defs).toHaveLength(1)
  })
})

describe('POST /api/custom-fields', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects bad entity', async () => {
    const res = await createDef(mkReq('http://x', { method: 'POST', body: JSON.stringify({ entity: 'banana', type: 'text', label: 'X' }) }))
    expect(res.status).toBe(400)
  })

  it('rejects bad type', async () => {
    const res = await createDef(mkReq('http://x', { method: 'POST', body: JSON.stringify({ entity: 'lead', type: 'banana', label: 'X' }) }))
    expect(res.status).toBe(400)
  })

  it('rejects collision with native field key', async () => {
    const res = await createDef(mkReq('http://x', { method: 'POST', body: JSON.stringify({ entity: 'lead', type: 'text', label: 'Email' }) }))
    expect(res.status).toBe(400)
  })

  it('requires aiPrompt when type=ai', async () => {
    const res = await createDef(mkReq('http://x', { method: 'POST', body: JSON.stringify({ entity: 'lead', type: 'ai', label: 'Auto opener' }) }))
    expect(res.status).toBe(400)
  })

  it('creates with auto-slugified key', async () => {
    vi.mocked(prisma.customFieldDef.create).mockResolvedValue({ id: 'd_new' } as never)
    const res = await createDef(mkReq('http://x', { method: 'POST', body: JSON.stringify({
      entity: 'lead', type: 'select', label: 'Industry Tier', options: ['A','B'],
    }) }))
    expect(res.status).toBe(201)
    expect(vi.mocked(prisma.customFieldDef.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ key: 'industry_tier' }) }),
    )
  })

  it('returns 409 on duplicate key', async () => {
    vi.mocked(prisma.customFieldDef.create).mockRejectedValue({ code: 'P2002' })
    const res = await createDef(mkReq('http://x', { method: 'POST', body: JSON.stringify({
      entity: 'lead', type: 'text', label: 'Industry Tier',
    }) }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/custom-fields/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when not owned', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue(null)
    const res = await patchDef(mkReq('http://x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })

  it('updates label + aiPrompt', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue({ id: 'd1' } as never)
    vi.mocked(prisma.customFieldDef.update).mockResolvedValue({ id: 'd1', label: 'New' } as never)
    const res = await patchDef(mkReq('http://x', {
      method: 'PATCH', body: JSON.stringify({ label: 'New', aiPrompt: 'Better prompt' }),
    }), { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.customFieldDef.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { label: 'New', aiPrompt: 'Better prompt' } }),
    )
  })

  it('rejects type changes (silently — type is not in EDITABLE_FIELDS)', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue({ id: 'd1' } as never)
    const res = await patchDef(mkReq('http://x', {
      method: 'PATCH', body: JSON.stringify({ type: 'number' }),
    }), { params: Promise.resolve({ id: 'd1' }) })
    // No editable fields supplied
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/custom-fields/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when nothing removed', async () => {
    vi.mocked(prisma.customFieldDef.deleteMany).mockResolvedValue({ count: 0 })
    const res = await deleteDef(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })

  it('ok on success', async () => {
    vi.mocked(prisma.customFieldDef.deleteMany).mockResolvedValue({ count: 1 })
    const res = await deleteDef(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/custom-fields/[id]/run', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when def is missing or not type=ai', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue(null)
    const res = await runOne(mkReq('http://x', { method: 'POST', body: JSON.stringify({ entityId: 'l1' }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(404)
  })

  it('400 when entityId missing', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue({
      id: 'd1', entity: 'lead', type: 'ai', aiPrompt: 'Hi {{firstName}}', key: 'opener', aiMaxTokens: 100,
    } as never)
    const res = await runOne(mkReq('http://x', { method: 'POST', body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(400)
  })

  it('happy path: renders prompt, calls generateText, writes value', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue({
      id: 'd1', entity: 'lead', type: 'ai', aiPrompt: 'Hi {{firstName}}', key: 'opener', aiMaxTokens: 100,
    } as never)
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({
      id: 'l1', firstName: 'Aakash', company: 'PhonePe', customFields: {}, aiColumnRuns: {},
    } as never)
    vi.mocked(generateText).mockResolvedValue('Hi Aakash, nice to e-meet.')
    vi.mocked(prisma.lead.update).mockResolvedValue({ id: 'l1' } as never)

    const res = await runOne(mkReq('http://x', { method: 'POST', body: JSON.stringify({ entityId: 'l1' }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
    expect(vi.mocked(generateText)).toHaveBeenCalledWith('Hi Aakash', expect.objectContaining({
      userId: 'user_test_123', maxTokens: 100,
    }))
  })

  it('502 + persisted failure when generateText throws', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue({
      id: 'd1', entity: 'lead', type: 'ai', aiPrompt: 'Hi {{firstName}}', key: 'opener', aiMaxTokens: 100,
    } as never)
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({
      id: 'l1', firstName: 'Aakash', customFields: {}, aiColumnRuns: {},
    } as never)
    vi.mocked(generateText).mockRejectedValue(new Error('no API key configured'))
    vi.mocked(prisma.lead.update).mockResolvedValue({ id: 'l1' } as never)

    const res = await runOne(mkReq('http://x', { method: 'POST', body: JSON.stringify({ entityId: 'l1' }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(502)
  })
})

describe('POST /api/custom-fields/[id]/run-all', () => {
  beforeEach(() => vi.clearAllMocks())

  it('400 when entityIds[] missing', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue({ id: 'd1', entity: 'lead', type: 'ai' } as never)
    const res = await runAll(mkReq('http://x', { method: 'POST', body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(400)
  })

  it('400 when batch over the cap', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue({ id: 'd1', entity: 'lead', type: 'ai' } as never)
    const ids = Array.from({ length: 51 }, (_, i) => `l${i}`)
    const res = await runAll(mkReq('http://x', { method: 'POST', body: JSON.stringify({ entityIds: ids }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(400)
  })

  it('runs across all ids and reports counts', async () => {
    vi.mocked(prisma.customFieldDef.findFirst).mockResolvedValue({
      id: 'd1', entity: 'lead', type: 'ai', aiPrompt: 'Hi {{firstName}}', key: 'opener', aiMaxTokens: 100,
    } as never)
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({
      id: 'l_any', firstName: 'X', customFields: {}, aiColumnRuns: {},
    } as never)
    vi.mocked(generateText).mockResolvedValue('AI text')
    vi.mocked(prisma.lead.update).mockResolvedValue({ id: 'l_any' } as never)

    const res = await runAll(mkReq('http://x', { method: 'POST', body: JSON.stringify({ entityIds: ['l1','l2','l3'] }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ done: 3, failed: 0, total: 3 })
  })
})
