# Bulk Email Architecture (AWS SES)
> Goal: 1L+ recipients via AWS SES. Track every event. Beat Mailchimp on cost, speed, and intelligence.
> Last updated: 2026-07-13

---

## Architecture

```
[Campaign API]
      │
      ▼
[BullMQ Queue]  ←── rate limited to 14/sec (SES hard limit)
      │
      ▼
[Send Worker]
  ├── check Unsubscribe table          ← ALREADY DONE ✅
  ├── inject tracking pixel + rewrite links  ← ALREADY DONE ✅
  ├── add List-Unsubscribe header      ← MISSING ❌
  └── SES.sendEmail + ConfigurationSetName   ← MISSING ❌
            │
     [SES fires events]
            │
     [SNS Topics] → [SQS: outreachai-ses-events]  ← DEPLOYED ✅
            │
     [SQS Poller] (replaces webhook-only approach)
      ├── delivery   → mark MarketingCampaignSend delivered
      ├── bounce     → auto-suppress (Unsubscribe) ← webhook partial ✅
      ├── complaint  → auto-suppress              ← MISSING ❌
      ├── open       → already via /track/open    ✅
      └── click      → already via /track/click   ✅
```

---

## Audit: What's already built

| Feature | Status | File |
|---------|--------|------|
| MarketingCampaign model (status, A/B, stats) | ✅ Done | `prisma/schema.prisma` |
| MarketingCampaignSend (trackingId, openedAt, clickedAt) | ✅ Done | `prisma/schema.prisma` |
| Unsubscribe table | ✅ Done | `prisma/schema.prisma` |
| EmailAccount with SES fields | ✅ Done | `prisma/schema.prisma` |
| Suppression check before send | ✅ Done | `app/api/marketing/campaigns/[id]/send/route.ts:64` |
| Tracking pixel (open) | ✅ Done | `app/api/marketing/track/open/route.ts` |
| Click redirect | ✅ Done | `app/api/marketing/track/click/route.ts` |
| Unsubscribe endpoint | ✅ Done | `app/api/marketing/unsubscribe/route.ts` |
| Bounce → auto-suppress (webhook) | ✅ Done | `app/api/webhooks/email-bounce/route.ts` |
| Campaign stats API | ✅ Done | `app/api/marketing/campaigns/[id]/stats/route.ts` |
| Open/click/unsub rate computed | ✅ Done | stats route lines 26-28 |
| A/B schema (abEnabled, abSubjectB, abSplitPercent) | ✅ Done | `prisma/schema.prisma` |
| A/B winner resolution | ✅ Done | `app/api/marketing/campaigns/[id]/ab-resolve/route.ts` |
| Email warmup | ✅ Done | `app/api/warmup/` |
| Deliverability alerts | ✅ Done | `DeliverabilityAlert` model |

---

## Phase 0 — Prerequisites ✅ COMPLETE

| Task | Status |
|------|--------|
| SPF record | ✅ Done (yourdomain.com) |
| DKIM (3 CNAMEs) | ✅ Done |
| DMARC record | ✅ Done (added 2026-07-13) |
| SES production access | ✅ Done (50k/day, 14/sec) |
| SNS topics (bounce/complaint/delivery/open/click) | ✅ Done |
| SQS queue (outreachai-ses-events) | ✅ Done |

**IP warm-up schedule — start Day 1 with most-engaged contacts:**
| Day | Max/day | Rule |
|-----|---------|------|
| 1–2 | 500 | Opened email in last 30 days only |
| 3–4 | 2,000 | Opened in last 60 days |
| 5–6 | 5,000 | Opened in last 90 days |
| 7–8 | 10,000 | All verified emails |
| 9–10 | 20,000 | Full list |
| 11–12 | 35,000 | Full list |
| 13–14 | 50,000 | Full list |
| 15+ | 100,000+ | Unrestricted |

---

## Phase 1 — Schema gaps (small — 80% already done)

### Migration needed: `add_ses_bulk_fields`

```prisma
// MarketingCampaignSend — add:
sesMessageId     String?   // SES MessageId for SNS event correlation
deliveredAt      DateTime?
complainedAt     DateTime?

// Status enum additions: delivered | complained
// Current: pending | sent | bounced | failed
// New:     pending | sent | delivered | bounced | complained | failed

// EmailAccount — add:
configurationSetName  String?  @default("outreachai-bulk")
dailySendCount        Int      @default(0)
dailySendResetAt      DateTime?
```

**Files to change:**
- `prisma/schema.prisma`
- Run `npm run db:migrate` → generates migration file

---

## Phase 2 — Send Pipeline gaps

### 2.1 BullMQ queue (MISSING — critical for 1L+)

Current send is a synchronous loop with `setTimeout(100ms)` — blocks the HTTP request,
can't handle 1L+ recipients, no retry, no pause/resume.

**Install:**
```bash
npm install bullmq ioredis
```

**Files to create:**
```
webapp/lib/queues/
  ├── redis.ts              — Redis connection (reuse existing if any)
  ├── marketing-send.queue.ts   — Queue definition
  └── marketing-send.worker.ts  — Worker: pull job → send one email → update DB
```

**Worker logic per job:**
```typescript
// 1. Check Unsubscribe (already in send route — move here)
// 2. injectTracking() — already exists, reuse
// 3. SES send WITH ConfigurationSetName + sesMessageId capture
// 4. Update MarketingCampaignSend: status=sent, sentAt, sesMessageId
// Rate: 1 concurrency + 70ms delay = ~14/sec
```

**API change:**
- `POST /api/marketing/campaigns/:id/send` → enqueue jobs instead of loop
- `POST /api/marketing/campaigns/:id/pause` → drain queue
- Add progress tracking via `campaign.stats` JSON updates

### 2.2 List-Unsubscribe header (MISSING — required for bulk/Gmail)

```typescript
// In marketing-send.worker.ts, add to every send:
headers: {
  'List-Unsubscribe': `<https://outreachai.in/api/marketing/unsubscribe?t=${send.trackingId}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', // RFC 8058
}
```

### 2.3 ConfigurationSetName on SES sends (MISSING)

```typescript
// lib/email/transport.ts — sendViaSes() — add:
ConfigurationSetName: account.configurationSetName ?? 'outreachai-bulk',
```

This is a one-line fix. Without it, SES events don't flow to our SNS/SQS pipeline.

### 2.4 A/B split in send worker (PARTIAL — schema done, logic missing)

Current: A/B fields on schema but send route doesn't assign variants.

**Fix in worker:**
```typescript
const variant = lead.index < (campaign.abSplitPercent / 100 * total)
  ? 'A' : 'B';
const subject = variant === 'B' ? campaign.abSubjectB : campaign.subject;
// store variant in MarketingCampaignSend.abVariant
```

---

## Phase 3 — Event Tracking gaps

### 3.1 SQS poller for SES events (MISSING)

Current: webhook-based only (`/api/webhooks/email-bounce/`).
Problem: SNS HTTP webhooks require SSL endpoint, retry complexity, harder to scale.
Fix: Poll SQS — simpler, reliable, already deployed.

**File to create:** `webapp/lib/ses-event-poller.ts`

```typescript
// Runs on server startup (or as a cron every 30s)
// Polls: https://sqs.ap-south-1.amazonaws.com/<AWS_ACCOUNT_ID>/outreachai-ses-events
// Processes:
//   notificationType === 'Bounce' + bounceType === 'Permanent'
//     → Unsubscribe.upsert + MarketingCampaignSend.status = bounced
//   notificationType === 'Complaint'
//     → Unsubscribe.upsert + MarketingCampaignSend.complainedAt = now
//   notificationType === 'Delivery'
//     → MarketingCampaignSend.deliveredAt = now, status = delivered
// Correlation: sesMessageId → MarketingCampaignSend lookup
```

**Env var needed:**
```
SES_EVENT_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/<AWS_ACCOUNT_ID>/outreachai-ses-events
```

### 3.2 Complaint auto-suppress (MISSING)

Current webhook handler handles bounce + spamreport (SendGrid) but SES `Complaint` events
are not explicitly handled.

**Fix in SQS poller + webhook handler:**
```typescript
case 'Complaint':
  await prisma.unsubscribe.upsert({ where: { email_userId: ... }, ... })
  await prisma.marketingCampaignSend.updateMany({
    where: { leadEmail: email, campaignId },
    data: { complainedAt: new Date(), status: 'complained' }
  })
```

---

## Phase 4 — Dashboard gaps

### 4.1 Hourly timeline (MISSING)

Current stats: aggregate totals only.

**New endpoint:** `GET /api/marketing/campaigns/:id/timeline`

```typescript
// Group MarketingCampaignSend by hour:
SELECT
  date_trunc('hour', "sentAt") as hour,
  COUNT(*) filter (where status = 'delivered') as delivered,
  COUNT(*) filter (where "openedAt" IS NOT NULL) as opened,
  COUNT(*) filter (where "clickedAt" IS NOT NULL) as clicked
FROM "MarketingCampaignSend"
WHERE "campaignId" = $1
GROUP BY 1 ORDER BY 1
```

### 4.2 Bounce rate in stats (PARTIAL)

Current stats show bounced count but not `bounceRate`. One-line fix:
```typescript
bounceRate: sent > 0 ? (bounced / sent * 100).toFixed(1) + '%' : '0%'
complaintRate: sent > 0 ? (complained / sent * 100).toFixed(1) + '%' : '0%'
```

---

## Phase 5 — 10x Features (Week 3+)

### 5.1 AI subject line generation (MISSING — SDK already installed)

Anthropic SDK is in `package.json`. Zero setup needed.

**New endpoint:** `POST /api/marketing/campaigns/:id/ai-subject`
```typescript
// Input: campaign goal, audience description, current subject
// Output: 5 subject line variants with predicted open rates
// Uses: claude-sonnet-4-6 with prompt caching
```

**UI:** Add "Generate with AI" button next to subject line input in campaign editor.

### 5.2 Send time optimization (MISSING)

**Phase 5a — simple:** Send at 9–11am recipient's timezone (use Lead.timezone if available).
**Phase 5b — smart:** Track per-lead open times from `EmailEvent`, compute optimal hour.

Schema addition:
```prisma
// Lead model — add:
preferredSendHour  Int?    // 0-23, learned from open history
timezone           String? @default("Asia/Kolkata")
```

### 5.3 Multi-channel: Email + WhatsApp in same campaign (MISSING)

`User.waApiKey` + `User.waPhone` already stored.

```prisma
// MarketingCampaign — add:
whatsappEnabled     Boolean @default(false)
whatsappBody        String? @db.Text
whatsappFollowupH   Int?    // send WA if no email open after N hours
```

**Worker logic:**
```
Send email → wait N hours → check openedAt → if null → send WhatsApp
```

### 5.4 Real-time SSE stats (MISSING)

**New endpoint:** `GET /api/marketing/campaigns/:id/live`

```typescript
// Server-sent events stream
// Every 3 seconds: query stats, push if changed
// Client: EventSource('/api/marketing/campaigns/:id/live')
// Auto-closes when campaign status = 'sent'
```

### 5.5 Predictive suppression (MISSING)

Before any campaign send, flag leads who:
- Haven't opened in 180+ days → send re-engagement first
- Have 3+ soft bounces in 30 days → auto-suppress

```typescript
// In send worker, before send:
const lastOpen = await getLastOpenDate(lead.email)
if (daysSince(lastOpen) > 180) {
  // queue re-engagement email instead, skip main send
}
```

---

## Cost vs Mailchimp

| Monthly volume | Mailchimp | OutreachAI (SES) | Saving |
|---------------|-----------|-----------------|--------|
| 10,000 | $35 | ~$1 | 97% |
| 100,000 | $350 | ~$10 | 97% |
| 1,000,000 | $1,700 | ~$100 | 94% |

---

## Health thresholds (enforced in send worker)

```
Before each campaign send:
  bounce rate > 2%      → BLOCK, alert user
  complaint rate > 0.1% → BLOCK, alert user

Per send:
  email in Unsubscribe  → skip silently ✅ (already done)
  sesMessageId missing  → log error, mark failed

Auto-suppress triggers:
  Permanent bounce      → Unsubscribe.upsert ✅ (partial)
  Complaint             → Unsubscribe.upsert ❌ (add in SQS poller)
  3 soft bounces/30d    → Unsubscribe.upsert (Phase 5)
```

---

## Implementation order

```
Week 1  PHASE 1: Schema migration (sesMessageId, deliveredAt, complainedAt, configurationSetName)
        PHASE 2: ConfigurationSetName one-liner in transport.ts
                 List-Unsubscribe header
                 BullMQ send queue + worker

Week 2  PHASE 3: SQS poller (bounce/complaint/delivery → DB)
                 Complaint auto-suppress
        PHASE 4: Hourly timeline endpoint
                 Bounce/complaint rate in stats

Week 3  Warm-up begins (500/day → ramp)
        PHASE 5a: AI subject line generation
                  A/B split logic in worker

Week 4+ PHASE 5b: Send time optimization
                  Multi-channel (Email + WhatsApp)
                  Real-time SSE stats
                  Predictive suppression
```

---

## Files to create / modify

### webapp
```
MODIFY  prisma/schema.prisma                           — add 5 fields
CREATE  prisma/migrations/YYYYMMDD_ses_bulk_fields/    — migration
MODIFY  lib/email/transport.ts                         — add ConfigurationSetName (1 line)
MODIFY  app/api/marketing/campaigns/[id]/send/route.ts — enqueue instead of loop
CREATE  lib/queues/redis.ts
CREATE  lib/queues/marketing-send.queue.ts
CREATE  lib/queues/marketing-send.worker.ts
CREATE  lib/ses-event-poller.ts
MODIFY  app/api/webhooks/email-bounce/route.ts         — add SES Complaint handling
CREATE  app/api/marketing/campaigns/[id]/timeline/route.ts
MODIFY  app/api/marketing/campaigns/[id]/stats/route.ts — add bounceRate, complaintRate
CREATE  app/api/marketing/campaigns/[id]/ai-subject/route.ts  (Phase 5)
CREATE  app/api/marketing/campaigns/[id]/live/route.ts        (Phase 5 SSE)
MODIFY  app/api/marketing/campaigns/[id]/route.ts      — A/B split in send (Phase 5)
```

### mf-cdk (already deployed)
```
DONE  gl-ses-stack/ses-stack.ts  — SQS + SNS + open/click events all live ✅
```

---

## Env vars needed

```env
# Already in EmailAccount table — no new env vars needed for SES credentials
# New:
SES_EVENT_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/<AWS_ACCOUNT_ID>/outreachai-ses-events
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<outreachai-ses-sender key>
AWS_SECRET_ACCESS_KEY=<outreachai-ses-sender secret>
```
