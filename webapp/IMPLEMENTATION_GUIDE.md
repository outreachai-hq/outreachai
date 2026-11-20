# UI Overhaul Implementation Guide

## Overview

This guide documents the complete UI overhaul for OutreachAI, addressing:
1. Viewport-locked layout with independent sidebar scrolling
2. Actionable empty states and contextual help
3. Progressive onboarding checklist
4. Modern, polished component styling

---

## Layout Architecture

### Core Changes

#### AppShell.tsx
The main application shell now uses viewport-locking:

```tsx
<div className="h-screen w-screen overflow-hidden flex">
  {/* Sidebar (fixed height, scrollable content) */}
  <Sidebar ... />
  
  {/* Main content (flex-1, scrolls independently) */}
  <div className="flex-1 flex flex-col overflow-hidden">
    <TopBar ... />
    <main className="flex-1 overflow-y-auto">{children}</main>
  </div>
</div>
```

**Key behaviors:**
- `h-screen w-screen overflow-hidden` locks the viewport to 100% height and width
- Sidebar uses `h-screen` and scrolls internally via `overflow-y-auto`
- Main content area (`<main>`) is `flex-1` with independent `overflow-y-auto`
- No page scrollbars ever "leak" outside the viewport

### Sidebar Architecture

The sidebar now has three distinct zones:

1. **Top (Sticky)**: Brand logo + workspace selector
   - Uses `px-4 py-4 border-b`
   - Always visible, never scrolls away

2. **Middle (Scrollable)**: Navigation groups
   - `overflow-y-auto` with independent scroll
   - Includes all nav sections: "Find & Manage", "Engage", "Grow", "Analyze", "Coming Soon"
   - Utility buttons (Notifications, Dark Mode, Extensions)

3. **Bottom (Sticky)**: Settings + user profile
   - `px-3 py-3 border-t`
   - Always visible, pinned to bottom
   - Plan badge, user avatar, logout button

---

## Component: ActionableEmptyState

**Purpose:** Transform empty states into actionable launchpads

**Location:** `webapp/components/ActionableEmptyState.tsx`

### Usage Example

```tsx
import ActionableEmptyState from '@/components/ActionableEmptyState'
import { Users } from 'lucide-react'

export default function ContactsPage() {
  return (
    <ActionableEmptyState
      icon={Users}
      title="No contacts yet"
      description="Start building your lead list. Import contacts from CSV, add them manually, or use our LinkedIn extension to save leads as you browse."
      ctaText="Import Your First List"
      ctaHref="/contacts/import"
      helperText="CSV templates are available for: LinkedIn data, HubSpot exports, Salesforce CSVs"
      alternateAction={{
        text: "Add contact manually",
        href: "/contacts/new",
      }}
    />
  )
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `icon` | `LucideIcon` | Yes | Icon to display (from lucide-react) |
| `title` | `string` | Yes | Main heading |
| `description` | `string` | Yes | Secondary description text |
| `ctaText` | `string` | Yes | Primary button text |
| `ctaHref` | `string` | Yes | Primary button link |
| `helperText` | `string` | No | Tip text in gray box below description |
| `alternateAction` | `{ text, href }` | No | Secondary button below primary |

### Visual Structure

```
┌─────────────────────────────┐
│  [Icon in blue bg]          │
├─────────────────────────────┤
│  Title                      │
│  Description text           │
│  💡 Helper tip              │
├─────────────────────────────┤
│  [Primary CTA Button] ← Blue│
│  [Alternate Button]   ← Gray│
└─────────────────────────────┘
```

---

## Component: SetupWarningBanner

**Purpose:** Notify users of missing prerequisites (API keys, configurations)

**Location:** `webapp/components/SetupWarningBanner.tsx`

### Usage Example

```tsx
import SetupWarningBanner from '@/components/SetupWarningBanner'

export default function AIDashboard() {
  const [dismissed, setDismissed] = useState(false)
  
  if (!apiKeyConnected) {
    return (
      <>
        <SetupWarningBanner
          variant="warning"
          title="AI Provider not connected"
          description="To use AI personalization in your campaigns, connect an OpenAI or Claude API key in Settings."
          action={{
            text: "Connect API Key",
            href: "/settings/ai-keys",
          }}
          onDismiss={() => setDismissed(true)}
        />
        {/* Feature UI below */}
      </>
    )
  }
  
  return <AIFeatureUI />
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Banner heading |
| `description` | `string` | Yes | Explanation text |
| `action` | `{ text, href }` | Yes | CTA button |
| `variant` | `'warning' \| 'info'` | No | Default: `'warning'` |
| `onDismiss` | `() => void` | No | Callback when user dismisses |

### Visual Variants

**Warning (default):**
```
⚠️ AI Provider not connected
   To use AI features, connect your API key...
   [Connect API Key] [X]
```
Colors: Amber/orange tones

**Info:**
```
ℹ️  Enrichment API available
    Enrich leads with company data...
    [Enable Enrichment] [X]
```
Colors: Blue tones

---

## Component: GettingStartedChecklist

**Purpose:** Progressive onboarding widget showing multi-step setup tasks

**Location:** `webapp/components/GettingStartedChecklist.tsx`

### Usage Example

```tsx
import GettingStartedChecklist from '@/components/GettingStartedChecklist'
import { useState } from 'react'

export default function Dashboard() {
  const [checklistState, setChecklistState] = useState({
    aiProvider: false,
    importedContacts: false,
    launchedSequence: false,
  })

  const checklistItems = [
    {
      id: 'ai-provider',
      label: 'Connect an AI Provider',
      description: 'OpenAI or Claude — set your API key in Settings',
      href: '/settings/ai-keys',
      completed: checklistState.aiProvider,
    },
    {
      id: 'import-contacts',
      label: 'Import Your First Contacts',
      description: 'Upload a CSV or use the LinkedIn extension',
      href: '/contacts/import',
      completed: checklistState.importedContacts,
    },
    {
      id: 'launch-sequence',
      label: 'Launch Your First Sequence',
      description: 'Create a LinkedIn or email campaign',
      href: '/campaigns/new',
      completed: checklistState.launchedSequence,
    },
  ]

  return (
    <div className="p-6">
      <GettingStartedChecklist
        items={checklistItems}
        onItemClick={(itemId) => {
          // Track which item was clicked for analytics
          console.log('User clicked:', itemId)
        }}
      />
    </div>
  )
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `ChecklistItem[]` | Yes | Array of checklist items |
| `onItemClick` | `(id: string) => void` | No | Callback when user clicks item |

### ChecklistItem Type

```tsx
interface ChecklistItem {
  id: string                 // Unique identifier
  label: string             // Item title
  description: string       // Subtitle/explanation
  href: string              // Link destination
  completed: boolean        // Is this item done?
}
```

### Visual Structure

When incomplete (shows):
```
├─ ▼ Get started in 3 steps
│  Progress: 1 of 3 completed
│  ██░░░░░░░░░░░░░░░░░░░░░░  (progress bar)
│
│  ☐ Connect an AI Provider
│    OpenAI or Claude — set your API key...
│                                      [Set up →]
│
│  ☐ Import Your First Contacts
│    Upload a CSV or use the LinkedIn extension
│                                      [Set up →]
│
│  ☐ Launch Your First Sequence
│    Create a LinkedIn or email campaign
│                                      [Set up →]
```

When complete (auto-hides):
- Component returns `null` when all items are checked
- Seamless removal from UI

---

## Component: ModernBadge

**Purpose:** Unified badge styling for status indicators

**Location:** `webapp/components/ModernBadge.tsx`

### Usage Examples

```tsx
import ModernBadge from '@/components/ModernBadge'

// In nav items, feature cards, etc.
<ModernBadge variant="beta" label="Beta" />
<ModernBadge variant="live" label="Live" />
<ModernBadge variant="soon" label="Coming Soon" />
<ModernBadge variant="pro" label="Pro Plan" />
```

### Variants

| Variant | Colors | Use Case |
|---------|--------|----------|
| `beta` | Blue | New/experimental features |
| `live` | Emerald | Currently available |
| `soon` | Gray | Coming soon |
| `coming` | Amber | Planned features |
| `new` | Rose | Recently launched |
| `pro` | Violet | Premium tier only |
| `enterprise` | Indigo | Enterprise feature |

### Styling Principles

Each variant uses:
- **Light background:** `bg-{color}-100 dark:bg-{color}-950/50`
- **Text color:** `text-{color}-700 dark:text-{color}-300`
- **Border:** `border border-{color}-200 dark:border-{color}-800/40`

This creates a soft, modern appearance with proper contrast in both light and dark modes.

---

## Component: DashboardLayout

**Purpose:** Standardized dashboard page wrapper with optional onboarding

**Location:** `webapp/components/DashboardLayout.tsx`

### Usage Example

```tsx
'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { useState } from 'react'

export default function CampaignsPage() {
  const [completedItems, setCompletedItems] = useState<string[]>([])

  const checklistItems = [
    {
      id: 'setup-api',
      label: 'Connect API Provider',
      description: 'Required for AI personalization',
      href: '/settings/ai-keys',
      completed: completedItems.includes('setup-api'),
    },
    // ... more items
  ]

  return (
    <DashboardLayout
      title="Campaigns"
      showChecklist={!userOnboarded}
      checklistItems={checklistItems}
      onChecklistItemClick={(id) => {
        setCompletedItems([...completedItems, id])
      }}
    >
      {/* Your campaigns UI here */}
      <div className="space-y-6">
        {/* Content */}
      </div>
    </DashboardLayout>
  )
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | Yes | Page content |
| `title` | `string` | No | Page title (hidden if omitted) |
| `showChecklist` | `boolean` | No | Default: `false` |
| `checklistItems` | `ChecklistItem[]` | No | Items for checklist |
| `onChecklistItemClick` | `(id: string) => void` | No | Callback handler |

---

## Sidebar Styling Updates

### Active Navigation Item

Active nav items now have:
```tsx
// Soft background tint
bg-blue-50 dark:bg-blue-900/40

// Sharp left-border accent line
border-l-2 border-blue-600 dark:border-blue-400

// Adjusted padding to account for border
pl-2.5 (instead of pl-3)

// Solid semibold text
font-semibold
```

### Badge Styling

Updated badge appearance:
```tsx
// Was: bg-blue-50 text-blue-600
// Now: bg-blue-100 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/40

// Consistent across all badge types (beta, soon, live, etc.)
```

### Section Labels

Reduced font weight for cleaner hierarchy:
```tsx
// Was: text-[11px] font-semibold
// Now: text-[10px] font-medium

// Colors softer
text-gray-500 dark:text-gray-500
```

---

## Integration Checklist

### Per Page Integration

When adding these components to an existing page:

- [ ] Import the component
- [ ] Identify the empty state condition
- [ ] Add SetupWarningBanner if prerequisites exist
- [ ] Add ActionableEmptyState for empty data
- [ ] Wire up onChecklistItemClick for analytics/tracking
- [ ] Test in both light and dark modes
- [ ] Verify links are correct
- [ ] Test on mobile (responsive checks)

### Example: Lead Lists Page

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import ActionableEmptyState from '@/components/ActionableEmptyState'
import SetupWarningBanner from '@/components/SetupWarningBanner'
import ModernBadge from '@/components/ModernBadge'
import { Users, Upload } from 'lucide-react'

export default function LeadListsPage() {
  const [lists, setLists] = useState([])
  const [hasEnrichmentKey, setHasEnrichmentKey] = useState(false)

  if (lists.length === 0) {
    return (
      <div className="p-6">
        {!hasEnrichmentKey && (
          <div className="mb-6">
            <SetupWarningBanner
              title="Enrichment API not configured"
              description="Connect your enrichment provider to auto-fill company data."
              action={{ text: 'Configure', href: '/settings/enrichment-keys' }}
            />
          </div>
        )}

        <ActionableEmptyState
          icon={Users}
          title="No lead lists yet"
          description="Create your first lead list to organize and manage prospects."
          ctaText="Create Lead List"
          ctaHref="/leads/new"
          helperText="You can import CSV files, add contacts manually, or save leads from LinkedIn"
          alternateAction={{
            text: "Import from CSV",
            href: "/leads/import",
          }}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {lists.map(list => (
        <div key={list.id} className="p-4 border rounded-lg">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold">{list.name}</h3>
            {list.isNew && <ModernBadge variant="new" label="New" />}
          </div>
          <p className="text-sm text-gray-600">{list.count} contacts</p>
        </div>
      ))}
    </div>
  )
}
```

---

## Dark Mode Considerations

All components include dark mode variants:

```tsx
// Light mode
className="bg-blue-50 text-blue-700 border border-blue-200"

// Dark mode
className="dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/40"
```

Key principles:
- Use `/40` to `/50` opacity on dark backgrounds for subtlety
- Text colors in dark mode are slightly lighter for contrast
- Borders use `/40` opacity for soft definition

---

## Typography Hierarchy

| Element | Font Size | Weight | Color |
|---------|-----------|--------|-------|
| Page title | `2xl` | bold | `gray-900` |
| Section header | `lg` | semibold | `gray-900` |
| Item label | `sm` | medium | `gray-900` |
| Helper text | `xs` | normal | `gray-600` |
| Muted labels | `[10px]` | medium | `gray-500` |

---

## Testing Checklist

- [ ] Sidebar doesn't overflow when scrolling
- [ ] Main content scrolls independently
- [ ] Empty states display with proper CTA
- [ ] Setup warnings appear and dismiss correctly
- [ ] Checklist completes and auto-hides
- [ ] All links work correctly
- [ ] Dark mode colors look correct
- [ ] Badges display in all variants
- [ ] Mobile responsive (sidebar drawer)
- [ ] Focus states visible (accessibility)

---

## Future Enhancements

1. **Persistent Checklist State:** Store completed items in localStorage/database
2. **Analytics:** Track which empty states users interact with
3. **A/B Testing:** Test different CTA copy variants
4. **Guided Tours:** Use Joyride/Hotspot for interactive walkthroughs
5. **Contextual Help:** Add help panels adjacent to complex features
