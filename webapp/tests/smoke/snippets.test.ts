// Plan 7 (Iter 2) — smoke tests for the Snippets API.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

import { GET as listSnippets, POST as createSnippet } from '@/app/api/snippets/route'
import { PATCH as patchSnippet, DELETE as deleteSnippet } from '@/app/api/snippets/[id]/route'

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof patchSnippet>[0]
}

describe('GET /api/snippets', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user-scoped snippets', async () => {
    vi.mocked(prisma.snippet.findMany).mockResolvedValue([
      { id: 's1', key: 'intro', label: 'Intro', body: 'Hi {{firstName}}' } as never,
    ])
    const res = await listSnippets()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.snippets).toHaveLength(1)
    expect(json.snippets[0].key).toBe('intro')
  })
})

describe('POST /api/snippets', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects missing label or body', async () => {
    const res = await createSnippet(mkReq('http://x/api/snippets', {
      method: 'POST', body: JSON.stringify({ label: 'Only label' }),
    }))
    expect(res.status).toBe(400)
  })

  it('auto-slugifies label into key when key omitted', async () => {
    vi.mocked(prisma.snippet.create).mockResolvedValue({ id: 's1' } as never)
    await createSnippet(mkReq('http://x/api/snippets', {
      method: 'POST',
      body: JSON.stringify({ label: 'Intro Signoff!!', body: 'Cheers' }),
    }))
    expect(vi.mocked(prisma.snippet.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ key: 'intro_signoff' }) })
    )
  })

  it('normalises a caller-supplied key the same way', async () => {
    vi.mocked(prisma.snippet.create).mockResolvedValue({ id: 's1' } as never)
    await createSnippet(mkReq('http://x/api/snippets', {
      method: 'POST',
      body: JSON.stringify({ label: 'X', body: 'y', key: 'My Custom Key' }),
    }))
    expect(vi.mocked(prisma.snippet.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ key: 'my_custom_key' }) })
    )
  })

  it('returns 409 on duplicate key (P2002)', async () => {
    vi.mocked(prisma.snippet.create).mockRejectedValue({ code: 'P2002' })
    const res = await createSnippet(mkReq('http://x/api/snippets', {
      method: 'POST',
      body: JSON.stringify({ label: 'Intro', body: 'Cheers' }),
    }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/snippets/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when not owned', async () => {
    vi.mocked(prisma.snippet.findFirst).mockResolvedValue(null)
    const res = await patchSnippet(mkReq('http://x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })

  it('rejects an empty patch', async () => {
    vi.mocked(prisma.snippet.findFirst).mockResolvedValue({ id: 's1' } as never)
    const res = await patchSnippet(mkReq('http://x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 's1' }) })
    expect(res.status).toBe(400)
  })

  it('updates label + body', async () => {
    vi.mocked(prisma.snippet.findFirst).mockResolvedValue({ id: 's1' } as never)
    vi.mocked(prisma.snippet.update).mockResolvedValue({ id: 's1', label: 'New' } as never)
    const res = await patchSnippet(mkReq('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ label: 'New', body: 'New body' }),
    }), { params: Promise.resolve({ id: 's1' }) })
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.snippet.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { label: 'New', body: 'New body' } })
    )
  })
})

describe('DELETE /api/snippets/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 if nothing deleted', async () => {
    vi.mocked(prisma.snippet.deleteMany).mockResolvedValue({ count: 0 })
    const res = await deleteSnippet(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })

  it('returns ok when row removed', async () => {
    vi.mocked(prisma.snippet.deleteMany).mockResolvedValue({ count: 1 })
    const res = await deleteSnippet(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 's1' }) })
    expect(res.status).toBe(200)
  })
})
