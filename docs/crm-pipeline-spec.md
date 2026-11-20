# OutreachAI — In-House CRM Pipeline Spec

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Pre-build review

---

## 1. Problem

OutreachAI already captures every prospect interaction (emails sent, LinkedIn touches, replies, calls) but has no way to track *where a deal stands commercially* — stage, value, close date, win probability. Users currently export to HubSpot or Pipedrive to manage this. This spec describes a native Deal + Pipeline feature that makes OutreachAI fully self-contained.

---

## 2. Goal

Add a **Sales Pipeline** to OutreachAI so users can:
- Track deals through custom stages (Kanban)
- See total pipeline value and forecast
- Link deals to existing Contacts and Companies
- Log notes and tasks directly on a deal
- Never need to export to an external CRM

**Non-goal:** Email integration (Google/Outlook mailbox sync) — out of scope for this iteration.

---

## 3. Core Concepts

### 3.1 Pipeline
A named collection of stages. Each user gets one default pipeline auto-created on first use. Users can create additional pipelines (e.g. "Enterprise", "SMB").

### 3.2 Stage
An ordered column within a pipeline. Default stages:

| Order | Name | Type |
|---|---|---|
| 1 | Lead | open |
| 2 | Qualified | open |
| 3 | Proposal Sent | open |
| 4 | Negotiating | open |
| 5 | Won | won |
| 6 | Lost | lost |

Users can rename, reorder, add, and delete stages (except the last Won/Lost which are required).

### 3.3 Deal
A revenue opportunity. Always belongs to one pipeline stage. Optionally linked to a Contact and/or Company.

**Deal fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| title | string | ✅ | e.g. "Acme Corp — Enterprise plan" |
| value | float | ❌ | Deal value in user's currency |
| currency | string | ❌ | Default: USD |
| closeDate | date | ❌ | Expected close date |
| probability | int (0–100) | ❌ | Win probability %; auto-set by stage but editable |
| contactId | FK → Contact | ❌ | Primary contact |
| companyId | FK → Company | ❌ | Associated company |
| description | text | ❌ | Free-form notes |
| status | enum | ✅ | open \| won \| lost |
| lostReason | string | ❌ | Only when status=lost |
| wonAt | datetime | ❌ | Only when status=won |
| lostAt | datetime | ❌ | Only when status=lost |
| createdAt | datetime | ✅ | Auto |
| updatedAt | datetime | ✅ | Auto |

### 3.4 DealActivity
Chronological log of everything that happens on a deal — notes, stage changes, emails linked, tasks created. Re-uses the existing `LeadActivity` model pattern (new `dealId` column added).

### 3.5 DealNote
A user-written note attached to a deal. Stored as `LeadActivity` with `type: 'note.added'` and `dealId` set.

---

## 4. Data Model

### New models

```prisma
model Pipeline {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String   @default("Sales Pipeline")
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  stages      PipelineStage[]
  deals       Deal[]

  @@index([userId])
}

model PipelineStage {
  id          String   @id @default(cuid())
  pipelineId  String
  pipeline    Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  name        String
  position    Int
  probability Int      @default(50)   // 0–100
  type        String   @default("open")  // open | won | lost
  color       String   @default("#6366f1")
  deals       Deal[]

  @@index([pipelineId, position])
}

model Deal {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  pipelineId  String
  pipeline    Pipeline       @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  stageId     String
  stage       PipelineStage  @relation(fields: [stageId], references: [id])

  title       String
  value       Float?
  currency    String         @default("USD")
  closeDate   DateTime?
  probability Int?
  description String?        @db.Text
  lostReason  String?

  contactId   String?        // plain FK — no Prisma relation (Contact already exists)
  companyId   String?        // plain FK — no Prisma relation

  status      String         @default("open")  // open | won | lost
  wonAt       DateTime?
  lostAt      DateTime?

  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  activities  DealActivity[]

  @@index([userId, stageId])
  @@index([userId, status])
  @@index([pipelineId])
}

model DealActivity {
  id         String   @id @default(cuid())
  dealId     String
  deal       Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  userId     String
  type       String   // 'note' | 'stage_change' | 'status_change' | 'call' | 'email'
  title      String
  body       String?  @db.Text
  payload    Json?
  createdAt  DateTime @default(now())
  actorUserId String?

  @@index([dealId, createdAt(sort: Desc)])
}
```

### Schema additions to existing models

```prisma
// User model — add:
pipelines    Pipeline[]
deals        Deal[]
```

---

## 5. API Routes

### Pipelines

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/pipelines` | ✅ | List user's pipelines with stage counts + deal counts |
| POST | `/api/pipelines` | ✅ | Create pipeline `{ name }` — auto-creates default stages |
| GET | `/api/pipelines/[id]` | ✅ | Pipeline detail with stages and deal counts per stage |
| PATCH | `/api/pipelines/[id]` | ✅ | Rename pipeline |
| DELETE | `/api/pipelines/[id]` | ✅ | Delete (only if no deals) |

### Stages

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/pipelines/[id]/stages` | ✅ | Add stage `{ name, position?, color?, probability? }` |
| PATCH | `/api/pipelines/[id]/stages/[stageId]` | ✅ | Update name/color/probability/position |
| DELETE | `/api/pipelines/[id]/stages/[stageId]` | ✅ | Delete stage (moves deals to previous stage) |
| POST | `/api/pipelines/[id]/stages/reorder` | ✅ | Reorder `{ stageIds: string[] }` |

### Deals

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/deals` | ✅ | List deals. Params: `?pipelineId=&stageId=&status=&q=` |
| POST | `/api/deals` | ✅ | Create deal |
| GET | `/api/deals/[id]` | ✅ | Deal detail with activities, contact, company |
| PATCH | `/api/deals/[id]` | ✅ | Update any field incl. `stageId` (stage move), `status` (won/lost) |
| DELETE | `/api/deals/[id]` | ✅ | Delete deal |

### Deal Activities

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/deals/[id]/activities` | ✅ | Chronological activity log |
| POST | `/api/deals/[id]/activities` | ✅ | Add note `{ type: 'note', body }` |

### Stats

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/deals/stats` | ✅ | Pipeline stats: total value, won value, conversion rate, avg deal size, deals by stage |

---

## 6. Pages

### 6.1 `/pipeline` — Kanban Board (main view)

**Layout:** Full-width horizontal scroll. One column per stage.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Pipeline ▾  [Sales Pipeline]       + New deal     [Board] [List]       │
├──────────────┬──────────────┬──────────────┬──────────────┬────────────┤
│ LEAD  (3)    │ QUALIFIED (2)│PROPOSAL (1)  │NEGOTIATING(1)│  WON  (5)  │
│ $12,000      │ $8,500       │ $4,000       │ $7,500       │ $28,000    │
├──────────────┼──────────────┼──────────────┼──────────────┼────────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │            │
│ │Acme Corp │ │ │ TechFlow │ │ │ BrightAI │ │ │Nexus Labs│ │  (empty)   │
│ │$5,000    │ │ │$4,000    │ │ │$4,000    │ │ │$7,500    │ │            │
│ │Sarah J.  │ │ │Mike P.   │ │ │          │ │ │          │ │            │
│ │Jun 30    │ │ │Jul 15    │ │ │          │ │ │          │ │            │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │            │
│ ┌──────────┐ │ ┌──────────┐ │              │              │            │
│ │ Zenith   │ │ │  Orbit   │ │  + Add deal  │  + Add deal  │ + Add deal │
│ │$3,500    │ │ │$4,500    │ │              │              │            │
│ └──────────┘ │ └──────────┘ │              │              │            │
│ ┌──────────┐ │              │              │              │            │
│ │ Polaris  │ │  + Add deal  │              │              │            │
│ │$3,500    │ │              │              │              │            │
│ └──────────┘ │              │              │              │            │
│  + Add deal  │              │              │              │            │
└──────────────┴──────────────┴──────────────┴──────────────┴────────────┘
```

**Deal card shows:**
- Title
- Value (formatted: $5,000)
- Contact avatar + name (if linked)
- Close date (colored red if overdue)
- Company name (if linked)

**Interactions:**
- Drag card between columns → moves deal to that stage → `PATCH /api/deals/[id]` with new `stageId` → auto-logs a `stage_change` activity
- Click card → opens Deal Detail slide-over (right panel)
- `+ Add deal` in column footer → opens quick-create form inline
- Board/List toggle switches to table view

### 6.2 Deal card quick-create (inline in column)

Clicking `+ Add deal` expands an inline form at the bottom of the column:

```
┌──────────────────────────────┐
│ Deal title *                  │
│ [________________________]   │
│ Value ($)     Close date      │
│ [________]   [____________]  │
│ Contact (optional)            │
│ [search contacts...]         │
│          [Cancel] [Add deal]  │
└──────────────────────────────┘
```

### 6.3 Deal Detail (slide-over panel, right side)

Slides in from the right when a deal card is clicked. Does not navigate away from the board.

```
┌──────────────────────────────────────────────────────┐
│ Acme Corp — Enterprise plan          [Edit] [⋯] [✕]  │
│ $5,000 · Jun 30 · 60% probability                    │
│ Stage: [Lead ▾]          Status: [Open]              │
├──────────────────────────────────────────────────────┤
│ 👤 Sarah Johnson · sarah@acme.com                    │
│ 🏢 Acme Corp · acme.com · SaaS · 51-200 employees   │
├──────────────────────────────────────────────────────┤
│ ACTIVITY                                             │
│                        [+ Add note] [+ Add task]     │
│ ● Stage changed: Lead → Qualified         Jun 23     │
│ ● Note: "Interested in enterprise tier"   Jun 22     │
│ ● Email sent: "Quick question, Sarah"     Jun 21     │
│ ● Deal created                            Jun 20     │
├──────────────────────────────────────────────────────┤
│ DESCRIPTION                                          │
│ Inbound from Product Hunt. Uses competitor X. POC   │
│ is Sarah, budget confirmed ~$5k/yr.                  │
└──────────────────────────────────────────────────────┘
```

**Actions:**
- Change stage from dropdown → logs stage change activity
- Mark Won → sets `status: 'won'`, `wonAt: now()` → moves to Won column
- Mark Lost → prompts for lost reason → sets `status: 'lost'`
- Add note → inline textarea → POST to `/api/deals/[id]/activities`
- Add task → opens task create form with `dealId` pre-filled
- Edit → opens full edit form (title, value, close date, contact, company, description, probability)
- Delete → confirm dialog

### 6.4 List view (toggle from Board)

A sortable table of all deals:

| | Title | Stage | Contact | Company | Value | Close date | Status |
|---|---|---|---|---|---|---|---|
| | Acme Corp… | Lead | Sarah J. | Acme | $5,000 | Jun 30 | 🟡 Open |
| | TechFlow… | Qualified | Mike P. | TechFlow | $4,000 | Jul 15 | 🟡 Open |
| | BrightAI… | Proposal | — | — | $4,000 | — | 🟡 Open |

Sortable by: title, value, close date, created date.  
Filterable by: stage, status, contact, company.

### 6.5 Pipeline stats bar (top of `/pipeline`)

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Total    │ Open     │ Won      │ Avg size │ Close    │
│ pipeline │ deals    │ this mo. │          │ rate     │
│ $32,000  │ 7        │ $28,000  │ $4,571   │ 41%      │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

### 6.6 Dashboard integration

Add a "Pipeline" KPI card to `/dashboard`:
- Total open pipeline value
- Deals closing this week (count)
- Link to `/pipeline`

### 6.7 "Add to pipeline" entry points

Users can create a deal from anywhere a contact/company is visible:

- **Contact detail page** → "Add to pipeline" button → opens deal create form with contact pre-filled
- **Company detail page** → "Add to pipeline" button → opens deal create form with company pre-filled  
- **Inbox conversation** → "Add to pipeline" button in conversation header → contact auto-linked if found
- **Hot Leads page** → per-lead "Add to pipeline" action

---

## 7. UX Details

### Stage color coding
Each stage has a configurable color. Defaults:
- Lead: `#94a3b8` (slate)
- Qualified: `#60a5fa` (blue)
- Proposal: `#a78bfa` (violet)
- Negotiating: `#f59e0b` (amber)
- Won: `#10b981` (emerald)
- Lost: `#f87171` (red)

### Drag-and-drop
Use HTML5 native drag-and-drop (same pattern as sequence step reordering already implemented). No external library needed.

### Currency
Stored as `Float` with a `currency` field. Display uses `Intl.NumberFormat` — no conversion, just formatting. USD default.

### Empty pipeline state
First-time users see:
```
No deals yet.
Start by adding your first deal or importing contacts from your campaigns.
[+ Add your first deal]
```

---

## 8. Settings: Pipeline configuration

Add a "Pipeline" section to `/settings` (or a dedicated `/settings/pipeline` page):

- Rename pipeline
- Add / rename / reorder / delete stages
- Set default probability per stage
- Set stage color
- Option to create a second pipeline (e.g. "Partnerships")

---

## 9. Migration

Single migration file `20260624000002_deal_pipeline`:

```sql
CREATE TABLE "Pipeline" (...)
CREATE TABLE "PipelineStage" (...)
CREATE TABLE "Deal" (...)
CREATE TABLE "DealActivity" (...)
```

Auto-seed: on first API call to `/api/pipelines`, if no pipeline exists for the user, create the default pipeline with 6 standard stages.

---

## 10. Out of scope (v1)

- Email threading on deals (link specific emails to a deal)
- Revenue forecasting charts (beyond the stats bar)
- Multiple currencies with conversion
- Deal templates
- Shared pipelines across workspace members (deferred until multi-tenancy lands)
- HubSpot/Salesforce import/export

---

## 11. Acceptance criteria

- [ ] User can create a deal with title, value, close date, contact, company
- [ ] Kanban board renders stages as columns with deal cards
- [ ] Dragging a card to a new column updates the stage and logs a stage change activity
- [ ] Deal detail slide-over shows activity timeline including linked lead activities
- [ ] User can mark a deal Won or Lost with a reason
- [ ] User can add notes to a deal
- [ ] Stats bar shows correct totals
- [ ] "Add to pipeline" button works from Contact, Company, Inbox, and Hot Leads
- [ ] Pipeline stages can be renamed and reordered in settings
- [ ] All API routes return 401 for unauthenticated requests
- [ ] 474 existing tests still pass after migration

---

## 12. Estimated effort

| Piece | Hours |
|---|---|
| Schema + migration + API routes | 3h |
| Kanban board + drag-and-drop | 3h |
| Deal detail slide-over | 2h |
| List view + filters | 1h |
| Stats bar + dashboard card | 1h |
| "Add to pipeline" entry points | 1h |
| Settings pipeline config | 1h |
| **Total** | **~12h** |
