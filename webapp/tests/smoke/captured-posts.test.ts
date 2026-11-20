import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getUserId } from '@/lib/getUserId'
import { prisma } from '@/lib/prisma'

import { GET, POST } from '@/app/api/captured-posts/route'
import { POST as transform } from '@/app/api/captured-posts/[id]/transform/route'

vi.mock('@/lib/getUserId')
vi.mock('@/lib/ai', () => ({ generateText: vi.fn().mockResolvedValue('Generated content') }))

function makeReq(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const MOCK_POST = {
  id: 'cp_1', userId: 'user_test_123', profileId: 'john-doe',
  profileName: 'John Doe', profileUrl: 'https://linkedin.com/in/john-doe',
  postText: 'Great insight about sales!', postUrl: null,
  postedAt: null, likes: 42, comments: 5,
  twitterThread: null, linkedinRepost: null, newsletter: null,
  createdAt: new Date(),
}

describe('GET /api/captured-posts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce(null)
    const res = await GET(makeReq('GET', 'http://localhost/api/captured-posts'))
    expect(res.status).toBe(401)
  })

  it('returns all posts for authenticated user', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce('user_test_123')
    vi.mocked(prisma.capturedPost.findMany).mockResolvedValueOnce([MOCK_POST] as any)
    const res = await GET(makeReq('GET', 'http://localhost/api/captured-posts'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.posts).toHaveLength(1)
    expect(json.posts[0].profileName).toBe('John Doe')
  })

  it('filters by profileId when provided', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce('user_test_123')
    vi.mocked(prisma.capturedPost.findMany).mockResolvedValueOnce([])
    await GET(makeReq('GET', 'http://localhost/api/captured-posts?profileId=john-doe'))
    expect(prisma.capturedPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ profileId: 'john-doe' }) })
    )
  })
})

describe('POST /api/captured-posts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce(null)
    const res = await POST(makeReq('POST', 'http://localhost/api/captured-posts', { posts: [] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when posts array is empty', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce('user_test_123')
    const res = await POST(makeReq('POST', 'http://localhost/api/captured-posts', { posts: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when more than 20 posts submitted', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce('user_test_123')
    const posts = Array.from({ length: 21 }, (_, i) => ({
      profileId: `p${i}`, profileName: `Name ${i}`, postText: `Text ${i}`,
    }))
    const res = await POST(makeReq('POST', 'http://localhost/api/captured-posts', { posts }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when a post is missing required fields', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce('user_test_123')
    const res = await POST(makeReq('POST', 'http://localhost/api/captured-posts', {
      posts: [{ profileName: 'John' }], // missing profileId and postText
    }))
    expect(res.status).toBe(400)
  })

  it('creates posts and returns 201 for valid input', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce('user_test_123')
    vi.mocked(prisma.capturedPost.findMany).mockResolvedValueOnce([]) // no existing = no duplicates
    vi.mocked(prisma.capturedPost.createMany).mockResolvedValueOnce({ count: 1 })
    const res = await POST(makeReq('POST', 'http://localhost/api/captured-posts', {
      posts: [{ profileId: 'john-doe', profileName: 'John Doe', postText: 'Great post!' }],
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.saved).toBe(1)
  })
})

describe('POST /api/captured-posts/[id]/transform', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce(null)
    const req = makeReq('POST', 'http://localhost/api/captured-posts/cp_1/transform', { format: 'twitterThread' })
    const res = await transform(req, { params: Promise.resolve({ id: 'cp_1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when post not found', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce('user_test_123')
    vi.mocked(prisma.capturedPost.findFirst).mockResolvedValueOnce(null)
    const req = makeReq('POST', 'http://localhost/api/captured-posts/cp_missing/transform', { format: 'twitterThread' })
    const res = await transform(req, { params: Promise.resolve({ id: 'cp_missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid format', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce('user_test_123')
    vi.mocked(prisma.capturedPost.findFirst).mockResolvedValueOnce(MOCK_POST as any)
    const req = makeReq('POST', 'http://localhost/api/captured-posts/cp_1/transform', { format: 'invalidFormat' })
    const res = await transform(req, { params: Promise.resolve({ id: 'cp_1' }) })
    expect(res.status).toBe(400)
  })

  it('returns transformed content for valid format', async () => {
    vi.mocked(getUserId).mockResolvedValueOnce('user_test_123')
    vi.mocked(prisma.capturedPost.findFirst).mockResolvedValueOnce(MOCK_POST as any)
    vi.mocked(prisma.capturedPost.update).mockResolvedValueOnce({ ...MOCK_POST, twitterThread: 'Generated content' } as any)
    const req = makeReq('POST', 'http://localhost/api/captured-posts/cp_1/transform', { format: 'twitterThread' })
    const res = await transform(req, { params: Promise.resolve({ id: 'cp_1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.twitterThread).toBe('Generated content')
  })
})
