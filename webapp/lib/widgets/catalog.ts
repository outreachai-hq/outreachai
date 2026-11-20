// Plan 9 — widget catalog.
//
// Five widget types ship in v1. Each entry carries:
//   - label:   short human name shown in the add-widget modal
//   - config:  shape of the per-widget settings JSON (declarative)
//   - defaults: starting config when a fresh instance is added
//
// Each type also has a matching server-side query in `./queries.ts`. To add
// a new widget: define the type here + the query + a renderer component.

export type WidgetType =
  | 'kpi.number'
  | 'chart.line'
  | 'funnel.lead'
  | 'table.hot_leads'
  | 'table.recent_replies'

export type MetricKey =
  | 'emails_sent'
  | 'opens'
  | 'clicks'
  | 'replies'
  | 'linkedin_sent'
  | 'bounces'
  | 'meetings_booked'
  | 'hot_leads'
  | 'tasks_pending'

export type WindowKey = 'today' | '7d' | '30d' | '90d' | 'all'
export type Granularity = 'day' | 'week' | 'month'

export type Widget = {
  id:       string
  type:     WidgetType
  title:    string
  config:   Record<string, unknown>
  position: number
}

export type Tab = {
  id:      string
  name:    string
  widgets: Widget[]
}

export type CatalogEntry = {
  label:     string
  desc:      string
  defaults:  Record<string, unknown>
  metrics?:  ReadonlyArray<MetricKey>
}

export const CATALOG: Record<WidgetType, CatalogEntry> = {
  'kpi.number': {
    label: 'KPI — Number',
    desc:  'Single large number for one metric across a time window.',
    defaults: { metric: 'emails_sent' as MetricKey, window: '30d' as WindowKey },
    metrics: ['emails_sent', 'opens', 'clicks', 'replies', 'linkedin_sent', 'bounces', 'hot_leads', 'tasks_pending'] as const,
  },
  'chart.line': {
    label: 'Line chart',
    desc:  'Daily/weekly time series for one metric.',
    defaults: { metric: 'emails_sent' as MetricKey, window: '30d' as WindowKey, granularity: 'day' as Granularity },
    metrics: ['emails_sent', 'opens', 'clicks', 'replies', 'linkedin_sent', 'bounces'] as const,
  },
  'funnel.lead': {
    label: 'Lead funnel',
    desc:  'pending → in-progress → completed → replied stages.',
    defaults: { window: '30d' as WindowKey },
  },
  'table.hot_leads': {
    label: 'Hot leads table',
    desc:  'Top leads by engagement score.',
    defaults: { limit: 10 },
  },
  'table.recent_replies': {
    label: 'Recent replies',
    desc:  'Most recent inbound conversations across channels.',
    defaults: { limit: 10 },
  },
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  emails_sent:     'Emails sent',
  opens:           'Opens',
  clicks:          'Clicks',
  replies:         'Replies',
  linkedin_sent:   'LinkedIn sent',
  bounces:         'Bounces',
  meetings_booked: 'Meetings booked',
  hot_leads:       'Hot leads',
  tasks_pending:   'Tasks pending',
}

export function computeSinceMs(window: WindowKey): Date | null {
  const now = Date.now()
  const DAY = 86_400_000
  switch (window) {
    case 'today': {
      const d = new Date(); d.setHours(0, 0, 0, 0); return d
    }
    case '7d':   return new Date(now - 7  * DAY)
    case '30d':  return new Date(now - 30 * DAY)
    case '90d':  return new Date(now - 90 * DAY)
    case 'all':  return null
  }
}

// Server-friendly random id; not crypto-strong but fine for inline widget ids.
export function makeId(prefix = 'w'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function defaultOverviewTabs(): Tab[] {
  return [
    {
      id: makeId('tab'),
      name: 'Overview',
      widgets: [
        { id: makeId(), type: 'kpi.number',         title: 'Emails sent',     config: { metric: 'emails_sent',  window: '30d' }, position: 0 },
        { id: makeId(), type: 'kpi.number',         title: 'Replies',         config: { metric: 'replies',      window: '30d' }, position: 1 },
        { id: makeId(), type: 'kpi.number',         title: 'Hot leads',       config: { metric: 'hot_leads',    window: '30d' }, position: 2 },
        { id: makeId(), type: 'chart.line',         title: 'Emails sent / day', config: { metric: 'emails_sent', window: '30d', granularity: 'day' }, position: 3 },
        { id: makeId(), type: 'funnel.lead',        title: 'Lead funnel',     config: { window: '30d' }, position: 4 },
        { id: makeId(), type: 'table.hot_leads',    title: 'Top hot leads',   config: { limit: 10 }, position: 5 },
        { id: makeId(), type: 'table.recent_replies', title: 'Recent replies', config: { limit: 10 }, position: 6 },
      ],
    },
  ]
}
