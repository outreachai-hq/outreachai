import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { NextRequest } from 'next/server'
import { GET as getNotifications } from '@/app/api/notifications/route'
import { GET as getOnboarding, POST as postOnboarding } from '@/app/api/onboarding/route'

function makePost(body: unknown) {
  return new NextRequest('http://localhost/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await getNotifications()
    expect(res.status).toBe(401)
  })

  it('returns notifications with unread count', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user_test_123', email: 'test@example.com', name: 'Test' },
    } as any)
    vi.mocked(prisma.contact.findMany)
      .mockResolvedValueOnce([{ id: 'c1', name: 'Alice', company: 'Acme', followupAt: new Date(), profileId: 'alice' }] as any)
      .mockResolvedValueOnce([{ id: 'c2', name: 'Bob', company: 'Beta', sentAt: new Date() }] as any) // recentReplies
    vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([
      { id: 't1', participantName: 'Bob', syncedAt: new Date(), participantUrl: null, messages: [{ body: 'Hi' }] },
    ] as any)

    const res = await getNotifications()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.unreadCount).toBe('number')
    expect(Array.isArray(json.notifications)).toBe(true)
  })

  it('returns empty notifications when none exist', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user_test_123', email: 'test@example.com', name: 'Test' },
    } as any)
    vi.mocked(prisma.contact.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([] as any)

    const res = await getNotifications()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.unreadCount).toBe(0)
    expect(json.notifications).toHaveLength(0)
  })
})

describe('GET /api/onboarding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await getOnboarding()
    expect(res.status).toBe(401)
  })

  it('returns step completion status', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user_test_123', email: 'test@example.com', name: 'Test' },
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      onboardingCompleted: false, onboardingStep: 1,
    } as any)
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce({ id: 'ea_1' } as any)
    vi.mocked(prisma.leadList.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.campaign.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.emailMessage.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.lead.findMany).mockResolvedValueOnce([] as any)
    // campaign, emailMessage, warmupAccount
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([] as any)

    const res = await getOnboarding()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.onboardingCompleted).toBe('boolean')
    expect(Array.isArray(json.steps)).toBe(true)
  })
})

describe('POST /api/onboarding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await postOnboarding(makePost({ step: 1 }))
    expect(res.status).toBe(401)
  })

  it('updates onboarding step', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user_test_123', email: 'test@example.com', name: 'Test' },
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      onboardingCompleted: false, onboardingStep: 2,
    } as any)
    const res = await postOnboarding(makePost({ step: 2 }))
    expect(res.status).toBe(200)
  })

  it('marks onboarding complete when step >= 5', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user_test_123', email: 'test@example.com', name: 'Test' },
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      onboardingCompleted: true, onboardingStep: 5,
    } as any)
    const res = await postOnboarding(makePost({ step: 5 }))
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onboardingCompleted: true }),
      })
    )
  })
})
