# OutreachAI — Workflow Automation Spec

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Pre-build review

---

## 1. What It Is

A rule engine that watches for events across OutreachAI and automatically executes actions when conditions are met. Think "If This Then That" — but purpose-built for outreach and sales.

**Examples:**
- "When a lead replies → mark deal as Qualified + create follow-up task"
- "When email opened 3+ times → add tag 'Hot' + send in-app notification"
- "When deal won → send congratulations webhook to Slack"
- "When booking confirmed → create deal in pipeline"
- "When lead score > 70 → enroll in next campaign"

---

## 2. Core Concepts

### 2.1 Workflow
A named automation rule with:
1. **One trigger** — what starts it
2. **Zero or more conditions** — optional filters
3. **One or more actions** — what to execute

### 2.2 Trigger
The event that fires the workflow. Each trigger fires with a **payload** (the object that changed — a lead, deal, conversation, etc.)

### 2.3 Condition
A filter applied to the trigger payload. If conditions exist, ALL must pass (AND logic). Optional.

### 2.4 Action
Something to do when trigger fires and conditions pass. Actions run sequentially.

### 2.5 WorkflowRun
A log entry recording that a workflow fired — which entity triggered it, timestamp, result (success/skipped/error).

---

## 3. Triggers Catalogue

### Lead / Contact triggers

| Trigger key | Fires when | Payload |
|---|---|---|
| `lead.replied` | Lead replies to a sequence email | `{ leadId, campaignId, conversationId }` |
| `lead.email_opened` | Lead opens an email | `{ leadId, campaignId, openCount }` |
| `lead.email_clicked` | Lead clicks a link | `{ leadId, campaignId, url }` |
| `lead.score_changed` | Lead score updates | `{ leadId, score, previousScore }` |
| `lead.bounced` | Email bounces | `{ leadId, campaignId }` |
| `lead.created` | New lead added to a list | `{ leadId, leadListId }` |
| `lead.enriched` | Lead enrichment completes | `{ leadId, provider }` |
| `contact.created` | New contact created | `{ contactId }` |
| `contact.status_changed` | Contact status changes | `{ contactId, from, to }` |

### Deal triggers

| Trigger key | Fires when | Payload |
|---|---|---|
| `deal.created` | New deal created | `{ dealId, stageId, pipelineId }` |
| `deal.stage_changed` | Deal moves to a new stage | `{ dealId, fromStageId, toStageId }` |
| `deal.won` | Deal marked Won | `{ dealId, value }` |
| `deal.lost` | Deal marked Lost | `{ dealId, lostReason }` |
| `deal.close_date_passed` | Close date passed without closing | `{ dealId }` — checked by daily cron |

### Conversation triggers

| Trigger key | Fires when | Payload |
|---|---|---|
| `conversation.reply_received` | Inbound message in any channel | `{ conversationId, channel, leadId? }` |
| `conversation.label_added` | Label applied to conversation | `{ conversationId, label }` |

### Booking triggers

| Trigger key | Fires when | Payload |
|---|---|---|
| `booking.confirmed` | Meeting booked | `{ bookingId, guestEmail, startAt }` |
| `booking.cancelled` | Booking cancelled | `{ bookingId }` |

### Task triggers

| Trigger key | Fires when | Payload |
|---|---|---|
| `task.completed` | Task marked done | `{ taskId, leadId? }` |
| `task.overdue` | Task past due date (daily cron) | `{ taskId, leadId? }` |

### Signal triggers

| Trigger key | Fires when | Payload |
|---|---|---|
| `signal.fired` | Watchlist signal fires | `{ signalId, watchlistId, leadId? }` |

---

## 4. Conditions Catalogue

Conditions filter the trigger payload. All use the shape `{ field, operator, value }`.

### Lead/Contact conditions

| Field | Operators | Example |
|---|---|---|
| `lead.score` | `gt`, `lt`, `gte`, `lte`, `eq` | score > 50 |
| `lead.status` | `eq`, `not_eq` | status = replied |
| `lead.email` | `contains`, `not_contains`, `ends_with` | email ends_with @acme.com |
| `lead.company` | `eq`, `contains`, `is_empty`, `not_empty` | company is_not_empty |
| `lead.tags` | `contains`, `not_contains` | tags contains "enterprise" |
| `lead.openCount` | `gt`, `gte` | openCount >= 3 |
| `campaign.id` | `eq`, `not_eq` | campaignId = camp_1 |

### Deal conditions

| Field | Operators |
|---|---|
| `deal.value` | `gt`, `lt`, `gte`, `lte` |
| `deal.stageId` | `eq`, `not_eq` |
| `deal.status` | `eq` |

### Conversation conditions

| Field | Operators |
|---|---|
| `conversation.channel` | `eq` (email / linkedin) |
| `conversation.labels` | `contains` |

---

## 5. Actions Catalogue

### Lead / Contact actions

| Action key | What it does | Config |
|---|---|---|
| `lead.add_tag` | Adds a tag to the lead | `{ tag: string }` |
| `lead.remove_tag` | Removes a tag | `{ tag: string }` |
| `lead.update_status` | Sets lead status | `{ status: string }` |
| `lead.enrich` | Triggers enrichment | `{ provider: 'apollo' \| 'hunter' }` |
| `lead.enroll_campaign` | Enrolls in a campaign | `{ campaignId: string }` |

### Deal actions

| Action key | What it does | Config |
|---|---|---|
| `deal.create` | Creates a deal in pipeline | `{ pipelineId, stageId, title?, valueFromLead? }` |
| `deal.change_stage` | Moves deal to a stage | `{ stageId: string }` |
| `deal.mark_won` | Marks deal Won | — |
| `deal.mark_lost` | Marks deal Lost | `{ reason?: string }` |

### Task actions

| Action key | What it does | Config |
|---|---|---|
| `task.create` | Creates a follow-up task | `{ title, type, dueDaysFromNow }` |

### Inbox actions

| Action key | What it does | Config |
|---|---|---|
| `conversation.add_label` | Labels the conversation | `{ label: string }` |
| `conversation.mark_done` | Archives conversation | — |

### Notification actions

| Action key | What it does | Config |
|---|---|---|
| `notify.in_app` | Sends in-app notification | `{ message: string }` |
| `notify.webhook` | POSTs to a URL | `{ url, method?, headers? }` |
| `notify.email` | Sends email to the user | `{ subject, body }` |

### Utility actions

| Action key | What it does | Config |
|---|---|---|
| `workflow.wait` | Waits N minutes before next action | `{ minutes: number }` |

---

## 6. Data Model

```prisma
model Workflow {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?
  active      Boolean  @default(true)
  triggerKey  String   // e.g. 'lead.replied'
  conditions  Json     @default("[]")  // Condition[]
  actions     Json     @default("[]")  // Action[]
  runCount    Int      @default(0)
  lastRunAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  runs        WorkflowRun[]

  @@index([userId, active])
  @@index([triggerKey, active])
}

model WorkflowRun {
  id          String   @id @default(cuid())
  workflowId  String
  workflow    Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  userId      String
  entityId    String?  // leadId / dealId / conversationId that triggered it
  entityType  String?  // 'lead' | 'deal' | 'conversation' | 'booking'
  result      String   // 'success' | 'skipped' | 'error'
  error       String?
  actionsRun  Int      @default(0)
  payload     Json?
  createdAt   DateTime @default(now())

  @@index([workflowId, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
}
```

JSON shapes stored in `conditions` and `actions` fields:

```ts
// Condition
interface Condition {
  field: string       // e.g. 'lead.score'
  operator: string    // 'gt' | 'lt' | 'eq' | 'contains' | 'is_empty' | 'not_empty' ...
  value: string | number
}

// Action
interface WorkflowAction {
  key: string         // e.g. 'deal.create'
  config: Record<string, unknown>
}
```

---

## 7. Execution Engine

### `lib/workflowEngine.ts`

The core function:

```ts
async function runWorkflowsForEvent(
  triggerKey: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<void>
```

Steps:
1. Find all active `Workflow` records matching `triggerKey` for this `userId`
2. For each workflow:
   a. Evaluate conditions against payload → skip if any fail
   b. Execute actions in order
   c. Log `WorkflowRun` with result
   d. Increment `runCount`, update `lastRunAt`

### How triggers fire

Each trigger fires from an existing event site — just add a `runWorkflowsForEvent(...)` call (fire-and-forget with `.catch(() => {})`):

| Trigger | Fire from |
|---|---|
| `lead.replied` | `lib/sequenceRunner.ts` → `checkAndAutoStopRepliedLeads()` |
| `lead.email_opened` | `app/api/email/track/open/route.ts` |
| `lead.email_clicked` | `app/api/email/track/click/route.ts` |
| `lead.score_changed` | wherever Lead.score is updated |
| `deal.created` | `app/api/deals/route.ts` POST handler |
| `deal.stage_changed` | `app/api/deals/[id]/route.ts` PATCH handler |
| `deal.won` | `app/api/deals/[id]/route.ts` when `status=won` |
| `deal.lost` | `app/api/deals/[id]/route.ts` when `status=lost` |
| `conversation.reply_received` | `app/api/conversations/[id]/messages/route.ts` |
| `booking.confirmed` | `app/api/meetings/[slug]/book/route.ts` |
| `task.completed` | `app/api/tasks/[id]/route.ts` |
| `signal.fired` | `app/api/signals/watchlists/[id]/signals/route.ts` |

### Cron-based triggers (daily)
`deal.close_date_passed` and `task.overdue` are checked by a daily cron at `/api/cron/check-workflow-triggers`.

---

## 8. Pages

### 8.1 `/workflows` — Workflow list

```
┌──────────────────────────────────────────────────────┐
│ Workflows                         [+ New workflow]   │
├──────────────────────────────────────────────────────┤
│ 🟢 Reply → Add to pipeline               23 runs    │
│    When lead.replied → deal.create        last: 2h  │
│                               [Edit] [Pause] [Logs] │
├──────────────────────────────────────────────────────┤
│ 🟢 Hot lead alert                         8 runs    │
│    When lead.score_changed (score>70)               │
│    → notify.in_app + lead.add_tag("Hot")  last: 5h  │
│                               [Edit] [Pause] [Logs] │
├──────────────────────────────────────────────────────┤
│ ⏸  Booking → create deal (paused)         0 runs    │
│    When booking.confirmed → deal.create             │
│                               [Edit] [Enable][Logs] │
└──────────────────────────────────────────────────────┘
```

Each row: name, description of trigger+actions, run count, last run time, active toggle, Edit/Logs buttons.

### 8.2 Workflow builder (create/edit)

Three-section form — no visual node graph needed for v1, a clean linear form is sufficient:

```
┌──────────────────────────────────────────────────────────┐
│ Workflow name                                            │
│ [Reply received → Pipeline deal]                        │
│                                                         │
│ ── TRIGGER ──────────────────────────────────────────── │
│ When: [Lead replied to email          ▾]                │
│                                                         │
│ ── CONDITIONS (optional) ────────────────────────────── │
│ + Add condition                                         │
│ [lead.score] [greater than] [50]          [✕]          │
│ [campaign.id] [equals] [Select campaign ▾] [✕]         │
│                                                         │
│ ── ACTIONS ──────────────────────────────────────────── │
│ 1. [Create deal in pipeline           ▾]               │
│    Pipeline: [Sales Pipeline ▾]                         │
│    Stage:    [Qualified ▾]                              │
│                                                         │
│ 2. [Create task                       ▾]               │
│    Title: [Follow up with {{firstName}}]                │
│    Type:  [Call ▾]   Due: [1] day(s) from now          │
│                                                         │
│ 3. [Send in-app notification          ▾]               │
│    Message: [{{firstName}} replied — deal created!]    │
│                                                         │
│ [+ Add action]              [Save workflow]            │
└──────────────────────────────────────────────────────────┘
```

### 8.3 Workflow run log modal

Clicking "Logs" shows a timeline of recent runs:

```
┌──────────────────────────────────────────┐
│ Run log: Reply → Pipeline deal  [✕]      │
├──────────────────────────────────────────┤
│ ✅ Jun 24 14:32  Sarah J. (lead)        │
│    3 actions run                         │
│                                          │
│ ✅ Jun 24 10:15  Mike P. (lead)         │
│    3 actions run                         │
│                                          │
│ ⚠️  Jun 23 18:02  Rahul M. (lead)       │
│    Skipped: condition not met            │
│                                          │
│ ❌ Jun 23 09:44  Ankit S. (lead)        │
│    Error: Campaign not found             │
└──────────────────────────────────────────┘
```

---

## 9. Built-in Templates

On the `/workflows` page, show a "Start from template" section for new users:

| Template | Trigger | Actions |
|---|---|---|
| **Reply → Pipeline** | lead.replied | Create deal (Qualified) + Create task (Follow up, 1 day) |
| **Hot lead alert** | lead.score_changed | If score > 70: Add tag "Hot" + In-app notification |
| **Booking → Deal** | booking.confirmed | Create deal (Proposal Sent) |
| **Won deal → Webhook** | deal.won | POST webhook to your URL |
| **Overdue task alert** | task.overdue | In-app notification |
| **Signal → Enroll** | signal.fired | Enroll lead in campaign |

---

## 10. API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/workflows` | List user's workflows |
| POST | `/api/workflows` | Create workflow |
| GET | `/api/workflows/[id]` | Get workflow with recent runs |
| PATCH | `/api/workflows/[id]` | Update (name, active, trigger, conditions, actions) |
| DELETE | `/api/workflows/[id]` | Delete |
| GET | `/api/workflows/[id]/runs` | Paginated run log |
| GET | `/api/workflows/triggers` | Catalogue of available triggers (for UI picker) |
| GET | `/api/workflows/actions` | Catalogue of available actions (for UI picker) |
| POST | `/api/cron/check-workflow-triggers` | Cron: evaluate time-based triggers |

---

## 11. Migration

Single file `20260624000003_workflow_automation`:

```sql
CREATE TABLE "Workflow" (...)
CREATE TABLE "WorkflowRun" (...)
```

---

## 12. Out of scope (v1)

- Visual node graph / flowchart builder (linear form is enough)
- OR conditions (all conditions are AND)
- Branching (if/else paths) — future v2
- Delay actions longer than 24h (complex state management)
- Cross-user/workspace triggers

---

## 13. Effort estimate

| Piece | Hours |
|---|---|
| Schema + migration + API routes | 2h |
| Workflow engine (`lib/workflowEngine.ts`) | 3h |
| Wire triggers into existing event sites | 2h |
| `/workflows` list + builder UI | 4h |
| Run log modal | 1h |
| Templates | 1h |
| Cron route | 1h |
| **Total** | **~14h** |
