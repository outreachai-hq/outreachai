// Plan 7 (Iter 4) — smoke tests for the Conversation Labels API + helper.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

import { GET as listLabels, POST as createLabel } from '@/app/api/conversation-labels/route'
import { PATCH as patchLabel, DELETE as deleteLabel } from '@/app/api/conversation-labels/[id]/route'
import { ensureBuiltinLabels, BUILT_IN_LABELS, slugifyLabelKey } from '@/lib/conversationLabels'

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof patchLabel>[0]
}

describe('slugifyLabelKey', () => {
  it('lowercases + underscores', () => {
    expect(slugifyLabelKey('Hot Deal Q3!')).toBe('hot_deal_q3')
  })
  it('falls back to "label" for empty input', () => {
    expect(slugifyLabelKey('   ')).toBe('label')
  })
})

describe('ensureBuiltinLabels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts all 5 built-in keys', async () => {
    vi.mocked(prisma.conversationLabel.upsert).mockResolvedValue({} as never)
    await ensureBuiltinLabels('user_1')
    expect(vi.mocked(prisma.conversationLabel.upsert)).toHaveBeenCalledTimes(BUILT_IN_LABELS.length)
    for (const b of BUILT_IN_LABELS) {
      expect(vi.mocked(prisma.conversationLabel.upsert)).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId_key: { userId: 'user_1', key: b.key } } }),
      )
    }
  })
})

describe('GET /api/conversation-labels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seeds built-ins then returns the list', async () => {
    vi.mocked(prisma.conversationLabel.upsert).mockResolvedValue({} as never)
    vi.mocked(prisma.conversationLabel.findMany).mockResolvedValue([
      { id: 'l1', key: 'interested', label: 'Interested', builtIn: true } as never,
    ])
    const res = await listLabels()
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.conversationLabel.upsert)).toHaveBeenCalled()
    const json = await res.json()
    expect(json.labels).toHaveLength(1)
  })
})

describe('POST /api/conversation-labels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects missing label', async () => {
    const res = await createLabel(mkReq('http://x', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(400)
  })

  it('creates a custom label with auto-slugified key', async () => {
    vi.mocked(prisma.conversationLabel.count).mockResolvedValue(5)
    vi.mocked(prisma.conversationLabel.create).mockResolvedValue({ id: 'l_new' } as never)
    await createLabel(mkReq('http://x', {
      method: 'POST', body: JSON.stringify({ label: 'Hot Q3 deal', color: '#abc' }),
    }))
    expect(vi.mocked(prisma.conversationLabel.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'hot_q3_deal',
          color: '#abc',
          builtIn: false,
          position: 6,
        }),
      }),
    )
  })

  it('returns 409 on duplicate key', async () => {
    vi.mocked(prisma.conversationLabel.count).mockResolvedValue(0)
    vi.mocked(prisma.conversationLabel.create).mockRejectedValue({ code: 'P2002' })
    const res = await createLabel(mkReq('http://x', {
      method: 'POST', body: JSON.stringify({ label: 'Interested' }),
    }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/conversation-labels/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renames and recolors a built-in label', async () => {
    vi.mocked(prisma.conversationLabel.findFirst).mockResolvedValue({ id: 'l1', builtIn: true } as never)
    vi.mocked(prisma.conversationLabel.update).mockResolvedValue({ id: 'l1', label: 'V important' } as never)
    const res = await patchLabel(mkReq('http://x', {
      method: 'PATCH', body: JSON.stringify({ label: 'V important', color: '#ff8800' }),
    }), { params: Promise.resolve({ id: 'l1' }) })
    expect(res.status).toBe(200)
  })

  it('404 when not owned', async () => {
    vi.mocked(prisma.conversationLabel.findFirst).mockResolvedValue(null)
    const res = await patchLabel(mkReq('http://x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/conversation-labels/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks deletion of a built-in label', async () => {
    vi.mocked(prisma.conversationLabel.findFirst).mockResolvedValue({ id: 'l1', builtIn: true, key: 'interested' } as never)
    const res = await deleteLabel(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'l1' }) })
    expect(res.status).toBe(400)
  })

  it('deletes a custom label + scrubs it from conversations', async () => {
    vi.mocked(prisma.conversationLabel.findFirst).mockResolvedValue({ id: 'l1', builtIn: false, key: 'hot_deal' } as never)
    vi.mocked(prisma.$executeRaw).mockResolvedValue(0 as never)
    vi.mocked(prisma.conversationLabel.delete).mockResolvedValue({ id: 'l1' } as never)
    const res = await deleteLabel(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'l1' }) })
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.$executeRaw)).toHaveBeenCalled()
    expect(vi.mocked(prisma.conversationLabel.delete)).toHaveBeenCalled()
  })

  it('404 when not owned', async () => {
    vi.mocked(prisma.conversationLabel.findFirst).mockResolvedValue(null)
    const res = await deleteLabel(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })
})
