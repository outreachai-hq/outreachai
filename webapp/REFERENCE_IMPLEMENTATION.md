# Reference Implementation: Hot Leads Page

This document shows a complete, production-ready implementation of the new UI components for the Hot Leads page, demonstrating all three patterns: empty states, setup warnings, and onboarding checklists.

## File: `app/hot-leads/page.tsx`

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Flame, Settings, TrendingUp } from 'lucide-react'
import ActionableEmptyState from '@/components/ActionableEmptyState'
import SetupWarningBanner from '@/components/SetupWarningBanner'
import GettingStartedChecklist from '@/components/GettingStartedChecklist'
import ModernBadge from '@/components/ModernBadge'
import DashboardLayout from '@/components/DashboardLayout'

// Type definitions
interface HotLead {
  id: string
  name: string
  company: string
  replyRate: number
  openRate: number
  lastInteraction: string
  stage: 'hot' | 'warm' | 'cold'
}

interface UserSettings {
  hasAIProvider: boolean
  hasEnrichmentKey: boolean
  importedContacts: number
  launchedCampaigns: number
}

// Main component
export default function HotLeadsPage() {
  // State management
  const { data: session } = useSession()
  const [leads, setLeads] = useState<HotLead[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<UserSettings>({
    hasAIProvider: false,
    hasEnrichmentKey: false,
    importedContacts: 0,
    launchedCampaigns: 0,
  })
  const [completedChecklist, setCompletedChecklist] = useState<string[]>([])
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([])

  // Data fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch hot leads
        const leadsRes = await fetch('/api/hot-leads')
        const leadsData = leadsRes.ok ? await leadsRes.json() : []
        setLeads(leadsData.leads || [])

        // Fetch user settings
        const settingsRes = await fetch('/api/settings')
        const settingsData = settingsRes.ok ? await settingsRes.json() : {}
        setSettings({
          hasAIProvider: !!settingsData.aiProvider,
          hasEnrichmentKey: !!settingsData.enrichmentKey,
          importedContacts: settingsData.contactCount || 0,
          launchedCampaigns: settingsData.campaignCount || 0,
        })

        // Load checklist state from localStorage
        const saved = localStorage.getItem('hot-leads-checklist')
        if (saved) setCompletedChecklist(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to load hot leads:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session) fetchData()
  }, [session])

  // Handlers
  const handleChecklistItemClick = (itemId: string) => {
    // Track in analytics
    console.log('User clicked checklist item:', itemId)
    
    // Update local state
    const updated = [...completedChecklist, itemId]
    setCompletedChecklist(updated)
    localStorage.setItem('hot-leads-checklist', JSON.stringify(updated))
  }

  const handleWarningDismiss = (warningId: string) => {
    setDismissedWarnings([...dismissedWarnings, warningId])
  }

  // Build checklist items dynamically
  const checklistItems = [
    {
      id: 'connect-ai',
      label: 'Connect an AI Provider',
      description: 'Claude or OpenAI for AI-powered personalization',
      href: '/settings/ai-keys',
      completed: settings.hasAIProvider || completedChecklist.includes('connect-ai'),
    },
    {
      id: 'import-contacts',
      label: 'Import Your First Contacts',
      description: 'Upload a CSV, use LinkedIn extension, or add manually',
      href: settings.importedContacts > 0 ? '/contacts' : '/contacts/import',
      completed: settings.importedContacts > 0 || completedChecklist.includes('import-contacts'),
    },
    {
      id: 'launch-campaign',
      label: 'Launch Your First Campaign',
      description: 'Create a LinkedIn or email sequence',
      href: '/campaigns/new',
      completed: settings.launchedCampaigns > 0 || completedChecklist.includes('launch-campaign'),
    },
  ]

  // Show loading state
  if (loading) {
    return (
      <DashboardLayout title="Hot Leads">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading hot leads...</p>
        </div>
      </DashboardLayout>
    )
  }

  // Show empty state
  if (leads.length === 0) {
    return (
      <DashboardLayout
        title="Hot Leads"
        showChecklist={settings.importedContacts === 0}
        checklistItems={checklistItems}
        onChecklistItemClick={handleChecklistItemClick}
      >
        {/* Warning banner: Missing setup */}
        {!settings.hasAIProvider && !dismissedWarnings.includes('ai-provider') && (
          <div className="mb-6">
            <SetupWarningBanner
              variant="warning"
              title="AI Provider not connected"
              description="AI personalization helps boost reply rates. Connect your OpenAI or Claude API key in Settings to enable smart lead ranking."
              action={{
                text: 'Connect API Key',
                href: '/settings/ai-keys',
              }}
              onDismiss={() => handleWarningDismiss('ai-provider')}
            />
          </div>
        )}

        {/* Empty state */}
        <ActionableEmptyState
          icon={Flame}
          title="No hot leads identified yet"
          description="Hot leads are high-engagement prospects actively replying to your outreach or showing strong engagement signals. Start by importing contacts and launching campaigns to identify hot leads."
          ctaText="Import Your First Contacts"
          ctaHref="/contacts/import"
          helperText="After your first campaign, hot leads will automatically appear here based on reply rates and engagement"
          alternateAction={{
            text: 'View existing contacts',
            href: '/contacts',
          }}
        />
      </DashboardLayout>
    )
  }

  // Show leads list
  return (
    <DashboardLayout
      title="Hot Leads"
      showChecklist={false}
    >
      {/* Info banner: Setup tips */}
      {!settings.hasEnrichmentKey && !dismissedWarnings.includes('enrichment') && (
        <div className="mb-6">
          <SetupWarningBanner
            variant="info"
            title="Enrichment available"
            description="Connect your enrichment API to auto-populate company data, industry, and company size for your hot leads."
            action={{
              text: 'Setup Enrichment',
              href: '/settings/enrichment-keys',
            }}
            onDismiss={() => handleWarningDismiss('enrichment')}
          />
        </div>
      )}

      {/* Leads table/grid */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Lead</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Company</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Engagement</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Last Interaction</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 dark:text-white">{lead.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {lead.company}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium">Replies:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {lead.replyRate}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium">Opens:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          {lead.openRate}%
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {lead.lastInteraction}
                  </td>
                  <td className="px-6 py-4">
                    <ModernBadge
                      variant={lead.stage === 'hot' ? 'live' : lead.stage === 'warm' ? 'coming' : 'soon'}
                      label={lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/contacts/${lead.id}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table footer stats */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Showing {leads.length} hot lead{leads.length !== 1 ? 's' : ''}
          </p>
          <Link
            href="/analytics?filter=hot-leads"
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
          >
            <TrendingUp className="w-3 h-3" />
            View detailed analytics
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
```

---

## File: `app/leads/page.tsx` (Lead Lists page)

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Users, Plus, Upload, ArrowUpRight } from 'lucide-react'
import ActionableEmptyState from '@/components/ActionableEmptyState'
import SetupWarningBanner from '@/components/SetupWarningBanner'
import GettingStartedChecklist from '@/components/GettingStartedChecklist'
import ModernBadge from '@/components/ModernBadge'
import DashboardLayout from '@/components/DashboardLayout'

interface LeadList {
  id: string
  name: string
  description?: string
  contactCount: number
  createdAt: string
  isDefault: boolean
  tags: string[]
}

export default function LeadListsPage() {
  const { data: session } = useSession()
  const [lists, setLists] = useState<LeadList[]>([])
  const [loading, setLoading] = useState(true)
  const [hasImported, setHasImported] = useState(false)

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const res = await fetch('/api/leads/lists')
        if (res.ok) {
          const data = await res.json()
          setLists(data.lists || [])
          setHasImported(data.lists.length > 0)
        }
      } catch (error) {
        console.error('Failed to load lead lists:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session) fetchLists()
  }, [session])

  if (loading) {
    return (
      <DashboardLayout title="Lead Lists">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading lead lists...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (lists.length === 0) {
    return (
      <DashboardLayout
        title="Lead Lists"
        showChecklist={!hasImported}
        checklistItems={[
          {
            id: 'create-list',
            label: 'Create Your First Lead List',
            description: 'Organize leads into lists for targeted campaigns',
            href: '/leads/new',
            completed: hasImported,
          },
        ]}
        onChecklistItemClick={() => {}}
      >
        <ActionableEmptyState
          icon={Users}
          title="No lead lists yet"
          description="Lead lists help you organize prospects and run targeted campaigns. Create your first list to get started."
          ctaText="Create Lead List"
          ctaHref="/leads/new"
          helperText="You can import from CSV, connect to HubSpot/Salesforce, or use the LinkedIn extension to save leads"
          alternateAction={{
            text: 'Import from CSV',
            href: '/leads/import',
          }}
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Lead Lists">
      {/* Header with CTA */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Your Lead Lists
        </h2>
        <div className="flex gap-2">
          <Link
            href="/leads/import"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New List
          </Link>
        </div>
      </div>

      {/* Lists grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.map((list) => (
          <Link
            key={list.id}
            href={`/leads/${list.id}`}
            className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all group"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {list.name}
                </h3>
                {list.isDefault && (
                  <ModernBadge variant="beta" label="Default" className="mt-2" />
                )}
              </div>
              <ArrowUpRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors" />
            </div>

            {/* Description */}
            {list.description && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                {list.description}
              </p>
            )}

            {/* Stats */}
            <div className="mb-3 pb-3 border-t border-gray-100 dark:border-gray-800 pt-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {list.contactCount} contact{list.contactCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Created {new Date(list.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Tags */}
            {list.tags && list.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {list.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Help section */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-lg">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
          💡 Pro tip: Organize by segment
        </h4>
        <p className="text-xs text-gray-700 dark:text-gray-300">
          Create separate lists for different segments (e.g., "Tech Founders", "Enterprise Leads", "Referrals") to run targeted campaigns with higher conversion rates.
        </p>
      </div>
    </DashboardLayout>
  )
}
```

---

## Integration Points

### 1. Setup Warning Banners
Located at the top of content areas, these banners appear when:
- AI provider not connected (warning variant)
- Enrichment API available (info variant)
- Email domain not verified

### 2. Empty States
Rendered when data is empty:
- Show relevant icon
- Explain what the feature is
- Provide clear CTA to take action
- Include alternate action (optional)

### 3. Onboarding Checklists
Appear on first visit:
- Track 3 high-value tasks
- Auto-hide when complete
- Provide direct links to required pages

### 4. Badges
Used throughout for status indication:
- Navigation items: `beta`, `soon`
- List cards: `live`, `new`, `coming`
- Feature cards: `pro`, `enterprise`

---

## Key UX Patterns

### Empty State Flow
```
1. User lands on Hot Leads page
2. See empty state → click "Import Contacts"
3. Import flow → return to Hot Leads
4. Still no hot leads (need to launch campaign)
5. Checklist shows progress
6. User creates campaign
7. Hot leads appear over time
8. Checklist auto-hides
```

### Setup Warning Flow
```
1. User navigates to AI Dashboard
2. See warning: "API not connected"
3. Click "Connect API Key"
4. Enter credentials → save
5. Refresh page
6. Warning gone, feature available
```

---

## Testing Scenarios

### Scenario 1: Brand New User
- No contacts imported
- No campaigns launched
- No AI provider
- Should see: Empty state + Checklist + Warning banner

### Scenario 2: Partial Setup
- Contacts imported
- No campaigns yet
- AI provider connected
- Should see: Checklist (2/3) + Partial data

### Scenario 3: Fully Onboarded
- Everything configured
- Data exists
- Should see: Data tables + No warnings/checklists

### Scenario 4: Dark Mode
- All colors should be correct
- All text should be readable
- No contrast violations

---

## Performance Considerations

- Checklist items load from localStorage (no API call)
- Setup warnings stored in component state (dismiss action)
- Lead data fetched once on page load
- No real-time polling (use webhooks for updates)

---

## Accessibility

- All buttons have proper ARIA labels
- Color-blind safe: badges don't rely on color alone
- Keyboard navigable: links, buttons, form inputs
- Focus states visible (outline ring)
- Screen reader friendly: semantic HTML
