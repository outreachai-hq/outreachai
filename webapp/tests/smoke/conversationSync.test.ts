import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  upsertLinkedInConversation,
  dualWriteLinkedInThreads,
} from '@/lib/conversationSync'

const USER = 'user_test_123'

function snap(over: Partial<{
  profileId: string
  participantName: string
  participantUrl: string | null
  avatarUrl: string | null
  lastMessage: string
  lastSenderIsMe: boolean
  unread: boolean
}> = {}) {
  return {
    profileId: over.profileId ?? 'jane',
    participantName: over.participantName ?? 'Jane Doe',
    participantUrl: over.participantUrl ?? 'https://linkedin.com/in/jane',
    avatarUrl: over.avatarUrl ?? null,
    lastMessage: over.lastMessage ?? 'Hello there',
    lastSenderIsMe: over.lastSenderIsMe ?? false,
    unread: over.unread ?? true,
  }
}

const FAKE_NOW = new Date('2026-06-23T12:00:00.000Z')

describe('upsertLinkedInConversation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates Conversation + Message on first sight of a thread', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_1' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({} as any)

    await upsertLinkedInConversation(USER, snap(), FAKE_NOW)

    const upsertCall = vi.mocked(prisma.conversation.upsert).mock.calls[0]?.[0] as any
    expect(upsertCall.where.userId_channel_linkedinProfileId.channel).toBe('linkedin')
    expect(upsertCall.where.userId_channel_linkedinProfileId.linkedinProfileId).toBe('jane')
    expect(upsertCall.create.channel).toBe('linkedin')
    expect(upsertCall.create.participantName).toBe('Jane Doe')

    const msgCall = vi.mocked(prisma.message.create).mock.calls[0]?.[0] as any
    expect(msgCall.data.conversationId).toBe('conv_1')
    expect(msgCall.data.direction).toBe('in') // lastSenderIsMe=false => prospect sent
    expect(msgCall.data.body).toBe('Hello there')
    expect(msgCall.data.sentAt).toBe(FAKE_NOW)
  })

  it('passes lastSenderIsMe=true through as outbound direction', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_2' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)

    await upsertLinkedInConversation(USER, snap({ lastSenderIsMe: true }), FAKE_NOW)

    const msgCall = vi.mocked(prisma.message.create).mock.calls[0]?.[0] as any
    expect(msgCall.data.direction).toBe('out')
  })

  it('does NOT append a duplicate Message when body + direction unchanged', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_3' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce({
      body: 'Hello there',
      direction: 'in',
    } as any)

    await upsertLinkedInConversation(USER, snap(), FAKE_NOW)

    expect(vi.mocked(prisma.message.create)).not.toHaveBeenCalled()
  })

  it('appends a Message when direction changes (you replied -> they replied)', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_4' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce({
      body: 'Hello there',
      direction: 'out',
    } as any)

    await upsertLinkedInConversation(USER, snap({ lastMessage: 'Hello there', lastSenderIsMe: false }), FAKE_NOW)

    expect(vi.mocked(prisma.message.create)).toHaveBeenCalled()
    const msgCall = vi.mocked(prisma.message.create).mock.calls[0]?.[0] as any
    expect(msgCall.data.direction).toBe('in')
  })

  it('appends a Message when body changes (new content same direction)', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_5' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce({
      body: 'First message',
      direction: 'in',
    } as any)

    await upsertLinkedInConversation(USER, snap({ lastMessage: 'Second message' }), FAKE_NOW)

    expect(vi.mocked(prisma.message.create)).toHaveBeenCalled()
    const msgCall = vi.mocked(prisma.message.create).mock.calls[0]?.[0] as any
    expect(msgCall.data.body).toBe('Second message')
  })

  it('updates participantName/Url/avatarUrl on subsequent syncs', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_6' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)

    await upsertLinkedInConversation(
      USER,
      snap({ participantName: 'Jane Renamed', avatarUrl: 'https://x/a.png' }),
      FAKE_NOW
    )

    const upsertCall = vi.mocked(prisma.conversation.upsert).mock.calls[0]?.[0] as any
    expect(upsertCall.update.participantName).toBe('Jane Renamed')
    expect(upsertCall.update.avatarUrl).toBe('https://x/a.png')
    expect(upsertCall.update.syncedAt).toBe(FAKE_NOW)
    expect(upsertCall.update.lastMessageAt).toBe(FAKE_NOW)
  })
})

describe('dualWriteLinkedInThreads (batch)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports written count for a happy-path batch', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValue({ id: 'conv_x' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.message.create).mockResolvedValue({} as any)

    const result = await dualWriteLinkedInThreads(USER, [
      snap({ profileId: 'a' }),
      snap({ profileId: 'b' }),
      snap({ profileId: 'c' }),
    ])

    expect(result.written).toBe(3)
    expect(result.errors).toBe(0)
  })

  it('continues past a failing thread and counts errors', async () => {
    vi.mocked(prisma.conversation.upsert)
      .mockResolvedValueOnce({ id: 'conv_a' } as any)
      .mockRejectedValueOnce(new Error('db boom'))
      .mockResolvedValueOnce({ id: 'conv_c' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.message.create).mockResolvedValue({} as any)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await dualWriteLinkedInThreads(USER, [
      snap({ profileId: 'a' }),
      snap({ profileId: 'b' }),
      snap({ profileId: 'c' }),
    ])
    consoleSpy.mockRestore()

    expect(result.written).toBe(2)
    expect(result.errors).toBe(1)
  })

  it('returns 0/0 on an empty batch', async () => {
    const result = await dualWriteLinkedInThreads(USER, [])
    expect(result).toEqual({ written: 0, errors: 0 })
    expect(vi.mocked(prisma.conversation.upsert)).not.toHaveBeenCalled()
  })
})
