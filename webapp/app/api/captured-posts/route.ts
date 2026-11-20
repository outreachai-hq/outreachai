import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get('profileId')

  const posts = await prisma.capturedPost.findMany({
    where: { userId, ...(profileId ? { profileId } : {}) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, profileId: true, profileName: true, profileUrl: true,
      postText: true, postUrl: true, postedAt: true, likes: true, comments: true,
      twitterThread: true, linkedinRepost: true, newsletter: true, createdAt: true,
    },
  })

  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { posts?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { posts } = body

  if (!Array.isArray(posts) || posts.length === 0)
    return NextResponse.json({ error: 'posts array required' }, { status: 400 })
  if (posts.length > 20)
    return NextResponse.json({ error: 'max 20 posts per request' }, { status: 400 })

  // Validate all posts before any writes
  for (const p of posts) {
    if (!p.postText?.trim() || !p.profileId || !p.profileName)
      return NextResponse.json({ error: 'postText, profileId, profileName required for every post' }, { status: 400 })
  }

  // Batch dedup: fetch all existing posts for this user+profile in one query
  const profileIds = [...new Set(posts.map((p: { profileId: string }) => p.profileId as string))]
  const existing = await prisma.capturedPost.findMany({
    where: { userId, profileId: { in: profileIds } },
    select: { postText: true },
  })
  const existingSnippets = new Set(existing.map(e => e.postText.slice(0, 200)))

  const toCreate = posts.filter(
    (p: { postText: string }) => !existingSnippets.has(p.postText.trim().slice(0, 200))
  )

  if (toCreate.length > 0) {
    await prisma.capturedPost.createMany({
      data: toCreate.map((p: { profileId: string; profileName: string; profileUrl?: string; postText: string; postUrl?: string; postedAt?: string; likes?: number; comments?: number }) => ({
        userId,
        profileId:   p.profileId,
        profileName: p.profileName,
        profileUrl:  p.profileUrl || null,
        postText:    p.postText.trim(),
        postUrl:     p.postUrl || null,
        postedAt:    p.postedAt || null,
        likes:       typeof p.likes === 'number' ? p.likes : null,
        comments:    typeof p.comments === 'number' ? p.comments : null,
      })),
    })
  }

  const saved = toCreate.length
  const skippedDuplicates = posts.length - saved
  const status = saved > 0 ? 201 : 200
  return NextResponse.json({ saved, skippedDuplicates }, { status })
}
