// Plan 9 (Iter 2) — smoke tests for the Dashboards + widget-data API.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

import { GET as listDashboards, POST as createDashboard } from '@/app/api/dashboards/route'
import { GET as getDashboard, PATCH as patchDashboard, DELETE as deleteDashboard } from '@/app/api/dashboards/[id]/route'
import { GET as widgetData } from '@/app/api/dashboards/[id]/widgets/[widgetId]/data/route'

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof patchDashboard>[0]
}

describe('GET /api/dashboards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns existing dashboards without seeding', async () => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValue([
      { id: 'd1', name: 'Existing', tabs: [], userId: 'u' } as never,
    ])
    const res = await listDashboards()
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.dashboard.create)).not.toHaveBeenCalled()
  })

  it('auto-seeds an Overview dashboard on first call', async () => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValue([])
    vi.mocked(prisma.dashboard.create).mockResolvedValue({ id: 'd_new', name: 'Overview' } as never)
    const res = await listDashboards()
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.dashboard.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Overview' }) }),
    )
  })
})

describe('POST /api/dashboards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty name', async () => {
    const res = await createDashboard(mkReq('http://x', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(400)
  })

  it('creates an empty-tab dashboard by default', async () => {
    vi.mocked(prisma.dashboard.count).mockResolvedValue(1)
    vi.mocked(prisma.dashboard.create).mockResolvedValue({ id: 'd2' } as never)
    const res = await createDashboard(mkReq('http://x', { method: 'POST', body: JSON.stringify({ name: 'Outbound' }) }))
    expect(res.status).toBe(201)
    expect(vi.mocked(prisma.dashboard.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Outbound', position: 1 }) }),
    )
  })

  it('uses Overview template when requested', async () => {
    vi.mocked(prisma.dashboard.count).mockResolvedValue(0)
    vi.mocked(prisma.dashboard.create).mockResolvedValue({ id: 'd3' } as never)
    await createDashboard(mkReq('http://x', { method: 'POST', body: JSON.stringify({ name: 'My OV', template: 'overview' }) }))
    // tabs JSON should be an array with at least one tab populated by defaultOverviewTabs()
    const args = vi.mocked(prisma.dashboard.create).mock.calls[0][0]
    const tabs = (args.data as unknown as { tabs: unknown[] }).tabs
    expect(Array.isArray(tabs)).toBe(true)
    expect((tabs as Array<{ widgets: unknown[] }>)[0].widgets.length).toBeGreaterThan(0)
  })
})

describe('GET /api/dashboards/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when not owned', async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue(null)
    const res = await getDashboard(mkReq('http://x'), { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })

  it('returns dashboard when owned', async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({ id: 'd1', name: 'X' } as never)
    const res = await getDashboard(mkReq('http://x'), { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/dashboards/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty body', async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({ id: 'd1' } as never)
    const res = await patchDashboard(mkReq('http://x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(400)
  })

  it('updates name + tabs JSON', async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({ id: 'd1' } as never)
    vi.mocked(prisma.dashboard.update).mockResolvedValue({ id: 'd1', name: 'New' } as never)
    const res = await patchDashboard(mkReq('http://x', { method: 'PATCH', body: JSON.stringify({
      name: 'New', tabs: [{ id: 't1', name: 'T', widgets: [] }],
    }) }), { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/dashboards/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when nothing removed', async () => {
    vi.mocked(prisma.dashboard.deleteMany).mockResolvedValue({ count: 0 })
    const res = await deleteDashboard(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/dashboards/[id]/widgets/[widgetId]/data', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when dashboard missing', async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue(null)
    const res = await widgetData(mkReq('http://x'),
      { params: Promise.resolve({ id: 'd1', widgetId: 'w1' }) })
    expect(res.status).toBe(404)
  })

  it('404 when widget id not found in tabs', async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({
      tabs: [{ id: 't1', widgets: [{ id: 'w_other', type: 'kpi.number', title: 'X', config: {}, position: 0 }] }],
      filters: {},
    } as never)
    const res = await widgetData(mkReq('http://x'),
      { params: Promise.resolve({ id: 'd1', widgetId: 'w_missing' }) })
    expect(res.status).toBe(404)
  })

  it('dispatches to runWidget for known type', async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({
      tabs: [{
        id: 't1',
        widgets: [{
          id: 'w_kpi', type: 'kpi.number', title: 'X',
          config: { metric: 'emails_sent', window: '30d' }, position: 0,
        }],
      }],
      filters: {},
    } as never)
    vi.mocked(prisma.emailMessage.count).mockResolvedValue(42)

    const res = await widgetData(mkReq('http://x'),
      { params: Promise.resolve({ id: 'd1', widgetId: 'w_kpi' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.type).toBe('kpi.number')
    expect(json.data).toMatchObject({ value: 42 })
  })

  it('500 when widget type unknown', async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({
      tabs: [{ id: 't1', widgets: [{ id: 'w', type: 'fake.type', title: 'X', config: {}, position: 0 }] }],
      filters: {},
    } as never)
    const res = await widgetData(mkReq('http://x'),
      { params: Promise.resolve({ id: 'd1', widgetId: 'w' }) })
    expect(res.status).toBe(500)
  })
})
