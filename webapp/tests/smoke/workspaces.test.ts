import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { POST as createWorkspace } from '@/app/api/workspaces/route'
import { POST as inviteMember } from '@/app/api/workspaces/[id]/invite/route'
import { POST as joinWorkspace } from '@/app/api/workspaces/join/route'
import { PATCH as changeRole } from '@/app/api/workspaces/[id]/members/[memberId]/role/route'

const WORKSPACE_ID = 'ws_123'
const MEMBER_ID = 'member_456'

function makeRequest(body: object, method = 'POST') {
  return new NextRequest('http://localhost:3000', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string, extras: Record<string, string> = {}) {
  return { params: Promise.resolve({ id, ...extras }) }
}

describe('POST /api/workspaces', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await createWorkspace(makeRequest({ name: 'My Team' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 with empty name', async () => {
    const res = await createWorkspace(makeRequest({ name: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/name/i)
  })

  it('returns 400 with missing name', async () => {
    const res = await createWorkspace(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/name/i)
  })
})

describe('POST /api/workspaces/[id]/invite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await inviteMember(makeRequest({ email: 'a@b.com', role: 'member' }), makeParams(WORKSPACE_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when workspace not found', async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(null)
    const res = await inviteMember(makeRequest({ email: 'a@b.com', role: 'member' }), makeParams(WORKSPACE_ID))
    expect(res.status).toBe(404)
  })

  it('returns 400 with invalid email', async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      id: WORKSPACE_ID, name: 'Test WS', ownerId: 'user_test_123', createdAt: new Date(),
    } as any)
    const res = await inviteMember(makeRequest({ email: 'not-an-email', role: 'member' }), makeParams(WORKSPACE_ID))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/email/i)
  })
})

describe('POST /api/workspaces/join', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await joinWorkspace(makeRequest({ token: 'some-token' }))
    expect(res.status).toBe(401)
  })

  it('returns 404 with invalid token', async () => {
    vi.mocked(prisma.workspaceInvite.findUnique).mockResolvedValueOnce(null)
    const res = await joinWorkspace(makeRequest({ token: 'invalid-token' }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/invalid/i)
  })

  it('returns 400 with missing token', async () => {
    const res = await joinWorkspace(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/token/i)
  })
})

describe('PATCH /api/workspaces/[id]/members/[memberId]/role', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const params = { params: Promise.resolve({ id: WORKSPACE_ID, memberId: MEMBER_ID }) }
    const res = await changeRole(makeRequest({ role: 'admin' }, 'PATCH'), params)
    expect(res.status).toBe(401)
  })

  it('returns 403 when caller is a viewer', async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      id: WORKSPACE_ID, name: 'Test WS', ownerId: 'other_owner', createdAt: new Date(),
    } as any)
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({
      id: 'caller_member', workspaceId: WORKSPACE_ID, userId: 'user_test_123', role: 'viewer', joinedAt: new Date(),
    } as any)
    const params = { params: Promise.resolve({ id: WORKSPACE_ID, memberId: MEMBER_ID }) }
    const res = await changeRole(makeRequest({ role: 'admin' }, 'PATCH'), params)
    expect(res.status).toBe(403)
  })
})
