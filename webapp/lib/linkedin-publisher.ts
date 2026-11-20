import { prisma } from '@/lib/prisma'
import { getLinkedInAccessToken, postToLinkedIn } from '@/lib/linkedin'

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)) }

// Finds all due scheduled posts and publishes them.
// Returns { published, failed, skipped }
export async function runLinkedInPublisher(): Promise<{ published: number; failed: number; skipped: number }> {
  const now = new Date()

  // Atomically claim due posts by moving them to 'processing' so concurrent
  // cron invocations don't double-publish the same post.
  await prisma.linkedInPost.updateMany({
    where: { status: 'scheduled', scheduledFor: { lte: now } },
    data:  { status: 'processing' },
  })

  const duePosts = await prisma.linkedInPost.findMany({
    where: { status: 'processing' },
    select: { id: true, userId: true, content: true },
  })

  if (duePosts.length === 0) return { published: 0, failed: 0, skipped: 0 }

  let published = 0, failed = 0, skipped = 0

  for (let i = 0; i < duePosts.length; i++) {
    const post = duePosts[i]

    // Find the user's default LinkedIn account with a memberId
    const account = await prisma.linkedInAccount.findFirst({
      where: { userId: post.userId, isDefault: true, linkedInMemberId: { not: null } },
      select: { id: true, linkedInMemberId: true },
    })

    if (!account) {
      await prisma.linkedInPost.update({
        where: { id: post.id },
        data: { status: 'skipped', error: 'No LinkedIn account connected' },
      })
      skipped++
      if (i < duePosts.length - 1) await sleep(500)
      continue
    }

    const token = await getLinkedInAccessToken(account.id)
    if (!token) {
      await prisma.linkedInPost.update({
        where: { id: post.id },
        data: { status: 'failed', error: 'Token expired — reconnect LinkedIn' },
      })
      failed++
      if (i < duePosts.length - 1) await sleep(500)
      continue
    }

    const result = await postToLinkedIn(token, account.linkedInMemberId!, post.content)
    if (result.success) {
      await prisma.linkedInPost.update({
        where: { id: post.id },
        data: { status: 'posted', postedAt: new Date(), linkedInPostId: result.postId ?? null },
      })
      published++
    } else {
      await prisma.linkedInPost.update({
        where: { id: post.id },
        data: { status: 'failed', error: result.error ?? 'LinkedIn API error' },
      })
      failed++
    }

    if (i < duePosts.length - 1) await sleep(500)
  }

  return { published, failed, skipped }
}
